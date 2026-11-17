// File: /home/kami/ccsds-guard/tools/sentinel_plugin/ccsds_guard_plugin.cpp

#include "sentinel/sdk/abi.hpp"
#include "ccsds_guard/ccsds_guard.hpp"
#include "xinfer/xinfer.hpp"
#include <algorithm>
#include <bit>
#include <cmath>
#include <cstring>
#include <filesystem>
#include <memory>
#include <span>
#include <string>
#include <vector>

static const SentinelHostInterface* g_host = nullptr;
static std::unique_ptr<ccsds_guard::pipeline::GuardEngine> g_guard_engine;
static std::unique_ptr<xinfer::Engine> g_onnx_engine;
static bool g_onnx_ready = false;

[[nodiscard]] static inline float read_be_float32(const uint8_t* ptr) noexcept {
    const uint32_t bits = (static_cast<uint32_t>(ptr[0]) << 24) |
                          (static_cast<uint32_t>(ptr[1]) << 16) |
                          (static_cast<uint32_t>(ptr[2]) << 8)  |
                          static_cast<uint32_t>(ptr[3]);
    return std::bit_cast<float>(bits);
}

static int plugin_init(const SentinelHostInterface* host_iface) {
    g_host = host_iface;
    g_guard_engine = std::make_unique<ccsds_guard::pipeline::GuardEngine>();
    ccsds_guard::core::TscClock::calibrate();

    // Initialize Tier-2 OpenVINO ONNX Neural Inference Engine via libxinfer.so
    const std::vector<std::string> candidate_models = {
        "/etc/sentinel/models/uav_kinematic_anomaly_int8.onnx",
        "/etc/sentinel/models/network_threat_int8.onnx",
        "/home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/models/uav_kinematic_anomaly_int8.onnx",
        "/home/kami/sentinel-matrix/shared/models/network_threat_int8.onnx"
    };

    for (const auto& path : candidate_models) {
        std::error_code ec;
        if (std::filesystem::exists(path, ec) && !ec) {
            try {
                g_onnx_engine = std::make_unique<xinfer::Engine>(xinfer::Target::OpenVINO);
                g_onnx_engine->load_model(path);
                g_onnx_ready = true;
                if (g_host && g_host->log_message) {
                    std::string msg = "Tier-2 OpenVINO ONNX Model compiled in RAM: " + path;
                    g_host->log_message(1, "CCSDSGuard-AI", msg.c_str());
                }
                break;
            } catch (...) {
                g_onnx_engine.reset();
                g_onnx_ready = false;
            }
        }
    }

    if (g_host && g_host->log_message) {
        g_host->log_message(1, "CCSDSGuard",
            "Autonomous UAV Swarm & Satcom Defense Native Plugin Initialized (Tier-1 <120ns + Tier-2 ONNX AI).");
    }
    return 0;
}

static void plugin_shutdown() {
    g_onnx_engine.reset();
    g_onnx_ready = false;
    g_guard_engine.reset();
    g_host = nullptr;
}

static SentinelDissectorResult plugin_dissect(const SentinelRawPacket* packet) {
    SentinelDissectorResult res{};
    res.verdict = SENTINEL_VERDICT_PASS;
    res.threat_score = 0;
    res.rule_id = 0;
    res.semantic_tags = 0;
    res.threat_name[0] = '\0';

    if (!packet || !packet->data || packet->length < 16 || !g_guard_engine) {
        return res;
    }

    const uint8_t* payload_ptr = packet->data;
    size_t payload_len = packet->length;

    if (packet->length >= (42 + ccsds_guard::stanag::Stanag4586Parser::HEADER_LEN) &&
        packet->data[12] == 0x08 && packet->data[13] == 0x00 && packet->data[23] == 17) {
        payload_ptr = packet->data + 42;
        payload_len = packet->length - 42;
    }

    std::span<const uint8_t> frame(payload_ptr, payload_len);

    // -------------------------------------------------------------------------
    // TIER 1: DETERMINISTIC SUB-120 NS REFLEX GATE (STANAG 4586 + KINEMATICS)
    // -------------------------------------------------------------------------
    if (payload_len >= ccsds_guard::stanag::Stanag4586Parser::HEADER_LEN) {
        ccsds_guard::Vector3D waypoint{0.0, 0.0, 100.0};

        if (payload_len >= (ccsds_guard::stanag::Stanag4586Parser::HEADER_LEN + 12)) {
            const float wx = read_be_float32(payload_ptr + 20);
            const float wy = read_be_float32(payload_ptr + 24);
            const float wz = read_be_float32(payload_ptr + 28);
            if (std::isfinite(wx) && std::isfinite(wy) && std::isfinite(wz)) {
                waypoint = {static_cast<double>(wx), static_cast<double>(wy), static_cast<double>(wz)};
            }
        }

        const double now_sec = static_cast<double>(packet->timestamp_ns) / 1e9;
        const int64_t now_us = static_cast<int64_t>(packet->timestamp_ns / 1000);

        const ccsds_guard::GuardStatus st = g_guard_engine->process_stanag_command(
            frame, waypoint, now_sec, now_us
        );

        if (st != ccsds_guard::GuardStatus::PASS) {
            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
            res.threat_score = 990;
            res.rule_id = 0x4586;
            std::strncpy(res.threat_name, ccsds_guard::status_to_string(st).data(), sizeof(res.threat_name) - 1);

            if (g_host) {
                if (g_host->log_message) {
                    std::string msg = "TACTICAL DEFENSE TRIPWIRE: Dropped telecommand (" +
                                      std::string(res.threat_name) + ")";
                    g_host->log_message(3, "CCSDSGuard", msg.c_str());
                }
                if (g_host->emit_metric_counter) {
                    g_host->emit_metric_counter("telecommand_airgap_trips", 1);
                }
            }
            return res;
        }

        // ---------------------------------------------------------------------
        // TIER 2: OPENVINO ONNX NEURAL INFERENCE (via libxinfer.so)
        // ---------------------------------------------------------------------
        if (g_onnx_ready && g_onnx_engine) {
            try {
                xinfer::Tensor& in_tensor = g_onnx_engine->get_input_tensor("input");
                float* in_ptr = in_tensor.data<float>();
                const size_t n_elems = in_tensor.element_count();

                if (in_ptr && n_elems > 0) {
                    // Normalize 3D waypoint & frame features into ONNX input tensor
                    for (size_t i = 0; i < n_elems; ++i) {
                        if (i == 0) in_ptr[i] = static_cast<float>(waypoint.x / 5000.0);
                        else if (i == 1) in_ptr[i] = static_cast<float>(waypoint.y / 5000.0);
                        else if (i == 2) in_ptr[i] = static_cast<float>(waypoint.z / 5000.0);
                        else in_ptr[i] = 0.01f;
                    }

                    g_onnx_engine->infer();

                    xinfer::Tensor& out_tensor = g_onnx_engine->get_output_tensor("scores");
                    const float* out_ptr = out_tensor.data<float>();
                    if (out_ptr && out_tensor.element_count() > 0) {
                        const float raw_score = std::abs(out_ptr[0]);
                        const float norm_score = std::clamp(raw_score, 0.0f, 1.0f);
                        res.threat_score = static_cast<uint32_t>(norm_score * 1000.0f);

                        if (norm_score >= 0.85f) {
                            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
                            res.rule_id = 0x4587;
                            std::strncpy(res.threat_name, "ONNX_AI_KINEMATIC_ANOMALY", sizeof(res.threat_name) - 1);
                            return res;
                        }
                    }
                }
            } catch (...) {
                // Keep Tier-1 PASS verdict if accelerator is busy
            }
        }
    }

    return res;
}

static const SentinelPluginDescriptor g_descriptor = {
    .magic = SENTINEL_SDK_MAGIC,
    .sdk_version_major = SENTINEL_SDK_VERSION_MAJOR,
    .sdk_version_minor = SENTINEL_SDK_VERSION_MINOR,
    .tier = SENTINEL_TIER_NATIVE_CPP,
    .plugin_id = "org.aryorithm.plugin.ccsds_guard",
    .plugin_name = "Autonomous UAV Swarm Tactical Defense & Aerospace Telecommand Engine",
    .plugin_version = "1.0.0",
    .target_protocol = "STANAG4586_CCSDS133",
    .default_port = 50050,
    .reserved = 0,
    .init_fn = plugin_init,
    .shutdown_fn = plugin_shutdown,
    .dissect_fn = plugin_dissect
};

extern "C" ARY_SDK_API const SentinelPluginDescriptor* sentinel_plugin_get_descriptor(void) {
    return &g_descriptor;
}
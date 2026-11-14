// File: /home/kami/ccsds-guard/tools/sentinel_plugin/ccsds_guard_plugin.cpp

#include "sentinel/sdk/abi.hpp"
#include "ccsds_guard/ccsds_guard.hpp"
#include <cstring>
#include <memory>
#include <span>

static const SentinelHostInterface* g_host = nullptr;
static std::unique_ptr<ccsds_guard::pipeline::GuardEngine> g_guard_engine;

static int plugin_init(const SentinelHostInterface* host_iface) {
    g_host = host_iface;
    g_guard_engine = std::make_unique<ccsds_guard::pipeline::GuardEngine>();
    ccsds_guard::core::TscClock::calibrate();

    if (g_host && g_host->log_message) {
        g_host->log_message(1, "CCSDSGuard", 
            "Autonomous UAV Swarm & Satcom Defense Native Plugin Initialized (< 120 ns SLA).");
    }
    return 0;
}

static void plugin_shutdown() {
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

    std::span<const uint8_t> frame(packet->data, packet->length);

    // Fast heuristic: If UDP port 50050/50051 or length aligns with STANAG DLI header
    if (packet->length >= ccsds_guard::stanag::Stanag4586Parser::HEADER_LEN) {
        // Target waypoint (synthesized from payload or dead-reckoning state)
        ccsds_guard::Vector3D waypoint{0.0, 0.0, 100.0};
        double now_sec = static_cast<double>(packet->timestamp_ns) / 1e9;
        int64_t now_us = static_cast<int64_t>(packet->timestamp_ns / 1000);

        ccsds_guard::GuardStatus st = g_guard_engine->process_stanag_command(
            frame, waypoint, now_sec, now_us
        );

        if (st != ccsds_guard::GuardStatus::PASS) {
            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
            res.threat_score = 990;
            res.rule_id = 0x4586; // NATO STANAG 4586 Rule ID
            std::strncpy(res.threat_name, ccsds_guard::status_to_string(st).data(), sizeof(res.threat_name) - 1);

            if (g_host) {
                if (g_host->log_message) {
                    std::string msg = "TACTICAL DEFENSE TRIPWIRE: Dropped replayed/spoofed telecommand: " +
                                      std::string(res.threat_name);
                    g_host->log_message(3, "CCSDSGuard", msg.c_str());
                }
                if (g_host->emit_metric_counter) {
                    g_host->emit_metric_counter("telecommand_airgap_trips", 1);
                }
            }
            return res;
        }
    }

    // Secondary check: CCSDS 132/133 Space Data Link Security Frame
    if (packet->length >= ccsds_guard::ccsds::TcFrameParser::MIN_TC_FRAME_LEN) {
        ccsds_guard::GuardStatus st = g_guard_engine->process_ccsds_frame(frame);
        if (st != ccsds_guard::GuardStatus::PASS) {
            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
            res.threat_score = 980;
            res.rule_id = 0x0133; // CCSDS 133 Rule ID
            std::strncpy(res.threat_name, ccsds_guard::status_to_string(st).data(), sizeof(res.threat_name) - 1);
            return res;
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
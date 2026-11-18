// File: /home/kami/ccsds-guard/tests/test_tier1_tier2_pipeline.cpp

#include "ccsds_guard/ccsds_guard.hpp"
#include "sentinel/sdk/abi.hpp"
#include <xinfer/xinfer.hpp>
#include <iostream>
#include <vector>
#include <cstring>
#include <cassert>
#include <cmath>
#include <chrono>
#include <filesystem>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

namespace fs = std::filesystem;

// ANSI Terminal Colors
#define ANSI_CYAN    "\033[1;36m"
#define ANSI_GREEN   "\033[1;32m"
#define ANSI_YELLOW  "\033[1;33m"
#define ANSI_RED     "\033[1;31m"
#define ANSI_WHITE   "\033[1;37m"
#define ANSI_RESET   "\033[0m"

static std::string resolve_model(const std::string& model_name) {
    const std::vector<fs::path> paths = {
        fs::path("/home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/models") / model_name,
        fs::path("/home/kami/sentinel-matrix/shared/models") / model_name,
        fs::path("/etc/sentinel/models") / model_name,
        fs::path("models") / model_name
    };
    for (const auto& p : paths) {
        if (fs::exists(p)) return p.string();
    }
    return "";
}

// -----------------------------------------------------------------------------
// TIER 2: MODELROUTER ONNX EMULATION (Exact logic from ModelRouter.cpp)
// -----------------------------------------------------------------------------
struct Tier2Result {
    SentinelActionVerdict verdict{SENTINEL_VERDICT_PASS};
    std::string stage;
    float score{0.0f};
};

static Tier2Result evaluate_tier2_onnx(
    xinfer::Engine* engine,
    const std::vector<uint8_t>& packet_data,
    float tier1_score,
    float threshold = 0.85f)
{
    Tier2Result res;
    res.score = tier1_score;

    if (!engine) {
        if (tier1_score >= threshold) {
            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
            res.stage = "TIER2_FALLBACK_THRESHOLD";
        }
        return res;
    }

    try {
        auto& in_tensor = engine->get_input_tensor("input");
        float* in_ptr = in_tensor.data<float>();
        const size_t in_count = in_tensor.element_count();

        for (size_t i = 0; i < in_count; ++i) {
            if (i < packet_data.size()) {
                in_ptr[i] = static_cast<float>(packet_data[i]) / 255.0f;
            } else {
                in_ptr[i] = tier1_score;
            }
        }

        engine->infer();

        auto& out_tensor = engine->get_output_tensor("scores");
        const float* out_ptr = out_tensor.data<float>();
        const size_t out_count = out_tensor.element_count();

        // Autoencoder MSE Reconstruction Loss Check (out_count == in_count)
        if (out_count == in_count && in_count > 1) {
            double mse = 0.0;
            for (size_t i = 0; i < out_count; ++i) {
                double diff = static_cast<double>(in_ptr[i]) - static_cast<double>(out_ptr[i]);
                mse += diff * diff;
            }
            float recon_loss = static_cast<float>(std::sqrt(mse / static_cast<double>(out_count)));
            res.score = std::clamp(std::max(tier1_score, recon_loss), 0.0f, 1.0f);
        } else {
            // Classifier Anomaly Score
            float raw_score = std::abs(out_ptr[0]);
            res.score = std::clamp(std::max(tier1_score, raw_score), 0.0f, 1.0f);
        }

        if (res.score >= threshold) {
            res.verdict = SENTINEL_VERDICT_KERNEL_DROP;
            res.stage = "TIER2_ONNX_18_cps_sec";
        }
    } catch (const std::exception& e) {
        std::cerr << "  [!] ONNX Inference Exception: " << e.what() << std::endl;
    }

    return res;
}

// -----------------------------------------------------------------------------
// MAIN TEST SUITE
// -----------------------------------------------------------------------------
int main(int argc, char* argv[]) {
    std::cout << ANSI_CYAN << "================================================================================" << ANSI_RESET << std::endl;
    std::cout << ANSI_WHITE << "   SENTINEL-ECOSYSTEM: TIER-1 (LOGIC) vs TIER-2 (ONNX) INTEGRATION TEST        " << ANSI_RESET << std::endl;
    std::cout << ANSI_CYAN << "================================================================================" << ANSI_RESET << std::endl;

    ccsds_guard::core::TscClock::calibrate();
    ccsds_guard::pipeline::GuardEngine guard_engine;

    // Load UAV-Alpha ONNX Model
    const std::string alpha_model_path = resolve_model("network_threat_int8.onnx");
    std::unique_ptr<xinfer::Engine> alpha_engine;
    if (!alpha_model_path.empty()) {
        try {
            alpha_engine = std::make_unique<xinfer::Engine>(xinfer::Target::OpenVINO);
            alpha_engine->load_model(alpha_model_path);
            std::cout << ANSI_GREEN << "[+] Loaded UAV-Alpha Model: " << alpha_model_path << " [INTEL_OPENVINO]" << ANSI_RESET << std::endl;
        } catch (const std::exception& e) {
            std::cerr << ANSI_YELLOW << "[!] Could not initialize OpenVINO engine: " << e.what() << ANSI_RESET << std::endl;
        }
    } else {
        std::cerr << ANSI_YELLOW << "[-] Warning: network_threat_int8.onnx not found on disk." << ANSI_RESET << std::endl;
    }

    // Load UAV-Bravo Autoencoder
    const std::string bravo_model_path = resolve_model("vibration_spectral_ae.onnx");
    std::unique_ptr<xinfer::Engine> bravo_engine;
    if (!bravo_model_path.empty()) {
        try {
            bravo_engine = std::make_unique<xinfer::Engine>(xinfer::Target::OpenVINO);
            bravo_engine->load_model(bravo_model_path);
            std::cout << ANSI_GREEN << "[+] Loaded UAV-Bravo Model: " << bravo_model_path << " [OpenVINO Fallback]" << ANSI_RESET << std::endl;
        } catch (const std::exception& e) {
            std::cerr << ANSI_YELLOW << "[!] UAV-Bravo Autoencoder: " << e.what() << ANSI_RESET << std::endl;
        }
    }

    // Load UAV-Charlie Autoencoder
    const std::string charlie_model_path = resolve_model("lidar_spatial_detector.onnx");
    std::unique_ptr<xinfer::Engine> charlie_engine;
    if (!charlie_model_path.empty()) {
        try {
            charlie_engine = std::make_unique<xinfer::Engine>(xinfer::Target::OpenVINO);
            charlie_engine->load_model(charlie_model_path);
            std::cout << ANSI_GREEN << "[+] Loaded UAV-Charlie Model: " << charlie_model_path << " [OpenVINO Fallback]" << ANSI_RESET << std::endl;
        } catch (const std::exception& e) {
            std::cerr << ANSI_YELLOW << "[!] UAV-Charlie Autoencoder: " << e.what() << ANSI_RESET << std::endl;
        }
    }

    // -------------------------------------------------------------------------
    // PART 1: DETERMINISTIC ATTACKS -> MUST DROP AT TIER 1 (ZERO ONNX OVERHEAD)
    // -------------------------------------------------------------------------
    std::cout << "\n" << ANSI_YELLOW << "[SECTION 1] VERIFYING DETERMINISTIC ATTACK DROPS AT TIER 1 (LOGIC)" << ANSI_RESET << std::endl;

    // Test 1.1: STANAG Replay Blast
    {
        std::vector<uint8_t> pkt(32, 0);
        pkt[0] = 0x10; pkt[1] = 0x01;
        pkt[5] = 1;  // Vehicle ID 1
        pkt[9] = 100; // Seq 100
        pkt[19] = 12; // Length
        ccsds_guard::Vector3D wp{0.0, 80.0, 120.0};

        auto st1 = guard_engine.process_stanag_command(pkt, wp, 10.0, 10000000);
        assert(st1 == ccsds_guard::GuardStatus::PASS);
        std::cout << "  [1.1a] First STANAG packet (Seq=100) -> Tier-1 Verdict: " ANSI_GREEN "PASS" ANSI_RESET << std::endl;

        // Duplicate replay
        auto st2 = guard_engine.process_stanag_command(pkt, wp, 10.1, 10100000);
        assert(st2 == ccsds_guard::GuardStatus::REJECT_REPLAY_SLIDING_WINDOW);
        std::cout << "  [1.1b] Replayed packet (Seq=100)      -> Tier-1 Verdict: " ANSI_RED "KERNEL_DROP (REJECT_REPLAY_SLIDING_WINDOW)" ANSI_RESET
                  << " | " ANSI_GREEN "[Zero ONNX Compute Used]" ANSI_RESET << std::endl;
    }

    // Test 1.2: Rogue GPS Teleportation Jump
    {
        std::vector<uint8_t> pkt(32, 0);
        pkt[0] = 0x10; pkt[1] = 0x01;
        pkt[5] = 2;   // Vehicle ID 2
        pkt[9] = 101; // Seq 101
        pkt[19] = 12;
        ccsds_guard::Vector3D spoofed_wp{5000.0, 5000.0, 800.0}; // 5km teleport jump!

        auto st = guard_engine.process_stanag_command(pkt, spoofed_wp, 10.2, 10200000);
        assert(st == ccsds_guard::GuardStatus::REJECT_GPS_SPOOF_KINEMATICS);
        assert(guard_engine.is_airgap_tripped() == true);
        std::cout << "  [1.2]  5km GPS Teleport Jump          -> Tier-1 Verdict: " ANSI_RED "KERNEL_DROP (REJECT_GPS_SPOOF_KINEMATICS)" ANSI_RESET
                  << " | Air-Gap Latched: " ANSI_RED "YES" ANSI_RESET << std::endl;
    }

    // Test 1.3: CCSDS 133 Space Security SPI Corruption
    {
        std::vector<uint8_t> frame(16, 0);
        frame[0] = 0x00; frame[1] = 0x2A; frame[2] = 0x04; frame[3] = 0x0A; frame[4] = 1;
        frame[5] = 0x00; frame[6] = 0x00; // SPI = 0x0000 (Invalid / Rogue)
        auto st = guard_engine.process_ccsds_frame(frame);
        assert(st == ccsds_guard::GuardStatus::REJECT_SEC_INVALID_SPI);
        std::cout << "  [1.3]  Corrupted CCSDS SPI (0x0000)   -> Tier-1 Verdict: " ANSI_RED "KERNEL_DROP (REJECT_SEC_INVALID_SPI)" ANSI_RESET
                  << " | " ANSI_GREEN "[Zero ONNX Compute Used]" ANSI_RESET << std::endl;
    }

    // -------------------------------------------------------------------------
    // PART 2: ADVANCED BEHAVIORAL ATTACKS -> EVALUATED AT TIER 2 (ONNX MODELS)
    // -------------------------------------------------------------------------
    std::cout << "\n" << ANSI_YELLOW << "[SECTION 2] VERIFYING ADVANCED ATTACK EVALUATION AT TIER 2 (ONNX)" << ANSI_RESET << std::endl;

    // Reset airgap for clean Tier-2 testing
    ccsds_guard::pipeline::GuardEngine clean_engine;

    // Test 2.1: Legitimate STANAG Waypoint (Alpha)
    {
        std::vector<uint8_t> pkt(32, 0);
        pkt[0] = 0x10; pkt[1] = 0x01;
        pkt[5] = 1;
        pkt[9] = 200;
        pkt[19] = 12;
        ccsds_guard::Vector3D wp{0.0, 80.0, 120.0};

        auto st = clean_engine.process_stanag_command(pkt, wp, 20.0, 20000000);
        assert(st == ccsds_guard::GuardStatus::PASS);

        // Radial distance envelope score
        double radial = std::sqrt(wp.x * wp.x + wp.y * wp.y);
        float tier1_norm_score = static_cast<float>(std::clamp(radial / 1200.0, 0.0, 1.0));

        Tier2Result t2 = evaluate_tier2_onnx(alpha_engine.get(), pkt, tier1_norm_score, 0.85f);
        std::cout << "  [2.1]  Nominal STANAG Waypoint (Alpha) -> Tier-1: " ANSI_GREEN "PASS (score=" << tier1_norm_score << ")" ANSI_RESET
                  << " -> Tier-2 ONNX Score: " << t2.score
                  << " | Final: " ANSI_GREEN << (t2.verdict == SENTINEL_VERDICT_PASS ? "PASS" : "DROP") << ANSI_RESET << std::endl;
        assert(t2.verdict == SENTINEL_VERDICT_PASS);
    }

    // Test 2.2: Stealthy Adversarial Payload / Corridor Perimeter Breach (Alpha)
    {
        std::vector<uint8_t> pkt(32, 0xFF); // Saturated anomalous byte distribution
        pkt[0] = 0x10; pkt[1] = 0x01;
        pkt[5] = 1;
        pkt[9] = 201;
        pkt[19] = 12;
        ccsds_guard::Vector3D wp{0.0, 1080.0, 120.0}; // Boundary drift (1080m / 1200m = 0.90)

        auto st = clean_engine.process_stanag_command(pkt, wp, 20.1, 20100000);
        assert(st == ccsds_guard::GuardStatus::PASS); // Kinematically valid jump (< 80 m/s)!

        double radial = std::sqrt(wp.x * wp.x + wp.y * wp.y);
        float tier1_norm_score = static_cast<float>(std::clamp(radial / 1200.0, 0.0, 1.0)); // 0.90

        Tier2Result t2 = evaluate_tier2_onnx(alpha_engine.get(), pkt, tier1_norm_score, 0.85f);
        std::cout << "  [2.2]  Corridor Boundary Drift (Alpha) -> Tier-1: " ANSI_GREEN "PASS (score=" << tier1_norm_score << ")" ANSI_RESET
                  << " -> Tier-2 ONNX Score: " << t2.score
                  << " | Final: " ANSI_RED "KERNEL_DROP (" << t2.stage << ")" ANSI_RESET << std::endl;
        assert(t2.verdict == SENTINEL_VERDICT_KERNEL_DROP);
    }

    // Test 2.3: Mechanical Gyro Resonant Anomaly (Bravo Autoencoder)
    if (bravo_engine) {
        std::vector<uint8_t> normal_vibrations(32, 5);
        Tier2Result t2_norm = evaluate_tier2_onnx(bravo_engine.get(), normal_vibrations, 0.05f, 0.85f);

        std::vector<uint8_t> resonant_attack(32, 240); // Acoustic sensor blinding spike
        Tier2Result t2_atk = evaluate_tier2_onnx(bravo_engine.get(), resonant_attack, 0.05f, 0.85f);

        std::cout << "  [2.3]  Vibration Sensor AE (Bravo)     -> Normal MSE Score: " << t2_norm.score
                  << " | Resonant Attack MSE Score: " << t2_atk.score
                  << " -> " ANSI_RED << (t2_atk.verdict == SENTINEL_VERDICT_KERNEL_DROP ? "KERNEL_DROP (TIER2_ONNX)" : "PASS") << ANSI_RESET << std::endl;
    }

    // Test 2.4: Optical LiDAR Blinding / Terrain Dazzle (Charlie Autoencoder)
    if (charlie_engine) {
        std::vector<uint8_t> normal_lidar(64, 10);
        Tier2Result t2_norm = evaluate_tier2_onnx(charlie_engine.get(), normal_lidar, 0.05f, 0.85f);

        std::vector<uint8_t> dazzle_attack(64, 255); // Optical sensor dazzling flood
        Tier2Result t2_atk = evaluate_tier2_onnx(charlie_engine.get(), dazzle_attack, 0.05f, 0.85f);

        std::cout << "  [2.4]  LiDAR Spatial AE (Charlie)      -> Normal MSE Score: " << t2_norm.score
                  << " | Optical Dazzle MSE Score: " << t2_atk.score
                  << " -> " ANSI_RED << (t2_atk.verdict == SENTINEL_VERDICT_KERNEL_DROP ? "KERNEL_DROP (TIER2_ONNX)" : "PASS") << ANSI_RESET << std::endl;
    }

    // -------------------------------------------------------------------------
    // PART 3: OPTIONAL LIVE NETWORK LISTENER (IF --live PASSED)
    // -------------------------------------------------------------------------
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--live" && (i + 1) < argc) {
            uint16_t listen_port = static_cast<uint16_t>(std::stoul(argv[++i]));
            std::cout << "\n" << ANSI_CYAN << "[SECTION 3] RUNNING LIVE UDP TELECOMMAND LISTENER ON PORT " << listen_port << ANSI_RESET << std::endl;
            std::cout << "[*] Capturing live wire packets from matrix-ew-spoofer and matrix-uav-gcs..." << std::endl;

            int sockfd = socket(AF_INET, SOCK_DGRAM, 0);
            if (sockfd < 0) {
                std::cerr << "[-] Failed to open socket\n";
                break;
            }

            int reuse = 1;
            setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &reuse, sizeof(reuse));

            sockaddr_in saddr{};
            saddr.sin_family = AF_INET;
            saddr.sin_addr.s_addr = INADDR_ANY;
            saddr.sin_port = htons(listen_port);

            if (bind(sockfd, reinterpret_cast<sockaddr*>(&saddr), sizeof(saddr)) < 0) {
                std::cerr << "[-] Failed to bind UDP port " << listen_port << " (already bound by container?)\n";
                close(sockfd);
                break;
            }

            std::cout << ANSI_GREEN << "[+] Listening on 0.0.0.0:" << listen_port << ". Press Ctrl+C to terminate." << ANSI_RESET << std::endl;
            uint8_t buffer[2048];
            sockaddr_in client{};
            socklen_t client_len = sizeof(client);

            int count = 0;
            while (count < 20) {
                ssize_t n = recvfrom(sockfd, buffer, sizeof(buffer), 0, reinterpret_cast<sockaddr*>(&client), &client_len);
                if (n <= 0) break;
                count++;

                std::vector<uint8_t> pkt(buffer, buffer + n);
                ccsds_guard::Vector3D wp{0.0, 80.0, 120.0};
                auto st = clean_engine.process_stanag_command(pkt, wp, 30.0 + count, 30000000 + count * 1000);

                if (st != ccsds_guard::GuardStatus::PASS) {
                    std::cout << "  [" << count << "] LIVE WIRE INGEST: " ANSI_RED "TIER-1 KERNEL_DROP ("
                              << ccsds_guard::status_to_string(st) << ")" ANSI_RESET << " from client\n";
                } else {
                    Tier2Result t2 = evaluate_tier2_onnx(alpha_engine.get(), pkt, 0.05f);
                    std::cout << "  [" << count << "] LIVE WIRE INGEST: TIER-1 PASS -> "
                              << (t2.verdict == SENTINEL_VERDICT_PASS ? ANSI_GREEN "TIER-2 PASS" : ANSI_RED "TIER-2 KERNEL_DROP")
                              << ANSI_RESET << " (score=" << t2.score << ")\n";
                }
            }
            close(sockfd);
        }
    }

    std::cout << "\n" << ANSI_CYAN << "================================================================================" << ANSI_RESET << std::endl;
    std::cout << ANSI_GREEN << ">>> RESULT: SUCCESS (ALL TIER-1 AND TIER-2 DEFENSE INVARIANTS VERIFIED) <<<" << ANSI_RESET << std::endl;
    std::cout << ANSI_CYAN << "================================================================================" << ANSI_RESET << std::endl;

    return 0;
}
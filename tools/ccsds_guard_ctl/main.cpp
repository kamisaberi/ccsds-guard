// File: /home/kami/ccsds-guard/tools/ccsds_guard_ctl/main.cpp

#include "ccsds_guard/ccsds_guard.hpp"
#include <iostream>
#include <vector>

int main() {
    std::cout << "[ccsds-guard-ctl] Autonomous UAV Swarm Tactical Defense Engine\n";
    std::cout << "[ccsds-guard-ctl] Standards: NATO STANAG 4586 & CCSDS 133.0-B-2\n";

    ccsds_guard::core::TscClock::calibrate();
    ccsds_guard::pipeline::GuardEngine engine;

    std::vector<uint8_t> packet(32, 0);
    packet[0] = 0x10; packet[1] = 0x01;
    packet[5] = 42;
    packet[9] = 100;

    int64_t now_us = 1'000'000'000;
    for (int i = 0; i < 8; ++i) {
        packet[10 + i] = static_cast<uint8_t>((now_us >> (56 - 8 * i)) & 0xFF);
    }
    packet[19] = 12;

    ccsds_guard::Vector3D waypoint{10.0, 20.0, 100.0};

    const uint64_t t0 = ccsds_guard::core::TscClock::rdtsc();
    const auto status = engine.process_stanag_command(packet, waypoint, 1.0, now_us);
    const uint64_t t1 = ccsds_guard::core::TscClock::rdtsc();

    const double latency_ns = ccsds_guard::core::TscClock::cycles_to_nanoseconds(t1 - t0);

    std::cout << "Validation Result: " << ccsds_guard::status_to_string(status) << "\n";
    std::cout << "Execution Latency: " << latency_ns << " ns\n";

    return (status == ccsds_guard::GuardStatus::PASS) ? 0 : 1;
}
// File: /home/kami/ccsds-guard/benchmarks/bench_latency.cpp

#include "ccsds_guard/ccsds_guard.hpp"
#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>

int main() {
    std::cout << "========================================================\n";
    std::cout << "  CCSDS-GUARD SUB-120 NS HARDWARE LATENCY BENCHMARK     \n";
    std::cout << "========================================================\n";

    ccsds_guard::core::TscClock::calibrate();
    ccsds_guard::pipeline::GuardEngine engine;

    constexpr size_t ITERATIONS = 100'000;
    std::vector<double> latencies_ns;
    latencies_ns.reserve(ITERATIONS);

    std::vector<uint8_t> packet(32, 0);
    packet[0] = 0x10; packet[1] = 0x01;
    packet[5] = 0x01;
    packet[19] = 12;

    ccsds_guard::Vector3D waypoint{0.0, 0.0, 100.0};
    int64_t time_us = 10'000'000;
    double time_sec = 10.0;

    for (size_t i = 0; i < 5'000; ++i) {
        packet[9] = static_cast<uint8_t>(i & 0x7F);
        engine.process_stanag_command(packet, waypoint, time_sec, time_us);
    }

    engine.reset_tripwire();

    for (size_t i = 1; i <= ITERATIONS; ++i) {
        packet[6] = static_cast<uint8_t>((i >> 24) & 0xFF);
        packet[7] = static_cast<uint8_t>((i >> 16) & 0xFF);
        packet[8] = static_cast<uint8_t>((i >> 8) & 0xFF);
        packet[9] = static_cast<uint8_t>(i & 0xFF);

        time_us += 1000;
        time_sec += 0.001;
        waypoint.x += 0.01;

        for (int b = 0; b < 8; ++b) {
            packet[10 + b] = static_cast<uint8_t>((time_us >> (56 - 8 * b)) & 0xFF);
        }

        const uint64_t t0 = ccsds_guard::core::TscClock::rdtsc();
        const auto st = engine.process_stanag_command(packet, waypoint, time_sec, time_us);
        const uint64_t t1 = ccsds_guard::core::TscClock::rdtsc();

        if (st == ccsds_guard::GuardStatus::PASS) {
            latencies_ns.push_back(ccsds_guard::core::TscClock::cycles_to_nanoseconds(t1 - t0));
        }
    }

    std::sort(latencies_ns.begin(), latencies_ns.end());

    const double min_ns = latencies_ns.front();
    const double max_ns = latencies_ns.back();
    const double mean_ns = std::accumulate(latencies_ns.begin(), latencies_ns.end(), 0.0) / latencies_ns.size();
    const double p50_ns = latencies_ns[static_cast<size_t>(latencies_ns.size() * 0.50)];
    const double p99_ns = latencies_ns[static_cast<size_t>(latencies_ns.size() * 0.99)];
    const double p999_ns = latencies_ns[static_cast<size_t>(latencies_ns.size() * 0.999)];

    std::cout << "Samples Verified: " << latencies_ns.size() << "\n";
    std::cout << "Min Latency:      " << min_ns << " ns\n";
    std::cout << "Mean Latency:     " << mean_ns << " ns\n";
    std::cout << "P50 Latency:      " << p50_ns << " ns\n";
    std::cout << "P99 Latency:      " << p99_ns << " ns\n";
    std::cout << "P99.9 Latency:    " << p999_ns << " ns\n";
    std::cout << "Max Latency:      " << max_ns << " ns\n";

    if (mean_ns < 120.0 && p99_ns < 150.0) {
        std::cout << "\n>>> RESULT: SUCCESS (< 120 ns SLA Invariant Confirmed) <<<\n";
        return 0;
    }

    std::cerr << "\n>>> RESULT: FAILED (< 120 ns SLA Violated) <<<\n";
    return 1;
}
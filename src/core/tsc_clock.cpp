// File: /home/kami/ccsds-guard/src/core/tsc_clock.cpp

#include "ccsds_guard/core/tsc_clock.hpp"
#include <ctime>
#include <thread>
#include <chrono>

namespace ccsds_guard::core {

void TscClock::calibrate() noexcept {
    if (calibrated_) return;

    timespec ts_start{}, ts_end{};
    clock_gettime(CLOCK_MONOTONIC_RAW, &ts_start);
    const uint64_t tsc_start = rdtsc();

    std::this_thread::sleep_for(std::chrono::milliseconds(10));

    clock_gettime(CLOCK_MONOTONIC_RAW, &ts_end);
    const uint64_t tsc_end = rdtsc();

    const double elapsed_ns = static_cast<double>(ts_end.tv_sec - ts_start.tv_sec) * 1e9 +
                              static_cast<double>(ts_end.tv_nsec - ts_start.tv_nsec);
    const double elapsed_cycles = static_cast<double>(tsc_end - tsc_start);

    if (elapsed_cycles > 0.0 && elapsed_ns > 0.0) {
        ns_per_cycle_ = elapsed_ns / elapsed_cycles;
        calibrated_ = true;
    }
}

double TscClock::cycles_to_nanoseconds(uint64_t cycles) noexcept {
    return static_cast<double>(cycles) * ns_per_cycle_;
}

} // namespace ccsds_guard::core
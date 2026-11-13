// File: /home/kami/ccsds-guard/include/ccsds_guard/core/tsc_clock.hpp

#pragma once

#include <cstdint>
#include <x86intrin.h>

namespace ccsds_guard::core {

class TscClock {
public:
    static void calibrate() noexcept;

    [[nodiscard]] static inline uint64_t rdtsc() noexcept {
        unsigned int aux;
        return __rdtscp(&aux);
    }

    [[nodiscard]] static double cycles_to_nanoseconds(uint64_t cycles) noexcept;

private:
    static inline double ns_per_cycle_{0.333333};
    static inline bool calibrated_{false};
};

} // namespace ccsds_guard::core
// File: /home/kami/ccsds-guard/include/ccsds_guard/defense/telemetry_desync.hpp

#pragma once

#include <cstdint>

namespace ccsds_guard::defense {

class alignas(64) TelemetryDesyncDetector {
public:
    static constexpr int64_t MAX_ALLOWED_JITTER_US = 500'000;

    [[nodiscard]] static bool is_synchronized(int64_t reported_timestamp_us,
                                             int64_t reference_monotonic_us) noexcept {
        const int64_t delta = (reported_timestamp_us > reference_monotonic_us) ?
                              (reported_timestamp_us - reference_monotonic_us) :
                              (reference_monotonic_us - reported_timestamp_us);
        return delta <= MAX_ALLOWED_JITTER_US;
    }
};

} // namespace ccsds_guard::defense
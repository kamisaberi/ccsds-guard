// File: /home/kami/ccsds-guard/include/ccsds_guard/defense/gps_spoof_detector.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"

namespace ccsds_guard::defense {

class alignas(64) GpsSpoofDetector {
public:
    struct alignas(16) Config {
        double max_velocity_mps{80.0};
        double max_acceleration_mps2{30.0};
    };

    constexpr GpsSpoofDetector() noexcept = default;
    explicit constexpr GpsSpoofDetector(const Config& cfg) noexcept : cfg_(cfg) {}

    [[nodiscard]] bool validate_kinematics(const Vector3D& new_pos,
                                          double current_time_sec) noexcept;
    void reset() noexcept;

private:
    Config cfg_{};
    Vector3D last_pos_{};
    Vector3D last_vel_{};
    double last_time_sec_{0.0};
    bool initialized_{false};
};

} // namespace ccsds_guard::defense
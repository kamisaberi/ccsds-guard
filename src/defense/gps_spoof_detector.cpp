// File: /home/kami/ccsds-guard/src/defense/gps_spoof_detector.cpp

#include "ccsds_guard/defense/gps_spoof_detector.hpp"
#include <cmath>

namespace ccsds_guard::defense {

bool GpsSpoofDetector::validate_kinematics(const Vector3D& new_pos,
                                          double current_time_sec) noexcept {
    if (!initialized_) {
        last_pos_ = new_pos;
        last_time_sec_ = current_time_sec;
        last_vel_ = {0.0, 0.0, 0.0};
        initialized_ = true;
        return true;
    }

    const double dt = current_time_sec - last_time_sec_;
    if (dt <= 0.000001) {
        return (last_pos_.distance_squared_to(new_pos) < 0.001);
    }

    const double dist_sq = last_pos_.distance_squared_to(new_pos);
    const double max_allowed_dist = cfg_.max_velocity_mps * dt +
                                    0.5 * cfg_.max_acceleration_mps2 * dt * dt;

    if (dist_sq > (max_allowed_dist * max_allowed_dist)) {
        return false;
    }

    last_vel_ = { (new_pos.x - last_pos_.x) / dt,
                  (new_pos.y - last_pos_.y) / dt,
                  (new_pos.z - last_pos_.z) / dt };
    last_pos_ = new_pos;
    last_time_sec_ = current_time_sec;
    return true;
}

void GpsSpoofDetector::reset() noexcept {
    last_pos_ = {0.0, 0.0, 0.0};
    last_vel_ = {0.0, 0.0, 0.0};
    last_time_sec_ = 0.0;
    initialized_ = false;
}

} // namespace ccsds_guard::defense
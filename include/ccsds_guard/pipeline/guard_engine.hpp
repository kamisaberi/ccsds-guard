// File: /home/kami/ccsds-guard/include/ccsds_guard/pipeline/guard_engine.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"
#include "ccsds_guard/ccsds/tc_frame.hpp"
#include "ccsds_guard/ccsds/sec_frame.hpp"
#include "ccsds_guard/stanag/stanag4586_dli.hpp"
#include "ccsds_guard/defense/sliding_window.hpp"
#include "ccsds_guard/defense/gps_spoof_detector.hpp"
#include "ccsds_guard/defense/telemetry_desync.hpp"
#include "ccsds_guard/defense/actuator_airgap.hpp"
#include <span>

namespace ccsds_guard::pipeline {

class GuardEngine {
public:
    GuardEngine() noexcept = default;

    [[nodiscard]] GuardStatus process_stanag_command(
        std::span<const uint8_t> packet,
        const Vector3D& target_waypoint,
        double current_time_sec,
        int64_t system_time_us) noexcept;

    [[nodiscard]] GuardStatus process_ccsds_frame(
        std::span<const uint8_t> frame) noexcept;

    void reset_tripwire() noexcept { airgap_.reset(); }
    [[nodiscard]] bool is_airgap_tripped() const noexcept { return airgap_.is_tripped(); }

private:
    defense::SlidingWindow replay_window_{};
    defense::GpsSpoofDetector gps_detector_{};
    defense::ActuatorAirGap airgap_{};
};

} // namespace ccsds_guard::pipeline
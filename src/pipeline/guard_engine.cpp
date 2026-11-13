// File: /home/kami/ccsds-guard/src/pipeline/guard_engine.cpp

#include "ccsds_guard/pipeline/guard_engine.hpp"

namespace ccsds_guard::pipeline {

GuardStatus GuardEngine::process_stanag_command(
    std::span<const uint8_t> packet,
    const Vector3D& target_waypoint,
    double current_time_sec,
    int64_t system_time_us) noexcept {

    if (airgap_.is_tripped()) {
        return GuardStatus::ACTUATOR_AIRGAP_TRIPPED;
    }

    stanag::Stanag4586Header hdr{};
    if (!stanag::Stanag4586Parser::parse(packet, hdr)) {
        return GuardStatus::INVALID_PAYLOAD_SIZE;
    }

    if (!defense::TelemetryDesyncDetector::is_synchronized(hdr.timestamp_us, system_time_us)) {
        airgap_.trip();
        return GuardStatus::REJECT_TELEMETRY_DESYNC;
    }

    if (!replay_window_.check_and_update(hdr.sequence_id)) {
        return GuardStatus::REJECT_REPLAY;
    }

    if (!gps_detector_.validate_kinematics(target_waypoint, current_time_sec)) {
        airgap_.trip();
        return GuardStatus::REJECT_GPS_SPOOF_KINEMATICS;
    }

    return GuardStatus::PASS;
}

GuardStatus GuardEngine::process_ccsds_frame(
    std::span<const uint8_t> frame) noexcept {

    if (airgap_.is_tripped()) {
        return GuardStatus::ACTUATOR_AIRGAP_TRIPPED;
    }

    ccsds::TcPrimaryHeader hdr{};
    uint16_t scid{0}, len{0};
    uint8_t vcid{0};

    if (!ccsds::TcFrameParser::parse(frame, hdr, scid, vcid, len)) {
        return GuardStatus::INVALID_PAYLOAD_SIZE;
    }

    if (!replay_window_.check_and_update(hdr.frame_seq_num)) {
        return GuardStatus::REJECT_REPLAY;
    }

    return GuardStatus::PASS;
}

} // namespace ccsds_guard::pipeline
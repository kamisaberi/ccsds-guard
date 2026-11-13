// File: /home/kami/ccsds-guard/include/ccsds_guard/core/types.hpp

#pragma once

#include <cstdint>
#include <cstddef>
#include <span>
#include <string_view>

namespace ccsds_guard {

enum class GuardStatus : uint8_t {
    PASS = 0x00,
    REJECT_REPLAY = 0x01,
    REJECT_OUT_OF_WINDOW = 0x02,
    REJECT_CORRUPTED_CRC = 0x03,
    REJECT_SECURITY_AUTH_FAIL = 0x04,
    REJECT_GPS_SPOOF_KINEMATICS = 0x05,
    REJECT_TELEMETRY_DESYNC = 0x06,
    ACTUATOR_AIRGAP_TRIPPED = 0x07,
    INVALID_PAYLOAD_SIZE = 0x08
};

[[nodiscard]] constexpr std::string_view status_to_string(GuardStatus st) noexcept {
    switch (st) {
        case GuardStatus::PASS: return "PASS";
        case GuardStatus::REJECT_REPLAY: return "REJECT_REPLAY";
        case GuardStatus::REJECT_OUT_OF_WINDOW: return "REJECT_OUT_OF_WINDOW";
        case GuardStatus::REJECT_CORRUPTED_CRC: return "REJECT_CORRUPTED_CRC";
        case GuardStatus::REJECT_SECURITY_AUTH_FAIL: return "REJECT_SECURITY_AUTH_FAIL";
        case GuardStatus::REJECT_GPS_SPOOF_KINEMATICS: return "REJECT_GPS_SPOOF_KINEMATICS";
        case GuardStatus::REJECT_TELEMETRY_DESYNC: return "REJECT_TELEMETRY_DESYNC";
        case GuardStatus::ACTUATOR_AIRGAP_TRIPPED: return "ACTUATOR_AIRGAP_TRIPPED";
        case GuardStatus::INVALID_PAYLOAD_SIZE: return "INVALID_PAYLOAD_SIZE";
    }
    return "UNKNOWN_STATUS";
}

template <typename T>
[[nodiscard]] constexpr T read_be(const uint8_t* ptr) noexcept {
    T val{};
    for (size_t i = 0; i < sizeof(T); ++i) {
        val = static_cast<T>((val << 8) | ptr[i]);
    }
    return val;
}

struct alignas(16) Vector3D {
    double x{0.0};
    double y{0.0};
    double z{0.0};

    [[nodiscard]] constexpr double distance_squared_to(const Vector3D& other) const noexcept {
        const double dx = x - other.x;
        const double dy = y - other.y;
        const double dz = z - other.z;
        return (dx * dx) + (dy * dy) + (dz * dz);
    }
};

} // namespace ccsds_guard
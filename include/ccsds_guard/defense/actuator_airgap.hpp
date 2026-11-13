// File: /home/kami/ccsds-guard/include/ccsds_guard/defense/actuator_airgap.hpp

#pragma once

#include <cstdint>

namespace ccsds_guard::defense {

class alignas(64) ActuatorAirGap {
public:
    enum class State : uint8_t {
        DISENGAGED = 0x00,
        TRIPPED = 0x01
    };

    constexpr ActuatorAirGap() noexcept : state_(State::DISENGAGED), total_trips_(0) {}

    [[nodiscard]] inline bool is_tripped() const noexcept {
        return state_ == State::TRIPPED;
    }

    inline void trip() noexcept {
        state_ = State::TRIPPED;
        total_trips_++;
    }

    inline void reset() noexcept {
        state_ = State::DISENGAGED;
    }

    [[nodiscard]] uint64_t total_trips() const noexcept {
        return total_trips_;
    }

private:
    State state_{State::DISENGAGED};
    uint64_t total_trips_{0};
};

} // namespace ccsds_guard::defense
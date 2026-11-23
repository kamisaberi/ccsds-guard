// File: /home/kami/ccsds-guard/include/ccsds_guard/defense/rover_slip_cbf.hpp

#pragma once

#include <cstdint>
#include <string_view>

namespace ccsds_guard::defense {

enum class RoverSlipStatus : uint8_t {
    PASS = 0,
    REJECT_INVALID_TELEMETRY,
    REJECT_EXCESSIVE_WHEEL_SLIP,
    REJECT_TRACTION_LOSS,
    REJECT_CRITICAL_TIP_ANGLE
};

[[nodiscard]] constexpr std::string_view rover_status_to_string(RoverSlipStatus st) noexcept {
    switch (st) {
        case RoverSlipStatus::PASS:                        return "PASS";
        case RoverSlipStatus::REJECT_INVALID_TELEMETRY:    return "REJECT_INVALID_TELEMETRY";
        case RoverSlipStatus::REJECT_EXCESSIVE_WHEEL_SLIP: return "REJECT_EXCESSIVE_WHEEL_SLIP";
        case RoverSlipStatus::REJECT_TRACTION_LOSS:        return "REJECT_TRACTION_LOSS";
        case RoverSlipStatus::REJECT_CRITICAL_TIP_ANGLE:   return "REJECT_CRITICAL_TIP_ANGLE";
    }
    return "UNKNOWN";
}

struct SoilBurckhardtParams {
    // Default: Lunar/Martian loose granular regolith
    double c1{0.52};
    double c2{12.0};
    double c3{0.18};
    double gravity_mps2{3.721}; // Mars gravity (Moon: 1.625, Earth: 9.81)
};

struct RoverTerrainState {
    double vx_mps{0.25};         // Measured linear ground velocity
    double wheel_v_mps{0.28};    // Commanded wheel rim velocity (omega * r_w)
    double pitch_deg{5.0};       // Longitudinal slope pitch angle
    double roll_deg{2.0};        // Lateral cross-slope roll angle
    double pitch_rate_dps{0.0};  // Pitch angular velocity (deg/s)
    double roll_rate_dps{0.0};   // Roll angular velocity (deg/s)
};

struct RoverSafetyLimits {
    double max_slip_ratio{0.65};    // > 65% slip risks wheel sinkage/bog-down
    double min_traction_mu{0.12};   // Minimum granular traction on grade
    double critical_tip_deg{32.0};  // Static rollover stability envelope
    double nagumo_alpha{2.0};       // CBF convergence gain
};

class RoverSlipDetector {
public:
    /// Burckhardt granular-soil friction curve: mu(lambda) = c1*(1 - exp(-c2*|lambda|)) - c3*|lambda|
    [[nodiscard]] static double compute_burckhardt_mu(
        double slip_ratio,
        const SoilBurckhardtParams& soil = {}) noexcept;

    /// Longitudinal wheel slip ratio: (v_wheel - v_x) / max(|v_wheel|, |v_x|, 1e-3)
    [[nodiscard]] static double compute_slip_ratio(double wheel_v_mps, double vx_mps) noexcept;

    /// 4th-Order Runge-Kutta (RK4) integration of rover longitudinal & attitude slope dynamics
    static void step_rk4(
        RoverTerrainState& state,
        double dt_sec,
        const SoilBurckhardtParams& soil = {}) noexcept;

    /// Evaluates wheel slip, Burckhardt traction, and Nagumo tipping-angle CBF (h_tip >= 0)
    [[nodiscard]] static RoverSlipStatus evaluate(
        const RoverTerrainState& state,
        const RoverSafetyLimits& limits = {},
        const SoilBurckhardtParams& soil = {}) noexcept;
};

} // namespace ccsds_guard::defense
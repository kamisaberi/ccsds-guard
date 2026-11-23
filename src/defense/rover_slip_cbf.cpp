// File: /home/kami/ccsds-guard/src/defense/rover_slip_cbf.cpp

#include "ccsds_guard/defense/rover_slip_cbf.hpp"
#include <algorithm>
#include <cmath>

namespace ccsds_guard::defense {

static constexpr double kDegToRad = 3.14159265358979323846 / 180.0;

double RoverSlipDetector::compute_slip_ratio(double wheel_v_mps, double vx_mps) noexcept {
    const double denom = std::max({std::abs(wheel_v_mps), std::abs(vx_mps), 1e-3});
    return (wheel_v_mps - vx_mps) / denom;
}

double RoverSlipDetector::compute_burckhardt_mu(double slip_ratio, const SoilBurckhardtParams& soil) noexcept {
    const double s = std::clamp(std::abs(slip_ratio), 0.0, 1.0);
    const double mu = soil.c1 * (1.0 - std::exp(-soil.c2 * s)) - soil.c3 * s;
    return std::max(0.0, mu);
}

static double accel_x_dynamics(double vx, double wheel_v, double pitch_deg, const SoilBurckhardtParams& soil) noexcept {
    const double slip = RoverSlipDetector::compute_slip_ratio(wheel_v, vx);
    const double mu = RoverSlipDetector::compute_burckhardt_mu(slip, soil);
    const double rad = pitch_deg * kDegToRad;
    const double dir = (slip >= 0.0) ? 1.0 : -1.0;
    return soil.gravity_mps2 * (dir * mu * std::cos(rad) - std::sin(rad));
}

void RoverSlipDetector::step_rk4(
    RoverTerrainState& state,
    double dt_sec,
    const SoilBurckhardtParams& soil) noexcept
{
    if (!std::isfinite(dt_sec) || dt_sec <= 0.0) return;

    const double k1 = accel_x_dynamics(state.vx_mps, state.wheel_v_mps, state.pitch_deg, soil);
    const double k2 = accel_x_dynamics(state.vx_mps + 0.5 * dt_sec * k1, state.wheel_v_mps, state.pitch_deg, soil);
    const double k3 = accel_x_dynamics(state.vx_mps + 0.5 * dt_sec * k2, state.wheel_v_mps, state.pitch_deg, soil);
    const double k4 = accel_x_dynamics(state.vx_mps + dt_sec * k3, state.wheel_v_mps, state.pitch_deg, soil);

    state.vx_mps += (dt_sec / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
    state.pitch_deg += state.pitch_rate_dps * dt_sec;
    state.roll_deg  += state.roll_rate_dps * dt_sec;
}

RoverSlipStatus RoverSlipDetector::evaluate(
    const RoverTerrainState& state,
    const RoverSafetyLimits& limits,
    const SoilBurckhardtParams& soil) noexcept
{
    if (!std::isfinite(state.vx_mps) || !std::isfinite(state.wheel_v_mps) ||
        !std::isfinite(state.pitch_deg) || !std::isfinite(state.roll_deg) ||
        !std::isfinite(state.pitch_rate_dps) || !std::isfinite(state.roll_rate_dps)) {
        return RoverSlipStatus::REJECT_INVALID_TELEMETRY;
    }

    // 1. Critical Rollover / Tipping-Angle Nagumo CBF: h_tip = theta_crit - ||theta|| >= 0
    const double tilt_deg = std::hypot(state.pitch_deg, state.roll_deg);
    const double h_tip = limits.critical_tip_deg - tilt_deg;
    const double tilt_dot = (tilt_deg > 1e-6)
                                ? ((state.pitch_deg * state.pitch_rate_dps + state.roll_deg * state.roll_rate_dps) / tilt_deg)
                                : std::hypot(state.pitch_rate_dps, state.roll_rate_dps);
    const double h_tip_dot = -tilt_dot;

    if (h_tip < 0.0 || (h_tip_dot + limits.nagumo_alpha * h_tip) < 0.0) {
        return RoverSlipStatus::REJECT_CRITICAL_TIP_ANGLE;
    }

    // 2. Longitudinal Wheel Slip & Burckhardt Granular Soil Traction Check
    const double slip = compute_slip_ratio(state.wheel_v_mps, state.vx_mps);
    if (std::abs(slip) > limits.max_slip_ratio) {
        return RoverSlipStatus::REJECT_EXCESSIVE_WHEEL_SLIP;
    }

    const double mu = compute_burckhardt_mu(slip, soil);
    if (std::abs(state.pitch_deg) > 10.0 && mu < limits.min_traction_mu) {
        return RoverSlipStatus::REJECT_TRACTION_LOSS;
    }

    return RoverSlipStatus::PASS;
}

} // namespace ccsds_guard::defense
// File: /home/kami/ccsds-guard/tests/test_rover_slip.cpp

#include "ccsds_guard/defense/rover_slip_cbf.hpp"
#include <cassert>
#include <iostream>

int main()
{
    std::cout << "[TEST] Planetary Rover Granular-Soil Wheel-Slip RK4 & Tipping CBF... ";

    using namespace ccsds_guard::defense;

    // 1. Nominal Martian regolith traverse (5 deg slope, low slip)
    RoverTerrainState nom{0.25, 0.30, 5.0, 2.0, 0.0, 0.0};
    for (int i = 0; i < 10; ++i) RoverSlipDetector::step_rk4(nom, 0.05);
    assert(RoverSlipDetector::evaluate(nom) == RoverSlipStatus::PASS);

    // 2. Wheel sinkage / excessive slip (85% slip > 65%)
    RoverTerrainState stuck{0.05, 0.40, 8.0, 1.0, 0.0, 0.0};
    assert(RoverSlipDetector::evaluate(stuck) == RoverSlipStatus::REJECT_EXCESSIVE_WHEEL_SLIP);

    // 3. Critical tipping-angle Nagumo CBF breach (30 deg pitch + +8 deg/s pitch rate -> rollover!)
    RoverTerrainState tipping{0.20, 0.25, 30.0, 0.0, 8.0, 0.0};
    assert(RoverSlipDetector::evaluate(tipping) == RoverSlipStatus::REJECT_CRITICAL_TIP_ANGLE);

    std::cout << "PASSED\n";
    return 0;
}
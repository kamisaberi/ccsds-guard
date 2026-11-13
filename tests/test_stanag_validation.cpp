// File: /home/kami/ccsds-guard/tests/test_stanag_validation.cpp

#include "ccsds_guard/pipeline/guard_engine.hpp"
#include <cassert>
#include <iostream>
#include <vector>

int main() {
    std::cout << "[TEST] NATO STANAG 4586 Kinematic & Air-Gap Tripping... ";

    ccsds_guard::pipeline::GuardEngine engine;

    std::vector<uint8_t> packet(32, 0);
    packet[0] = 0x10; packet[1] = 0x01;
    packet[5] = 1;
    packet[9] = 1;
    int64_t now_us = 10'000'000;
    for (int i = 0; i < 8; ++i) packet[10 + i] = (now_us >> (56 - 8 * i)) & 0xFF;
    packet[19] = 12;

    ccsds_guard::Vector3D p1{0.0, 0.0, 100.0};
    auto st = engine.process_stanag_command(packet, p1, 10.0, now_us);
    assert(st == ccsds_guard::GuardStatus::PASS);

    packet[9] = 2;
    now_us += 100'000;
    for (int i = 0; i < 8; ++i) packet[10 + i] = (now_us >> (56 - 8 * i)) & 0xFF;
    ccsds_guard::Vector3D p_spoofed{5000.0, 0.0, 100.0};

    st = engine.process_stanag_command(packet, p_spoofed, 10.1, now_us);
    assert(st == ccsds_guard::GuardStatus::REJECT_GPS_SPOOF_KINEMATICS);
    assert(engine.is_airgap_tripped() == true);

    packet[9] = 3;
    st = engine.process_stanag_command(packet, p1, 10.2, now_us + 100'000);
    assert(st == ccsds_guard::GuardStatus::ACTUATOR_AIRGAP_TRIPPED);

    std::cout << "PASSED\n";
    return 0;
}
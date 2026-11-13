// File: /home/kami/ccsds-guard/tests/test_replay_window.cpp

#include "ccsds_guard/defense/sliding_window.hpp"
#include <cassert>
#include <iostream>

int main() {
    std::cout << "[TEST] 128-bit Sliding-Window Anti-Replay Monotonicity... ";

    ccsds_guard::defense::SlidingWindow window;

    assert(window.check_and_update(100) == true);
    assert(window.check_and_update(101) == true);
    assert(window.check_and_update(102) == true);

    assert(window.check_and_update(101) == false);
    assert(window.check_and_update(100) == false);

    assert(window.check_and_update(110) == true);
    assert(window.check_and_update(105) == true);
    assert(window.check_and_update(105) == false);

    assert(window.check_and_update(300) == true);
    assert(window.check_and_update(110) == false);

    std::cout << "PASSED\n";
    return 0;
}
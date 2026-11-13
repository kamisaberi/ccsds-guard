// File: /home/kami/ccsds-guard/include/ccsds_guard/defense/sliding_window.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"
#include <cstdint>

namespace ccsds_guard::defense {

class alignas(64) SlidingWindow {
public:
    static constexpr uint32_t WINDOW_SIZE = 128;

    constexpr SlidingWindow() noexcept : highest_seq_(0), mask_low_(0), mask_high_(0), initialized_(false) {}

    [[nodiscard]] bool check_and_update(uint32_t seq) noexcept;
    void reset() noexcept;
    [[nodiscard]] uint32_t get_highest_seq() const noexcept { return highest_seq_; }

private:
    uint32_t highest_seq_{0};
    uint64_t mask_low_{0};
    uint64_t mask_high_{0};
    bool initialized_{false};
};

} // namespace ccsds_guard::defense
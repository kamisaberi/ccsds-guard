// File: /home/kami/ccsds-guard/src/defense/sliding_window.cpp

#include "ccsds_guard/defense/sliding_window.hpp"

namespace ccsds_guard::defense {

bool SlidingWindow::check_and_update(uint32_t seq) noexcept {
    if (!initialized_) {
        highest_seq_ = seq;
        mask_low_ = 1ULL;
        mask_high_ = 0ULL;
        initialized_ = true;
        return true;
    }

    if (seq > highest_seq_) {
        const uint32_t delta = seq - highest_seq_;
        if (delta >= WINDOW_SIZE) {
            mask_low_ = 1ULL;
            mask_high_ = 0ULL;
        } else if (delta < 64) {
            mask_high_ = (mask_high_ << delta) | (mask_low_ >> (64 - delta));
            mask_low_ = (mask_low_ << delta) | 1ULL;
        } else {
            const uint32_t rem = delta - 64;
            mask_high_ = (mask_low_ << rem);
            mask_low_ = 1ULL;
        }
        highest_seq_ = seq;
        return true;
    }

    const uint32_t age = highest_seq_ - seq;
    if (age >= WINDOW_SIZE) {
        return false;
    }

    if (age < 64) {
        const uint64_t bit = (1ULL << age);
        if (mask_low_ & bit) {
            return false;
        }
        mask_low_ |= bit;
    } else {
        const uint64_t bit = (1ULL << (age - 64));
        if (mask_high_ & bit) {
            return false;
        }
        mask_high_ |= bit;
    }

    return true;
}

void SlidingWindow::reset() noexcept {
    highest_seq_ = 0;
    mask_low_ = 0;
    mask_high_ = 0;
    initialized_ = false;
}

} // namespace ccsds_guard::defense
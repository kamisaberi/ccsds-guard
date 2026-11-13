// File: /home/kami/ccsds-guard/include/ccsds_guard/ccsds/tc_frame.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"
#include <span>

namespace ccsds_guard::ccsds {

#pragma pack(push, 1)
struct TcPrimaryHeader {
    uint16_t flags_scid;
    uint16_t vcid_frame_len;
    uint8_t  frame_seq_num;
};
#pragma pack(pop)

class TcFrameParser {
public:
    static constexpr size_t MIN_TC_FRAME_LEN = 5 + 2;

    [[nodiscard]] static bool parse(std::span<const uint8_t> frame,
                                   TcPrimaryHeader& out_hdr,
                                   uint16_t& out_scid,
                                   uint8_t& out_vcid,
                                   uint16_t& out_len) noexcept;

    [[nodiscard]] static uint16_t compute_crc16_ccitt(std::span<const uint8_t> data) noexcept;
};

} // namespace ccsds_guard::ccsds
// File: /home/kami/ccsds-guard/src/ccsds/tc_frame.cpp

#include "ccsds_guard/ccsds/tc_frame.hpp"

namespace ccsds_guard::ccsds {

bool TcFrameParser::parse(std::span<const uint8_t> frame,
                          TcPrimaryHeader& out_hdr,
                          uint16_t& out_scid,
                          uint8_t& out_vcid,
                          uint16_t& out_len) noexcept {
    if (frame.size() < MIN_TC_FRAME_LEN) {
        return false;
    }

    out_hdr.flags_scid = read_be<uint16_t>(frame.data());
    out_hdr.vcid_frame_len = read_be<uint16_t>(frame.data() + 2);
    out_hdr.frame_seq_num = frame[4];

    out_scid = out_hdr.flags_scid & 0x03FF;
    out_vcid = static_cast<uint8_t>((out_hdr.vcid_frame_len >> 10) & 0x3F);
    out_len = (out_hdr.vcid_frame_len & 0x03FF) + 1;

    return (frame.size() >= out_len);
}

uint16_t TcFrameParser::compute_crc16_ccitt(std::span<const uint8_t> data) noexcept {
    uint16_t crc = 0xFFFF;
    for (uint8_t byte : data) {
        crc ^= static_cast<uint16_t>(byte << 8);
        for (int i = 0; i < 8; ++i) {
            if (crc & 0x8000) {
                crc = static_cast<uint16_t>((crc << 1) ^ 0x1021);
            } else {
                crc = static_cast<uint16_t>(crc << 1);
            }
        }
    }
    return crc;
}

} // namespace ccsds_guard::ccsds
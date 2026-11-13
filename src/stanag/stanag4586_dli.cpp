// File: /home/kami/ccsds-guard/src/stanag/stanag4586_dli.cpp

#include "ccsds_guard/stanag/stanag4586_dli.hpp"

namespace ccsds_guard::stanag {

bool Stanag4586Parser::parse(std::span<const uint8_t> packet,
                             Stanag4586Header& out_hdr) noexcept {
    if (packet.size() < HEADER_LEN) {
        return false;
    }

    out_hdr.message_type = read_be<uint16_t>(packet.data());
    out_hdr.vehicle_id = read_be<uint32_t>(packet.data() + 2);
    out_hdr.sequence_id = read_be<uint32_t>(packet.data() + 6);
    out_hdr.timestamp_us = read_be<uint64_t>(packet.data() + 10);
    out_hdr.payload_len = read_be<uint16_t>(packet.data() + 18);

    return (packet.size() >= (HEADER_LEN + out_hdr.payload_len));
}

} // namespace ccsds_guard::stanag
// File: /home/kami/ccsds-guard/src/ccsds/sec_frame.cpp

#include "ccsds_guard/ccsds/sec_frame.hpp"

namespace ccsds_guard::ccsds {

bool SecFrame133::parse_security_header(std::span<const uint8_t> payload,
                                        SecurityHeader133& out_hdr) noexcept {
    if (payload.size() < (SEC_HEADER_LEN + MAC_LEN)) {
        return false;
    }

    out_hdr.spi = read_be<uint16_t>(payload.data());
    out_hdr.iv_seq_counter = read_be<uint32_t>(payload.data() + 2);

    return (out_hdr.spi != 0x0000);
}

} // namespace ccsds_guard::ccsds
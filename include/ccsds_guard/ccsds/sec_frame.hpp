// File: /home/kami/ccsds-guard/include/ccsds_guard/ccsds/sec_frame.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"
#include <span>

namespace ccsds_guard::ccsds {

#pragma pack(push, 1)
struct SecurityHeader133 {
    uint16_t spi;
    uint32_t iv_seq_counter;
};
#pragma pack(pop)

class SecFrame133 {
public:
    static constexpr size_t SEC_HEADER_LEN = sizeof(SecurityHeader133);
    static constexpr size_t MAC_LEN = 16;

    [[nodiscard]] static bool parse_security_header(std::span<const uint8_t> payload,
                                                   SecurityHeader133& out_hdr) noexcept;
};

} // namespace ccsds_guard::ccsds
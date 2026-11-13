// File: /home/kami/ccsds-guard/include/ccsds_guard/stanag/stanag4586_dli.hpp

#pragma once

#include "ccsds_guard/core/types.hpp"
#include <span>

namespace ccsds_guard::stanag {

#pragma pack(push, 1)
struct Stanag4586Header {
    uint16_t message_type;
    uint32_t vehicle_id;
    uint32_t sequence_id;
    uint64_t timestamp_us;
    uint16_t payload_len;
};
#pragma pack(pop)

class Stanag4586Parser {
public:
    static constexpr size_t HEADER_LEN = sizeof(Stanag4586Header);

    [[nodiscard]] static bool parse(std::span<const uint8_t> packet,
                                   Stanag4586Header& out_hdr) noexcept;
};

} // namespace ccsds_guard::stanag
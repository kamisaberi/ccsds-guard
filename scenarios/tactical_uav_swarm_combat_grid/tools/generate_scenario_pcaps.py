#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/generate_scenario_pcaps.py
# ==============================================================================
# ARYORITHM TECHNOLOGIES B.V. — SCENARIO NOMINAL & ATTACK PCAP GENERATOR
# Produces Wireshark/libpcap-compliant Ethernet/IPv4/UDP .pcap captures
# ==============================================================================

import math
import socket
import struct
import time
from pathlib import Path


def ipv4_checksum(header: bytes) -> int:
    if len(header) % 2 == 1:
        header += b"\x00"
    s = sum(struct.unpack(f">{len(header)//2}H", header))
    while s >> 16:
        s = (s & 0xFFFF) + (s >> 16)
    return (~s) & 0xFFFF


def build_eth_ipv4_udp(src_ip: str, dst_ip: str, src_port: int, dst_port: int, payload: bytes) -> bytes:
    eth = b"\x02\x42\x0a\xf0\x34\x79" + b"\x02\x42\x0a\xf0\x34\x78" + struct.pack(">H", 0x0800)
    udp_len = 8 + len(payload)
    ip_total_len = 20 + udp_len

    ip_hdr_no_csum = struct.pack(
        ">BBHHHBBH4s4s",
        0x45, 0, ip_total_len, 0x1234, 0, 64, 17, 0,
        socket.inet_aton(src_ip), socket.inet_aton(dst_ip)
    )
    csum = ipv4_checksum(ip_hdr_no_csum)
    ip_hdr = struct.pack(
        ">BBHHHBBH4s4s",
        0x45, 0, ip_total_len, 0x1234, 0, 64, 17, csum,
        socket.inet_aton(src_ip), socket.inet_aton(dst_ip)
    )
    udp_hdr = struct.pack(">HHHH", src_port, dst_port, udp_len, 0)
    return eth + ip_hdr + udp_hdr + payload


def write_pcap(out_path: Path, packets):
    """packets: iterable of (rel_time_sec, raw_eth_frame_bytes)."""
    base_ts = int(time.time())
    with out_path.open("wb") as f:
        # Standard libpcap little-endian microsecond global header (24 bytes)
        f.write(struct.pack("<IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1))
        for rel_t, frame in packets:
            ts_sec = base_ts + int(rel_t)
            ts_usec = int((rel_t - int(rel_t)) * 1_000_000)
            f.write(struct.pack("<IIII", ts_sec, ts_usec, len(frame), len(frame)))
            f.write(frame)
    print(f"[+] Generated {out_path.name:<34} ({len(packets):>4} packets, {out_path.stat().st_size:>7} bytes)")


def main():
    pcaps_dir = Path(__file__).resolve().parent.parent / "pcaps"
    pcaps_dir.mkdir(parents=True, exist_ok=True)
    base_us = int(time.time() * 1e6)

    # 1. NOMINAL: 240 periodic steps (3 UAVs per step = 720 packets, 24s seamless loop)
    nominal_uav = []
    seq = 1000
    steps = 240
    for i in range(steps):
        t = i * 0.10
        phase = (2.0 * math.pi * i) / steps
        ax = math.sin(phase) * 160.0
        ay = math.cos(phase) * 110.0 + 40.0
        az = 120.0 + math.sin(phase * 2.0) * 4.5

        bx, by, bz = ax - 135.0, ay - 105.0, 118.0 + math.sin(phase * 2.0 + 1.0) * 4.0
        cx, cy, cz = ax + 135.0, ay - 105.0, 145.0 + math.sin(phase * 2.0 + 2.0) * 4.0

        for idx, (vid, ip, pos) in enumerate((
            (1, "10.240.52.121", (ax, ay, az)),
            (2, "10.240.52.123", (bx, by, bz)),
            (3, "10.240.52.124", (cx, cy, cz)),
        )):
            seq += 1
            now_us = base_us + int((t + idx * 0.005) * 1e6)
            payload = struct.pack(">HIIQHfff", 0x1001, vid, seq, now_us, 12, float(pos[0]), float(pos[1]), float(pos[2]))
            nominal_uav.append((t + idx * 0.005, build_eth_ipv4_udp("10.240.52.120", ip, 49152, 50050, payload)))
    write_pcap(pcaps_dir / "uav_nominal_flight.pcap", nominal_uav)

    # 2. NOMINAL: 120 periodic FLIR radiometric telemetry frames (12s seamless loop)
    nominal_flir = []
    for i in range(120):
        t = i * 0.10
        phase = (2.0 * math.pi * i) / 120.0
        az = 14.0 + math.sin(phase) * 18.0
        el = -28.0 + math.cos(phase) * 5.0
        lrf = 412.0 + math.sin(phase * 2.0) * 14.0
        peak_c = 38.5 + math.sin(phase * 2.0) * 1.4
        sat_pct = 4.2 + math.cos(phase) * 0.6
        payload = struct.pack(">4sfffff", b"FLIR", az, el, lrf, peak_c, sat_pct)
        nominal_flir.append((t, build_eth_ipv4_udp("10.240.52.132", "10.240.52.124", 49160, 50050, payload)))
    write_pcap(pcaps_dir / "flir_thermal_baseline.pcap", nominal_flir)

    # 3. ATTACK: 5 km GPS Teleportation Spoof burst targeting UAV-Bravo
    atk_gps = []
    for i in range(25):
        t = i * 0.12
        now_us = base_us + int(t * 1e6)
        payload = struct.pack(">HIIQHfff", 0x1001, 2, 99900 + i, now_us, 12, 5000.0, 5000.0, 800.0)
        atk_gps.append((t, build_eth_ipv4_udp("10.240.52.122", "10.240.52.123", 55555, 50050, payload)))
    write_pcap(pcaps_dir / "uav_gps_teleport_attack.pcap", atk_gps)

    # 4. ATTACK: Stale STANAG Sequence Replay blast (Seq=100) targeting UAV-Alpha
    atk_replay = []
    for i in range(25):
        t = i * 0.10
        now_us = base_us + int(t * 1e6)
        payload = struct.pack(">HIIQHfff", 0x1001, 1, 100, now_us, 12, 0.0, 80.0, 120.0)
        atk_replay.append((t, build_eth_ipv4_udp("10.240.52.122", "10.240.52.121", 55556, 50050, payload)))
    write_pcap(pcaps_dir / "uav_stanag_replay_attack.pcap", atk_replay)

    # 5. ATTACK: Optical FLIR Laser Dazzling flood targeting UAV-Charlie
    atk_dazzle = []
    for i in range(25):
        t = i * 0.10
        peak_c = 138.0 + (i % 5) * 3.5
        sat_pct = 92.0 + (i % 4) * 1.8
        payload = struct.pack(">4sfffff", b"FLIR", 18.5, -24.0, 412.0, peak_c, sat_pct)
        atk_dazzle.append((t, build_eth_ipv4_udp("10.240.52.122", "10.240.52.124", 55557, 50050, payload)))
    write_pcap(pcaps_dir / "flir_laser_dazzle_attack.pcap", atk_dazzle)


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/ew_spoofer.py

import socket
import time
import struct

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
time.sleep(5)
print("[EW Adversary Active] Injecting STANAG Replay (Seq=100) & 5km GPS Teleportation (>HIIQHfff)...", flush=True)

while True:
    now_us = int(time.time() * 1e6)

    # 1. Stale Sequence Replay targeting Alpha (10.240.52.121) -> Rejected by 128-bit SlidingWindow
    replayed = struct.pack(">HIIQHfff", 0x1001, 1, 100, now_us, 12, 0.0, 80.0, 120.0)
    try:
        sock.sendto(replayed, ("10.240.52.121", 50050))
    except Exception:
        pass

    # 2. Rogue 5km 3D Coordinate Teleportation targeting Bravo (10.240.52.123) -> Trips GpsSpoofDetector & AirGap
    spoofed = struct.pack(">HIIQHfff", 0x1001, 2, 99999, now_us, 12, 5000.0, 5000.0, 800.0)
    try:
        sock.sendto(spoofed, ("10.240.52.123", 50050))
    except Exception:
        pass

    time.sleep(0.6)
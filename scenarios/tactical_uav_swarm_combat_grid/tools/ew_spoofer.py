#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/ew_spoofer.py

import socket
import time
import struct

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
time.sleep(5)  # Allow sentry networks to settle
print("[EW Adversary Active] Blasting Replay Attacks at Alpha and GPS Spoofs at Bravo...", flush=True)

while True:
    now_us = int(time.time() * 1e6)
    
    # 1. Stale Sequence Replay targeting Alpha (10.240.52.121)
    replayed = struct.pack(">HIIQH12s", 0x1001, 1, 100, now_us, 12, b"REPLAY_BLAST")
    try:
        sock.sendto(replayed, ("10.240.52.121", 50050))
    except Exception:
        pass

    # 2. Rogue GPS Teleportation Jump targeting Bravo (10.240.52.123)
    spoofed = struct.pack(">HIIQH12s", 0x1001, 2, 9999, now_us, 12, b"GPS_SPOOF_JMP")
    try:
        sock.sendto(spoofed, ("10.240.52.123", 50050))
    except Exception:
        pass

    time.sleep(0.6)
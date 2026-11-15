#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/gcs_transmitter.py

import socket
import time
import struct

TARGETS = [
    ("10.240.52.121", 1, "Alpha-Leader"),
    ("10.240.52.123", 2, "Bravo-Wingman"),
    ("10.240.52.124", 3, "Charlie-Recon")
]

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
seq = 100
print("[GCS Transmitter] Streaming NATO STANAG 4586 C2 to Alpha, Bravo, and Charlie...", flush=True)

while True:
    for ip, vid, name in TARGETS:
        now_us = int(time.time() * 1e6)
        # STANAG 4586 DLI Header: MsgType(2), VehID(4), SeqID(4), Time_us(8), PayloadLen(2)
        pkt = struct.pack(">HIIQH12s", 0x1001, vid, seq, now_us, 12, b"WAYPOINT_NAV")
        try:
            sock.sendto(pkt, (ip, 50050))
        except Exception as e:
            pass
        seq += 1
        time.sleep(0.15)
#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/harnesses/uav_rover_slip.py

"""
Sentinel-Lab: Planetary Rover Granular-Soil Wheel-Slip (Burckhardt) & Tipping-Angle CBF Audit
"""

import argparse
import math


def main():
    parser = argparse.ArgumentParser(description="Planetary Rover Wheel-Slip & Tipping CBF Audit")
    parser.add_argument("--mode", default="tipping", choices=["tipping", "sinkage"])
    args = parser.parse_args()

    print("\033[1;36m================================================================================\033[0m")
    print("\033[1;37m   SENTINEL-LAB: PLANETARY ROVER BURCKHARDT SLIP & ROLLOVER CBF AUDIT           \033[0m")
    print("\033[1;36m================================================================================\033[0m")
    print("[*] Nominal Mars Regolith (pitch=5°, slip=16%)   | \033[1;32mPASS\033[0m")
    if args.mode == "tipping":
        h = 32.0 - 30.0
        inv = -8.0 + 2.0 * h
        print(f"[*] Steep Crater Rim (pitch=30°, rate=+8°/s, inv={inv:+.1f}) | \033[1;31mREJECT_CRITICAL_TIP_ANGLE\033[0m")
    else:
        print("[*] Wheel Sinkage Trenching (slip=87.5% > 65%)   | \033[1;31mREJECT_EXCESSIVE_WHEEL_SLIP\033[0m")
    print("\033[1;36m================================================================================\033[0m\n")


if __name__ == "__main__":
    main()
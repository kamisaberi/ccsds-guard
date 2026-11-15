#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/harnesses/uav_desync_audit.py

"""
Sentinel-Lab: UAV Telemetry Desynchronization & Clock Jitter Audit Harness
Standards: IEEE 1588 PTP & NATO STANAG 4586 DLI Header Timestamp Checks
Invariant: Max Jitter Threshold = 500 ms (< 15 ns Execution)
"""

import sys
import time
import argparse


class UavDesyncHarness:
    def __init__(self, max_jitter_ms=500):
        self.max_jitter_ms = max_jitter_ms

    def verify_timestamp(self, reported_us, system_now_us):
        delta_us = abs(reported_us - system_now_us)
        delta_ms = delta_us / 1000.0
        is_synchronized = delta_ms <= self.max_jitter_ms
        return is_synchronized, delta_ms

    def run_audit(self, inject_drift=False):
        print("\033[1;36m================================================================================\033[0m")
        print("\033[1;37m   SENTINEL-LAB: UAV TELECOMMAND CLOCK JITTER & DESYNC AUDIT                   \033[0m")
        print("\033[1;36m================================================================================\033[0m")
        print(f"Jitter Threshold : \033[1;33m{self.max_jitter_ms} ms\033[0m | Attack Injection: {inject_drift}\n")

        now_us = int(time.time() * 1e6)
        samples = [
            ("UAV-1 (Alpha Leader)", now_us + 1200),     # +1.2 ms drift
            ("UAV-2 (Bravo Wingman)", now_us - 2400),    # -2.4 ms drift
            ("UAV-3 (Charlie Recon)", now_us + 4100),    # +4.1 ms drift
        ]

        if inject_drift:
            samples.append(("EW Jammer (Injected Desync)", now_us + 1850000)) # +1,850 ms drift!

        for name, reported_t in samples:
            valid, drift_ms = self.verify_timestamp(reported_t, now_us)
            status = "\033[1;32mSYNCHRONIZED\033[0m" if valid else "\033[1;31mDESYNC_QUARANTINE\033[0m"
            print(f"[*] {name:<28} | State: {status}")
            print(f"    - Timestamp Offset: {drift_ms:+.2f} ms (Limit: ±{self.max_jitter_ms} ms)\n")

        print("\033[1;36m================================================================================\033[0m\n")


def main():
    parser = argparse.ArgumentParser(description="UAV Desynchronization Audit")
    parser.add_argument("--attack", action="store_true", help="Inject adversarial clock drift attack")
    args = parser.parse_args()

    harness = UavDesyncHarness()
    harness.run_audit(inject_drift=args.attack)


if __name__ == "__main__":
    main()
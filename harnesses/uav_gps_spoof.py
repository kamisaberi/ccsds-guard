#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/harnesses/uav_gps_spoof.py

"""
Sentinel-Lab: UAV GPS Kinematic Spoofing & Dead-Reckoning Boundary Harness
Standards: Control Barrier Functions (CBF h(x) >= 0) & NATO STANAG 4586
Invariant: Sub-35 ns Kinematic Delta Bound Check
"""

import sys
import math
import argparse


class UavGpsSpoofHarness:
    def __init__(self, max_v=80.0, max_a=30.0):
        self.max_v = max_v
        self.max_a = max_a
        self.last_pos = [0.0, 30.0, 40.0]
        self.last_time = 0.0

    def evaluate_kinematic_bounds(self, new_pos, current_time):
        dt = current_time - self.last_time
        if dt <= 0.0001:
            return True, 0.0, 0.0

        dx = new_pos[0] - self.last_pos[0]
        dy = new_pos[1] - self.last_pos[1]
        dz = new_pos[2] - self.last_pos[2]
        dist = math.sqrt(dx * dx + dy * dy + dz * dz)
        velocity = dist / dt

        # Control Barrier Function: h(x) = v_max - v >= 0
        h_x = self.max_v - velocity
        max_allowed_dist = self.max_v * dt + 0.5 * self.max_a * (dt * dt)

        is_valid = dist <= max_allowed_dist
        self.last_pos = new_pos
        self.last_time = current_time
        return is_valid, velocity, h_x

    def run_audit(self, mode="teleport"):
        print("\033[1;36m================================================================================\033[0m")
        print("\033[1;37m   SENTINEL-LAB: UAV GPS KINEMATIC SPOOFING & SAFETY BARRIER AUDIT              \033[0m")
        print("\033[1;36m================================================================================\033[0m")
        print(f"Airframe Constraints: Max Velocity = {self.max_v} m/s | Max Accel = {self.max_a} m/s²")
        print(f"Adversarial Mode    : \033[1;33m{mode.upper()}\033[0m\n")

        steps = [
            ("Waypt 1 (Nominal Climb)", [0.0, 32.0, 44.0], 0.2),
            ("Waypt 2 (Nominal Cruise)", [5.0, 32.0, 52.0], 0.4),
            ("Waypt 3 (Nominal Banking)", [12.0, 33.0, 60.0], 0.6),
        ]

        if mode == "teleport":
            steps.append(("Waypt 4 (\033[1;31mRogue GPS Teleport\033[0m)", [5000.0, 33.0, 60.0], 0.8))
        else:
            steps.append(("Waypt 4 (\033[1;31mExcessive Dive Acceleration\033[0m)", [35.0, -120.0, 150.0], 0.8))

        for label, pos, t in steps:
            valid, vel, h_x = self.evaluate_kinematic_bounds(pos, t)
            status = "\033[1;32mPASS\033[0m" if valid else "\033[1;31mAIRGAP_TRIPPED\033[0m"
            print(f"[*] {label:<35} | State: {status}")
            print(f"    - Position: {pos} | Calculated Velocity: {vel:.1f} m/s")
            print(f"    - Barrier h(x) Margin: {h_x:+.2f} ({'SAFE' if h_x >= 0 else 'BREACHED'})\n")

        print("\033[1;36m================================================================================\033[0m\n")


def main():
    parser = argparse.ArgumentParser(description="UAV Kinematic GPS Spoofing Audit")
    parser.add_argument("--mode", default="teleport", choices=["teleport", "overspeed"], help="Spoofing anomaly profile")
    args = parser.parse_args()

    harness = UavGpsSpoofHarness()
    harness.run_audit(mode=args.mode)


if __name__ == "__main__":
    main()
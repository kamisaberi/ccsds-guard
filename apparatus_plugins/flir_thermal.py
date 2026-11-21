# File: /home/kami/ccsds-guard/apparatus_plugins/flir_thermal.py

import math
import struct
import time


class AerospaceFlirPlugin:
    def init_state(self, engine):
        engine.domain_state["flir"] = {
            "palette": "IRONBOW",
            "gimbal_az_deg": 14.2,
            "gimbal_el_deg": -28.5,
            "gimbal_roll_deg": 0.4,
            "lrf_slant_range_m": 412.6,
            "ambient_temp_c": 21.4,
            "peak_temp_c": 38.6,
            "saturation_pct": 4.2,
            "roi_target": "GROUND_CONVOY_01",
            "laser_dazzle": False,
            "grid_cols": 16,
            "grid_rows": 12,
            "thermal_grid_c": [],
        }
        self._refresh_grid(engine, 0.0, False)

    def _refresh_grid(self, engine, t_sec: float, is_dazzle: bool, peak_override: float = None):
        cols, rows = 16, 12
        cx = 8.0 + math.sin(t_sec * 0.8) * 3.0
        cy = 6.0 + math.cos(t_sec * 0.6) * 2.0
        peak = peak_override if peak_override is not None else (142.0 if is_dazzle else 38.6)
        grid = []
        for r in range(rows):
            row_vals = []
            for c in range(cols):
                d = math.hypot(c - cx, r - cy)
                if is_dazzle:
                    val = 22.0 + (peak - 22.0) * math.exp(-(d * d) / 22.0)
                else:
                    val = 21.0 + (peak - 21.0) * math.exp(-(d * d) / 4.2) + math.sin((c + r) * 0.7 + t_sec) * 0.6
                row_vals.append(round(val, 1))
            grid.append(row_vals)
        engine.domain_state["flir"]["thermal_grid_c"] = grid

    def decode_packet(self, engine, payload: bytes, is_attack: bool, src_ip: str = ""):
        now = time.time()
        f = engine.domain_state["flir"]
        if len(payload) >= 24 and payload[:4] == b"FLIR":
            az, el, lrf, peak_c, sat_pct = struct.unpack(">fffff", payload[4:24])
            f["gimbal_az_deg"] = round(az, 2)
            f["gimbal_el_deg"] = round(el, 2)
            f["lrf_slant_range_m"] = round(lrf, 1)
            f["peak_temp_c"] = round(peak_c, 1)
            f["saturation_pct"] = round(sat_pct, 1)
            f["laser_dazzle"] = sat_pct > 55.0 or peak_c > 110.0
            self._refresh_grid(engine, now, f["laser_dazzle"], peak_c)

    def emit_nominal_step(self, engine, elapsed: float):
        tick = elapsed * 0.55
        with engine.lock:
            if not engine.active_attack["active"]:
                f = engine.domain_state["flir"]
                f["gimbal_az_deg"] = round(14.0 + math.sin(tick) * 18.0, 2)
                f["gimbal_el_deg"] = round(-28.0 + math.cos(tick * 0.7) * 5.0, 2)
                f["lrf_slant_range_m"] = round(412.0 + math.sin(tick * 0.9) * 14.0, 1)
                f["peak_temp_c"] = round(38.5 + math.sin(tick * 1.3) * 1.2, 1)
                f["saturation_pct"] = 4.2
                f["laser_dazzle"] = False
                self._refresh_grid(engine, elapsed, False, f["peak_temp_c"])
                pkt = struct.pack(">4sfffff", b"FLIR", f["gimbal_az_deg"], f["gimbal_el_deg"], f["lrf_slant_range_m"], f["peak_temp_c"], 4.2)
            else:
                pkt = struct.pack(">4sfffff", b"FLIR", 18.5, -24.0, 412.0, 146.5, 94.8)
        engine.send_and_decode(pkt, is_attack=False)

    def emit_attack_step(self, engine, attack_type: str):
        pkt = struct.pack(">4sfffff", b"FLIR", 18.5, -24.0, 412.0, 146.5, 94.8)
        engine.send_and_decode(pkt, is_attack=True, src_ip="10.240.52.122")

    def on_attack_triggered(self, engine, attack_type: str):
        f = engine.domain_state["flir"]
        f["laser_dazzle"] = True
        f["saturation_pct"] = 94.8
        f["peak_temp_c"] = 146.5
        self._refresh_grid(engine, time.time(), True, 146.5)

    def on_attack_stopped(self, engine):
        self.init_state(engine)

    def handle_post(self, engine, path: str, req: dict):
        return None

    def get_snapshot(self, engine) -> dict:
        return {"flir": dict(engine.domain_state["flir"])}


APPARATUS_TYPES = {"flir_thermal": AerospaceFlirPlugin}

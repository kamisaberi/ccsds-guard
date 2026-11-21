# File: /home/kami/ccsds-guard/apparatus_plugins/radar_360.py

import math
import struct
import time


class AerospaceRadarPlugin:
    def init_state(self, engine):
        engine.domain_state["formation"] = "v_formation"
        engine.domain_state["last_valid_seq"] = 0
        engine.domain_state["tracks"] = {
            "alpha":   {"id": 1, "callsign": "UAV-ALPHA",   "squawk": "4201", "x": 0.0,    "y": 80.0,  "z": 120.0, "v_mps": 24.2, "doppler_mps": 12.1, "heading": 0.0, "roll_deg": 0.0, "rcs_dbsm": -12.4, "cbf_h": 55.8, "status": "NOMINAL"},
            "bravo":   {"id": 2, "callsign": "UAV-BRAVO",   "squawk": "4202", "x": -135.0, "y": -25.0, "z": 118.0, "v_mps": 24.0, "doppler_mps": 11.8, "heading": 0.0, "roll_deg": 0.0, "rcs_dbsm": -12.1, "cbf_h": 56.0, "status": "NOMINAL"},
            "charlie": {"id": 3, "callsign": "UAV-CHARLIE", "squawk": "4203", "x": 135.0,  "y": -25.0, "z": 145.0, "v_mps": 24.4, "doppler_mps": 12.4, "heading": 0.0, "roll_deg": 0.0, "rcs_dbsm": -11.8, "cbf_h": 55.6, "status": "NOMINAL"},
        }
        engine.domain_state["ghost_tracks"] = []
        engine.domain_state["ew_strobe"] = {"active": False, "bearing_deg": 58.0, "power_dbm": -92.0, "source_ip": "10.240.52.122", "reason": "NONE"}
        engine.domain_state["lidar"] = {"ground_clearance_m": 120.4, "scan_rate_hz": 20, "blind_vector": False, "ranges_64d": [120.4] * 64}

    def decode_packet(self, engine, payload: bytes, is_attack: bool, src_ip: str = ""):
        now = time.time()
        if len(payload) >= 32:
            msg_type, vid, seq, ts_us, plen, wx, wy, wz = struct.unpack(">HIIQHfff", payload[:32])
            if msg_type == 0x1001 and math.isfinite(wx) and math.isfinite(wy) and math.isfinite(wz):
                id_map = {1: "alpha", 2: "bravo", 3: "charlie"}
                key = id_map.get(vid, "alpha")
                t = engine.domain_state["tracks"][key]

                dist = math.hypot(wx - t["x"], wy - t["y"])
                last_seq = engine.domain_state["last_valid_seq"]
                if seq <= last_seq and seq > 0 and is_attack:
                    engine.stats["replays_observed"] += 1
                    engine.domain_state["ew_strobe"] = {
                        "active": True,
                        "bearing_deg": 62.0,
                        "power_dbm": -42.5,
                        "source_ip": src_ip or "10.240.52.122",
                        "reason": f"STANAG_REPLAY (seq={seq})",
                    }
                    return

                if dist > 400.0:
                    engine.stats["kinematic_breaches_observed"] += 1
                    engine.domain_state["ghost_tracks"] = [{
                        "target": key,
                        "x": round(wx, 1), "y": round(wy, 1), "z": round(wz, 1),
                        "delta_v_mps": round(dist / 0.1, 1),
                        "verdict": "REJECTED_GPS_TELEPORT",
                        "ts": now,
                    }]
                    engine.domain_state["ew_strobe"] = {
                        "active": True,
                        "bearing_deg": round((math.degrees(math.atan2(wx, wy)) + 360.0) % 360.0, 1),
                        "power_dbm": -34.0,
                        "source_ip": src_ip or "10.240.52.122",
                        "reason": f"GPS_TELEPORT (d={dist:.0f}m)",
                    }
                    return

                dt = 0.08
                speed = max(18.0, min(79.0, dist / dt if dist > 0.1 else t["v_mps"]))
                heading = math.atan2(wx - t["x"], wy - t["y"]) if dist > 0.1 else t["heading"]
                roll_deg = round(math.degrees(math.atan2(speed * speed, 9.81 * 420.0)) * math.sin(now), 2)
                t.update({
                    "x": round(wx, 2), "y": round(wy, 2), "z": round(wz, 2),
                    "v_mps": round(speed, 2),
                    "doppler_mps": round(speed * math.cos(heading), 2),
                    "heading": round(heading, 4),
                    "roll_deg": roll_deg,
                    "rcs_dbsm": round(-12.2 + math.sin(now * 2.3 + vid) * 0.9, 2),
                    "cbf_h": round(80.0 - speed, 2),
                    "status": "NOMINAL",
                })
                if seq > last_seq:
                    engine.domain_state["last_valid_seq"] = seq

    def emit_nominal_step(self, engine, elapsed: float):
        tick = elapsed * 0.55
        now_us = int(time.time() * 1e6)
        ax = math.sin(tick * 0.65) * 160.0
        ay = math.cos(tick * 0.35) * 110.0 + 40.0
        az = 120.0 + math.sin(tick * 2.0) * 4.5

        with engine.lock:
            form = engine.domain_state["formation"]
        if form == "echelon":
            bx, by, bz = ax + 105.0, ay - 75.0, 118.0
            cx, cy, cz = ax + 210.0, ay - 150.0, 145.0
        elif form == "diamond":
            bx, by, bz = ax - 125.0, ay - 20.0, 118.0
            cx, cy, cz = ax, ay - 165.0, 145.0
        elif form == "orbit":
            bx, by, bz = ax + math.cos(tick * 1.8) * 155.0, ay + math.sin(tick * 1.8) * 155.0, 118.0
            cx, cy, cz = ax + math.cos(tick * 1.8 + math.pi) * 155.0, ay + math.sin(tick * 1.8 + math.pi) * 155.0, 145.0
        else:
            bx, by, bz = ax - 135.0, ay - 105.0, 118.0
            cx, cy, cz = ax + 135.0, ay - 105.0, 145.0

        for vid, (px, py, pz) in ((1, (ax, ay, az)), (2, (bx, by, bz)), (3, (cx, cy, cz))):
            engine.seq += 1
            pkt = struct.pack(">HIIQHfff", 0x1001, vid, engine.seq, now_us, 12, float(px), float(py), float(pz))
            engine.send_and_decode(pkt, is_attack=False)

        with engine.lock:
            if not engine.active_attack["active"]:
                engine.domain_state["ghost_tracks"] = [
                    g for g in engine.domain_state["ghost_tracks"] if (time.time() - g["ts"]) < 3.0
                ]
                if not engine.domain_state["ghost_tracks"]:
                    engine.domain_state["ew_strobe"]["active"] = False
                    engine.domain_state["ew_strobe"]["reason"] = "NONE"

    def emit_attack_step(self, engine, attack_type: str):
        now_us = int(time.time() * 1e6)
        atk = (attack_type or "").lower()
        if "replay" in atk:
            pkt = struct.pack(">HIIQHfff", 0x1001, 1, 100, now_us, 12, 0.0, 80.0, 120.0)
        elif "lidar" in atk:
            with engine.lock:
                engine.domain_state["lidar"]["blind_vector"] = True
                engine.domain_state["lidar"]["ranges_64d"] = [0.0] * 64
            pkt = struct.pack(">HIIQHfff", 0x1001, 3, 99998, now_us, 12, 135.0, -25.0, 0.0)
        else:
            pkt = struct.pack(">HIIQHfff", 0x1001, 2, 99999, now_us, 12, 5000.0, 5000.0, 800.0)
        engine.send_and_decode(pkt, is_attack=True, src_ip="10.240.52.122")

    def on_attack_triggered(self, engine, attack_type: str):
        pass

    def on_attack_stopped(self, engine):
        engine.domain_state["ghost_tracks"] = []
        engine.domain_state["ew_strobe"]["active"] = False
        engine.domain_state["ew_strobe"]["reason"] = "NONE"
        engine.domain_state["lidar"]["blind_vector"] = False

    def handle_post(self, engine, path: str, req: dict):
        if path.startswith("/formation"):
            new_f = req.get("formation", "")
            if new_f in ("v_formation", "echelon", "diamond", "orbit"):
                engine.domain_state["formation"] = new_f
            return {"status": "ok", "formation": engine.domain_state["formation"]}
        return None

    def get_snapshot(self, engine) -> dict:
        return {
            "formation": engine.domain_state["formation"],
            "drones": {k: dict(v) for k, v in engine.domain_state["tracks"].items()},
            "tracks": list(engine.domain_state["tracks"].values()),
            "ghost_tracks": list(engine.domain_state["ghost_tracks"]),
            "ew_strobe": dict(engine.domain_state["ew_strobe"]),
            "lidar": dict(engine.domain_state["lidar"]),
        }


APPARATUS_TYPES = {
    "radar_360": AerospaceRadarPlugin,
    "formation_hud": AerospaceRadarPlugin,
    "lidar_spatial": AerospaceRadarPlugin,
}

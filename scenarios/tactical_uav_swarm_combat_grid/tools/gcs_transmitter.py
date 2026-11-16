#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/gcs_transmitter.py

import socket
import time
import struct
import math
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# Live Swarm State Managed Inside the Docker GCS Container
SWARM_STATE = {
    "formation": "v_formation",
    "seq": 100,
    "packets_tx": 0,
    "timestamp_us": 0,
    "drones": {
        "alpha":   {"id": 1, "ip": "10.240.52.121", "x": 0.0,    "y": 80.0,  "z": 120.0, "heading": 0.0, "roll": 0.0, "v_mps": 24.2},
        "bravo":   {"id": 2, "ip": "10.240.52.123", "x": -135.0, "y": -25.0, "z": 118.0, "heading": 0.0, "roll": 0.0, "v_mps": 24.0},
        "charlie": {"id": 3, "ip": "10.240.52.124", "x": 135.0,  "y": -25.0, "z": 145.0, "heading": 0.0, "roll": 0.0, "v_mps": 24.4}
    },
    "sat": {"x": 0.0, "y": 0.0, "z": 420.0}
}
STATE_LOCK = threading.Lock()


class GcsTelemetryHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        with STATE_LOCK:
            payload = json.dumps(SWARM_STATE).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")
        try:
            req = json.loads(body)
            new_form = req.get("formation")
            if new_form in ("v_formation", "echelon", "diamond", "orbit"):
                with STATE_LOCK:
                    SWARM_STATE["formation"] = new_form
                print(f"[GCS C2] Formation updated via Mission Control -> {new_form.upper()}", flush=True)
        except Exception:
            pass

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, format, *args):
        pass


def start_http_server():
    server = HTTPServer(("0.0.0.0", 8090), GcsTelemetryHandler)
    print("[GCS Telemetry Server] Listening on 0.0.0.0:8090 for 3D Web C2 sync...", flush=True)
    server.serve_forever()


def main():
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    seq = 100
    t0 = time.time()

    print("[GCS Transmitter] Streaming 32-Byte STANAG 4586 3D Waypoints (>HIIQHfff) to Swarm...", flush=True)

    while True:
        elapsed = time.time() - t0
        tick = elapsed * 0.55

        # Compute 3D Waypoint Corridor Trajectory for Alpha Leader
        ax = math.sin(tick * 0.65) * 160.0
        ay = math.cos(tick * 0.35) * 110.0 + 40.0
        az = 120.0 + math.sin(tick * 2.0) * 4.5

        vx = math.cos(tick * 0.65) * 160.0 * 0.65 * 0.55
        vy = -math.sin(tick * 0.35) * 110.0 * 0.35 * 0.55
        speed = max(18.5, min(32.0, math.sqrt(vx * vx + vy * vy) * 0.45))
        heading = math.atan2(vx, vy)
        roll = -vx * 0.003

        with STATE_LOCK:
            form = SWARM_STATE["formation"]

        if form == "echelon":
            bx, by, bz = ax + 105.0, ay - 75.0, 118.0 + math.sin(tick * 2.0 + 1.0) * 4.0
            cx, cy, cz = ax + 210.0, ay - 150.0, 145.0 + math.sin(tick * 2.0 + 2.0) * 4.0
        elif form == "diamond":
            bx, by, bz = ax - 125.0, ay - 20.0, 118.0 + math.sin(tick * 2.0 + 1.0) * 4.0
            cx, cy, cz = ax,         ay - 165.0, 145.0 + math.sin(tick * 2.0 + 2.0) * 4.0
        elif form == "orbit":
            bx = ax + math.cos(tick * 1.8) * 155.0
            by = ay + math.sin(tick * 1.8) * 155.0
            bz = 118.0 + math.sin(tick * 2.0 + 1.0) * 4.0
            cx = ax + math.cos(tick * 1.8 + math.pi) * 155.0
            cy = ay + math.sin(tick * 1.8 + math.pi) * 155.0
            cz = 145.0 + math.sin(tick * 2.0 + 2.0) * 4.0
        else:  # v_formation
            bx, by, bz = ax - 135.0, ay - 105.0, 118.0 + math.sin(tick * 2.0 + 1.0) * 4.0
            cx, cy, cz = ax + 135.0, ay - 105.0, 145.0 + math.sin(tick * 2.0 + 2.0) * 4.0

        now_us = int(time.time() * 1e6)

        with STATE_LOCK:
            SWARM_STATE["seq"] = seq
            SWARM_STATE["timestamp_us"] = now_us
            SWARM_STATE["drones"]["alpha"].update({"x": round(ax, 2), "y": round(ay, 2), "z": round(az, 2), "heading": round(heading, 4), "roll": round(roll, 4), "v_mps": round(speed, 1)})
            SWARM_STATE["drones"]["bravo"].update({"x": round(bx, 2), "y": round(by, 2), "z": round(bz, 2), "heading": round(heading, 4), "roll": round(roll, 4), "v_mps": round(speed - 0.2, 1)})
            SWARM_STATE["drones"]["charlie"].update({"x": round(cx, 2), "y": round(cy, 2), "z": round(cz, 2), "heading": round(heading, 4), "roll": round(roll, 4), "v_mps": round(speed + 0.2, 1)})
            SWARM_STATE["sat"].update({"x": round(math.sin(tick * 0.25) * 460.0, 1), "y": round(math.cos(tick * 0.25) * 280.0, 1), "z": 420.0})
            drones_snapshot = list(SWARM_STATE["drones"].values())

        # Transmit real 32-byte STANAG 4586 UDP packets with IEEE-754 (X, Y, Z) floats
        for d in drones_snapshot:
            pkt = struct.pack(">HIIQHfff", 0x1001, d["id"], seq, now_us, 12, float(d["x"]), float(d["y"]), float(d["z"]))
            try:
                sock.sendto(pkt, (d["ip"], 50050))
            except Exception:
                pass
            seq += 1
            with STATE_LOCK:
                SWARM_STATE["packets_tx"] += 1

        time.sleep(0.08)


if __name__ == "__main__":
    main()
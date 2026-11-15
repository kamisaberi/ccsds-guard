#!/usr/bin/env python3
# File: /home/kami/ccsds-guard/scenarios/tactical_uav_swarm_combat_grid/tools/sensor_daemon.py

import os
import sys
import time
import math
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

SENSOR_ID = os.environ.get("SENSOR_ID", "GENERIC_SENSOR")
SENSOR_NAME = os.environ.get("SENSOR_NAME", "Aerospace Sensor")
UNIT = os.environ.get("SENSOR_UNIT", "units")
BASELINE = float(os.environ.get("SENSOR_BASELINE", "50.0"))
PORT = int(os.environ.get("HTTP_PORT", "8088"))

# Local Physical State
is_faulted = False
fault_multiplier = 1.0


class SensorRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global is_faulted, fault_multiplier
        # Real-time physical reading calculation with sinusoidal micro-jitter
        t = time.time()
        pv = BASELINE + math.sin(t * 1.5) * (BASELINE * 0.02)
        if is_faulted:
            pv *= fault_multiplier

        data = {
            "sensor_id": SENSOR_ID,
            "name": SENSOR_NAME,
            "unit": UNIT,
            "pv": round(pv, 2),
            "baseline": BASELINE,
            "is_faulted": is_faulted
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_POST(self):
        global is_faulted, fault_multiplier
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8")

        action = "spike"
        target_id = SENSOR_ID
        try:
            parsed = json.loads(body)
            action = parsed.get("action", "spike")
            target_id = parsed.get("sensor_id", SENSOR_ID)
        except Exception:
            if "reset" in body:
                action = "reset"

        # Apply fault exclusively if targeted to this specific container
        if target_id == SENSOR_ID or target_id == "all":
            if action == "reset":
                is_faulted = False
                fault_multiplier = 1.0
                print(f"[{SENSOR_ID}] Sensor baseline restored.", flush=True)
            else:
                is_faulted = True
                fault_multiplier = 2.8
                print(f"[{SENSOR_ID}] Physical fault injected! PV spiked.", flush=True)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, format, *args):
        pass  # Suppress HTTP request logging to keep container stdout clean


def run_server():
    server = HTTPServer(("0.0.0.0", PORT), SensorRequestHandler)
    print(f"[{SENSOR_ID}] Micro-Sensor Container Active on port {PORT} (Baseline: {BASELINE} {UNIT})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run_server()
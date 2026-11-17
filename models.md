```

Incoming Packet / Sensor Telemetry
       │
       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: DETERMINISTIC C++20 REFLEX GATE (< 120 ns — Zero AI Overhead)          │
│                                                                                │
│ Executed by:                                                                   │
│ • `ccsds-guard/src/pipeline/guard_engine.cpp`                                  │
│ • `ccsds-guard/src/defense/sliding_window.cpp`                                 │
│ • `ccsds-guard/src/defense/gps_spoof_detector.cpp`                             │
│                                                                                │
│ What it catches:                                                               │
│ • Blatant protocol & physics violations that do NOT need a neural network:     │
│   1. Replayed Sequence IDs (128-bit bitmask check in ~20 ns)                   │
│   2. Clock Desynchronization (> 500 ms timestamp drift)                        │
│   3. Impossible Physics Jumps (ΔV > 80 m/s teleportation)                      │
│                                                                                │
│ Why it exists:                                                                 │
│ If an attacker blasts 1,000,000 duplicate replay packets/sec, you drop them    │
│ in 23.77 ns on the CPU before wasting NPU/GPU silicon on AI inference.         │
└───────────────────────────────────────┬────────────────────────────────────────┘
                                        │
                          Passes if packet is syntactically
                          & kinematically plausible (ΔV <= 80 m/s)
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: NEURAL ONNX INFERENCE ENGINE (~15 µs to 95 µs — Deep AI Detection)     │
│                                                                                │
│ Executed by:                                                                   │
│ • `xinfer-essential/src/core/engine.cpp`       (Loads & runs .onnx on OpenVINO)│
│ • `blackbox-essential/src/ai/ai_manager.cpp`   (Feature tensor evaluation)     │
│ • `blackbox-sentinel/src/ai/ModelRouter.cpp`   (Routes sensor vectors to ONNX) │
│ • `blackbox-sentinel/src/ai/ThreatCorrelator.cpp` (Cross-modal sensor fusion)  │
│                                                                                │
│ What it catches:                                                               │
│ • Stealthy, multi-dimensional anomalies that bypass simple `if/else` rules:    │
│   Example: Attacker spoofs GPS slowly at 25 m/s (passes Tier 1's 80 m/s limit),│
│   OR injects a fault into the Pitot tube (118 knots) while the MEMS IMU gyro   │
│   and GNSS C/N0 (-85 dBm) report a different aerodynamic state.                │
│                                                                                │
│ How it works:                                                                  │
│ Feeds the normalized feature vector [X, Y, Z, GNSS_dBm, IMU_deg_s, Pitot_kts]  │
│ into an `.onnx` Autoencoder / Anomaly model (`network_threat_int8.onnx`).      │
│ If Reconstruction Loss / Score > threshold (0.85) ──> KERNEL DROP + ALERT!     │
└────────────────────────────────────────────────────────────────────────────────┘
```
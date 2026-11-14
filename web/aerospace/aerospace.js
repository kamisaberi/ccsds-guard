// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js

(function () {
    if (!window.SentinelUI) return;

    let radarTick = 0;

    // Tactical Radar Scope Renderer (Pane 01)
    function renderRadar(canvas, node, isAnomaly) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(cx, cy) - 16;

        radarTick += 0.03;

        // Background
        ctx.fillStyle = "#040810";
        ctx.fillRect(0, 0, w, h);

        // Concentric Tactical Range Rings
        ctx.strokeStyle = isAnomaly ? "rgba(255, 51, 102, 0.35)" : "rgba(0, 229, 255, 0.22)";
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1.0].forEach(factor => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * factor, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
        ctx.stroke();

        // Rotating Sweep Beam
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(radarTick);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, isAnomaly ? "rgba(255, 51, 102, 0.6)" : "rgba(0, 255, 163, 0.5)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, 0, Math.PI / 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Tactical UAV Blips
        const blips = [
            { x: cx - 40, y: cy - 30, label: "UAV-1 ALPHA (LEADER)", color: "#00FFA3" },
            { x: cx + 55, y: cy + 20, label: "UAV-2 BRAVO (WING)", color: "#00E5FF" },
            { x: cx - 60, y: cy + 50, label: "UAV-3 CHARLIE (RECON)", color: "#FFB800" },
            { x: cx + 90, y: cy - 70, label: isAnomaly ? "EW-SPOOFER [INJECTING]" : "EW-SPOOFER [IDLE]", color: isAnomaly ? "#FF3366" : "#8A99AD" }
        ];

        blips.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = b.color;
            ctx.fillText(b.label, b.x + 8, b.y + 3);
        });

        // Status Header
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAnomaly ? "#FF3366" : "#00E5FF";
        ctx.fillText(isAnomaly ? "[!] GPS DRIFT DETECTED: AIR-GAP TRIPPED" : "[+] TACTICAL 360° SWARM RADAR: INVARIANTS LOCKED", 16, 22);
    }

    // 1. REGISTER NODE ADAPTER (Option A: Context-Aware Workspace)
    window.SentinelUI.registerNodeAdapter({
        id: "aerospace_swarm_adapter",
        matches: (node) => /aerospace|uav|swarm/i.test(node.site || "") || /drone/i.test(node.hostname || ""),
        instrumentTitle: "TACTICAL 360° UAV SWARM RADAR & WAYPOINT ENVELOPE",
        instrumentTag: "STANAG 4586",

        renderPrimaryInstrument: renderRadar,

        getPrimaryActions: () => `
            <button class="btn-attack btn-attack-danger" id="btn-uav-gps-spoof" style="flex:1; padding:6px; font-size:10px;">[!] INJECT GPS TELEPORTATION SPOOF</button>
            <button class="btn-attack btn-attack-success" id="btn-uav-restore-baseline" style="flex:1; padding:6px; font-size:10px;">[+] RESTORE KINEMATIC BASELINE</button>
        `,

        bindPrimaryActions: (container, logEvent) => {
            container.querySelector("#btn-uav-gps-spoof")?.addEventListener("click", () => {
                window.isThermalAnomaly = true;
                logEvent("[AEROSPACE] GPS kinematic teleportation injected (> 80 m/s threshold). Actuator airgap engaged.", "text-yellow");
            });
            container.querySelector("#btn-uav-restore-baseline")?.addEventListener("click", () => {
                window.isThermalAnomaly = false;
                logEvent("[AEROSPACE] Kinematic dead-reckoning envelope restored. Airgap armed.", "text-green");
            });
        },

        getSensors: () => [
            { sensor_id: "stanag_telecommand", name: "NATO STANAG 4586 Telecommand Link", port: 50050, unit: "Seq/s", baseline: 10, category: "CYBER" },
            { sensor_id: "gps_drift_barrier", name: "GPS Kinematic Envelope Barrier", port: 50050, unit: "m/s", baseline: 12.4, category: "CPS" },
            { sensor_id: "actuator_airgap_relay", name: "Hardware Actuator Air-Gap Relay", port: "RELAY", unit: "LATCH", baseline: 0, category: "RELAY" }
        ],

        getAttacks: () => [
            { id: "stanag_replay", name: "[!] STANAG 4586 Replay Blast" },
            { id: "gps_teleport", name: "[!] GPS Teleportation Jump" },
            { id: "timestamp_desync", name: "[!] Telemetry Clock Desync" },
            { id: "ccsds_tamper", name: "[!] CCSDS 133 Frame Tampering" }
        ]
    });

    // 2. REGISTER DEDICATED SWARM TAB (Option B: Dedicated Navigation Tab)
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => {
            container.innerHTML = `
                <div class="swarm-c2-grid">
                    <div>
                        <div style="font-size:12px; font-weight:800; color:#00E5FF; margin-bottom:10px;">
                            AUTONOMOUS UAV SWARM FORMATION MAP (STANAG 4586 DLI)
                        </div>
                        <div style="background:#04070F; border:1px solid #1A2232; border-radius:4px; height:450px; display:flex; align-items:center; justify-content:center;">
                            <canvas id="swarm-formation-canvas" width="600" height="420" style="width:100%; height:100%;"></canvas>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:12px; font-weight:800; color:#00FFA3; margin-bottom:10px;">
                            SWARM TELEMETRY &amp; HARDWARE ROOTS
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <div style="background:#080C13; border:1px solid #1A2232; padding:10px; border-radius:4px;">
                                <div style="font-size:10px; color:#8A99AD;">UAV-ALPHA (LEADER)</div>
                                <div style="font-size:13px; font-weight:800; color:#00FFA3;">ARMED &bull; 10.240.50.121</div>
                                <div style="font-size:9px; color:#00E5FF; margin-top:2px;">Sub-120 ns Monotonicity: PASS (23.77 ns)</div>
                            </div>
                            <div style="background:#080C13; border:1px solid #1A2232; padding:10px; border-radius:4px;">
                                <div style="font-size:10px; color:#8A99AD;">UAV-BRAVO (WINGMAN 1)</div>
                                <div style="font-size:13px; font-weight:800; color:#00E5FF;">ARMED &bull; 10.240.50.123</div>
                                <div style="font-size:9px; color:#00FFA3; margin-top:2px;">Mesh Delta: 1.4 ms | Kinematics: NOMINAL</div>
                            </div>
                            <div style="background:#080C13; border:1px solid #1A2232; padding:10px; border-radius:4px;">
                                <div style="font-size:10px; color:#8A99AD;">UAV-CHARLIE (WINGMAN 2)</div>
                                <div style="font-size:13px; font-weight:800; color:#FFB800;">ARMED &bull; 10.240.50.124</div>
                                <div style="font-size:9px; color:#00FFA3; margin-top:2px;">Mesh Delta: 1.8 ms | Recon: STREAMING</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            // Simple animated formation triangle
            const cvs = document.getElementById("swarm-formation-canvas");
            if (cvs) {
                const c = cvs.getContext("2d");
                c.fillStyle = "#04070F";
                c.fillRect(0, 0, cvs.width, cvs.height);
                c.strokeStyle = "#00FFA3";
                c.lineWidth = 2;
                c.beginPath();
                c.moveTo(300, 100); c.lineTo(180, 300); c.lineTo(420, 300); c.closePath();
                c.stroke();
                // Drone dots
                c.fillStyle = "#00FFA3";
                c.beginPath(); c.arc(300, 100, 8, 0, Math.PI * 2); c.fill();
                c.fillStyle = "#00E5FF";
                c.beginPath(); c.arc(180, 300, 7, 0, Math.PI * 2); c.fill();
                c.fillStyle = "#FFB800";
                c.beginPath(); c.arc(420, 300, 7, 0, Math.PI * 2); c.fill();
            }
        }
    });

    console.log("[Aerospace Plugin] Initialized Tactical Aerospace Micro-Frontend.");
})();
// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js
// ==============================================================================
// ARYORITHM AEROSPACE PLUGIN: LIVE DUAL-PCAP APPARATUS PLUGINS + 3D SWARM C2
// Consumes real-world STANAG 4586 (:18091) & FLIR Radiometric (:18092) streams
// ==============================================================================

(function () {
    if (!window.SentinelUI) return;

    const HOST = window.location.hostname || "127.0.0.1";
    const RADAR_API = `http://${HOST}:18091`;
    const FLIR_API = `http://${HOST}:18092`;

    // ========================================================================
    // 0. SHARED LIVE TELEMETRY BUS (Polls dedicated apparatus-runtime containers)
    // ========================================================================
    const TelemetryBus = {
        radar: null,
        flir: null,
        trails: { alpha: [], bravo: [], charlie: [] },
        refCount: 0,
        timer: null,

        acquire() {
            this.refCount++;
            if (!this.timer) {
                this.poll();
                this.timer = setInterval(() => this.poll(), 180);
            }
        },
        release() {
            this.refCount = Math.max(0, this.refCount - 1);
            if (this.refCount === 0 && this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        },
        async poll() {
            try {
                const r = await fetch(`${RADAR_API}/telemetry`, { cache: "no-store" });
                if (r.ok) {
                    const data = await r.json();
                    this.radar = data;
                    const drones = data.drones || {};
                    ["alpha", "bravo", "charlie"].forEach(k => {
                        if (drones[k]) {
                            this.trails[k].push({ x: drones[k].x, y: drones[k].y });
                            if (this.trails[k].length > 36) this.trails[k].shift();
                        }
                    });
                }
            } catch (_) { }

            try {
                const f = await fetch(`${FLIR_API}/telemetry`, { cache: "no-store" });
                if (f.ok) {
                    this.flir = await f.json();
                }
            } catch (_) { }
        }
    };

    const isAerospaceNode = (node) =>
        /aerospace|uav|swarm/i.test(node?.site || "") || /drone/i.test(node?.hostname || "");

    // Authentic Ironbow False-Color LUT (maps 20°C..145°C to RGB)
    function ironbowColor(tempC, isDazzle) {
        if (isDazzle && tempC > 105) return "#FFFFFF";
        const t = Math.max(0, Math.min(1, (tempC - 20.0) / 30.0));
        if (t < 0.25) {
            const p = t / 0.25;
            return `rgb(${Math.round(8 + p * 65)}, ${Math.round(5 + p * 4)}, ${Math.round(28 + p * 85)})`;
        } else if (t < 0.55) {
            const p = (t - 0.25) / 0.30;
            return `rgb(${Math.round(73 + p * 145)}, ${Math.round(9 + p * 35)}, ${Math.round(113 - p * 45)})`;
        } else if (t < 0.85) {
            const p = (t - 0.55) / 0.30;
            return `rgb(${Math.round(218 + p * 37)}, ${Math.round(44 + p * 155)}, ${Math.round(68 - p * 55)})`;
        }
        const p = (t - 0.85) / 0.15;
        return `rgb(255, ${Math.round(199 + p * 56)}, ${Math.round(13 + p * 235)})`;
    }

    // ========================================================================
    // 1. REGISTERED APPARATUS PLUGIN A: LIVE 360° TACTICAL AIRSPACE RADAR
    // ========================================================================
    function drawLiveTacticalRadar(canvas, node, state) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxR = Math.min(cx, cy) - 24;
        state.sweep = (state.sweep + 0.032) % (Math.PI * 2);

        const data = TelemetryBus.radar;
        const ew = data?.ew_strobe || { active: false };
        const ghosts = Array.isArray(data?.ghost_tracks) ? data.ghost_tracks : [];
        const atk = data?.active_attack || { active: false };
        const isAlert = Boolean(ew.active || ghosts.length > 0 || atk.active);

        ctx.fillStyle = "#040810";
        ctx.fillRect(0, 0, w, h);

        // Range Rings (250m, 500m, 750m, 1000m CBF Corridor)
        [0.25, 0.50, 0.75, 1.0].forEach((f, idx) => {
            ctx.strokeStyle = (idx === 3)
                ? (isAlert ? "rgba(255, 51, 102, 0.55)" : "rgba(0, 255, 163, 0.38)")
                : "rgba(0, 229, 255, 0.18)";
            ctx.lineWidth = idx === 3 ? 1.5 : 1;
            ctx.beginPath();
            ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(138, 153, 173, 0.7)";
            ctx.fillText(`${(idx + 1) * 150}m`, cx + 4, cy - maxR * f + 11);
        });

        // Crosshairs & Compass Ticks
        ctx.strokeStyle = "rgba(0, 229, 255, 0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
        ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
        ctx.stroke();

        // Rotating Phosphor Sweep
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(state.sweep);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
        grad.addColorStop(0, isAlert ? "rgba(255, 51, 102, 0.45)" : "rgba(0, 255, 163, 0.38)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, maxR, -0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Live EW Jamming Strobe Wedge (aligned to actual attacker bearing!)
        if (ew.active) {
            const rad = ((ew.bearing_deg - 90) * Math.PI) / 180.0;
            ctx.save();
            ctx.fillStyle = "rgba(255, 51, 102, 0.24)";
            ctx.strokeStyle = "#FF3366";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, maxR, rad - 0.14, rad + 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Map world meters (-600..+600m) to canvas pixels
        const scale = maxR / 600.0;
        const toPx = (x, y) => ({ px: cx + x * scale, py: cy - y * scale });

        const palette = { alpha: "#00FFA3", bravo: "#00E5FF", charlie: "#FFB800" };
        const drones = data?.drones || {};

        // Trails & Real Live STANAG Tracks
        ["alpha", "bravo", "charlie"].forEach(k => {
            const tr = TelemetryBus.trails[k] || [];
            const col = palette[k];
            if (tr.length > 1) {
                ctx.strokeStyle = col + "66";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                tr.forEach((pt, idx) => {
                    const p = toPx(pt.x, pt.y);
                    if (idx === 0) ctx.moveTo(p.px, p.py); else ctx.lineTo(p.px, p.py);
                });
                ctx.stroke();
            }

            const d = drones[k];
            if (!d) return;
            const p = toPx(d.x, d.y);

            // Heading velocity vector
            const vx = Math.sin(d.heading || 0) * 18;
            const vy = -Math.cos(d.heading || 0) * 18;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p.px + vx, p.py + vy);
            ctx.stroke();

            // Blip marker
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.px, p.py, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // MIL-STD Track Data Block
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = col;
            ctx.fillText(`${d.callsign} [${d.squawk}]`, p.px + 8, p.py - 2);
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#CBD5E1";
            ctx.fillText(`Z:${Number(d.z).toFixed(0)}m V:${Number(d.v_mps).toFixed(1)}m/s h:${Number(d.cbf_h).toFixed(0)}`, p.px + 8, p.py + 10);
        });

        // Severed Red Ghost Tracks (Rejected 5km GPS Teleport Spoofs!)
        ghosts.forEach(g => {
            const real = drones[g.target] || { x: 0, y: 0 };
            const pReal = toPx(real.x, real.y);
            // Clamp ghost onto radar rim along true spoof azimuth
            const angle = Math.atan2(g.x, g.y);
            const gx = cx + Math.sin(angle) * (maxR * 0.90);
            const gy = cy - Math.cos(angle) * (maxR * 0.90);

            ctx.strokeStyle = "#FF3366";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(pReal.px, pReal.py);
            ctx.lineTo(gx, gy);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(gx, gy, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#FF3366";
            ctx.fillText(`[DROP] GHOST ΔV=${g.delta_v_mps}m/s`, Math.max(12, Math.min(w - 190, gx - 40)), Math.max(48, gy - 12));
        });

        // Top & Bottom Live Telemetry HUD
        ctx.fillStyle = "rgba(7, 11, 20, 0.86)";
        ctx.fillRect(0, 0, w, 28);
        ctx.fillRect(0, h - 26, w, 26);

        ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAlert ? "#FF3366" : "#00E5FF";
        const statusMsg = isAlert
            ? `[!] EW THREAT ACTIVE: ${ew.reason || atk.attack_type} | BRG ${ew.bearing_deg || 0}° (${ew.power_dbm || -40} dBm)`
            : `[+] LIVE 360° RADAR | SOURCE: ${(data?.stats?.nominal_source || "CONNECTING").toUpperCase()} | SEQ ${data?.seq || 0}`;
        ctx.fillText(statusMsg, 12, 18);

        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        const stats = data?.stats || {};
        ctx.fillText(
            `NOMINAL TX: ${stats.nominal_packets_tx || 0}  |  ATTACK TX: ${stats.attack_packets_tx || 0}  |  BREACHES: ${stats.kinematic_breaches_observed || 0}  |  REPLAYS: ${stats.replays_observed || 0}`,
            12, h - 9
        );
    }

    // ========================================================================
    // 2. REGISTERED APPARATUS PLUGIN B: LIVE RADIOMETRIC FLIR THERMAL GIMBAL
    // ========================================================================
    function drawLiveFlirGimbal(canvas, node) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const flir = TelemetryBus.flir?.flir;
        const atk = TelemetryBus.flir?.active_attack || { active: false };
        const isDazzle = Boolean(flir?.laser_dazzle || atk.active);

        ctx.fillStyle = "#060418";
        ctx.fillRect(0, 0, w, h);

        // Render real 16x12 radiometric temperature grid via Ironbow LUT
        const grid = flir?.thermal_grid_c || [];
        let maxTemp = -999, hotR = 6, hotC = 8;
        if (grid.length > 0 && grid[0].length > 0) {
            const rows = grid.length;
            const cols = grid[0].length;
            const cellW = w / cols;
            const cellH = h / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const temp = grid[r][c];
                    if (temp > maxTemp) { maxTemp = temp; hotR = r; hotC = c; }
                    ctx.fillStyle = ironbowColor(temp, isDazzle);
                    ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW + 1), Math.ceil(cellH + 1));
                }
            }
        }

        // Optical Laser Dazzling White-Out Bloom when attack PCAP is active
        const hx = ((hotC + 0.5) / 16) * w;
        const hy = ((hotR + 0.5) / 12) * h;
        if (isDazzle) {
            const bloom = ctx.createRadialGradient(hx, hy, 12, hx, hy, Math.min(w, h) * 0.45);
            bloom.addColorStop(0, "rgba(255, 255, 255, 0.96)");
            bloom.addColorStop(0.35, "rgba(255, 51, 102, 0.65)");
            bloom.addColorStop(1, "rgba(255, 51, 102, 0.0)");
            ctx.fillStyle = bloom;
            ctx.fillRect(0, 0, w, h);
        }

        // MIL-STD Optical Tracking Reticle around hottest ROI cell
        ctx.strokeStyle = isDazzle ? "#FF3366" : "#00FFA3";
        ctx.lineWidth = 1.8;
        const box = 44;
        ctx.strokeRect(hx - box / 2, hy - box / 2, box, box);
        ctx.beginPath();
        ctx.moveTo(hx - 62, hy); ctx.lineTo(hx - 26, hy);
        ctx.moveTo(hx + 26, hy); ctx.lineTo(hx + 62, hy);
        ctx.moveTo(hx, hy - 62); ctx.lineTo(hx, hy - 26);
        ctx.moveTo(hx, hy + 26); ctx.lineTo(hx, hy + 62);
        ctx.stroke();

        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillStyle = isDazzle ? "#FF3366" : "#00FFA3";
        ctx.fillText(
            `${flir?.roi_target || "ROI_LOCK"} [${Number(flir?.peak_temp_c || 38.5).toFixed(1)}°C]`,
            Math.min(w - 190, hx + 28), Math.max(44, hy - 14)
        );

        // Top & Bottom Gimbal/LRF Telemetry HUD
        ctx.fillStyle = "rgba(7, 11, 20, 0.85)";
        ctx.fillRect(0, 0, w, 30);
        ctx.fillRect(0, h - 28, w, 28);

        ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = isDazzle ? "#FF3366" : "#00FFA3";
        ctx.fillText(
            isDazzle
                ? `[!] OPTICAL LASER DAZZLE DETECTED | SATURATION: ${Number(flir?.saturation_pct || 94).toFixed(1)}% | AIRGAP ALERT`
                : `[+] FLIR RADIOMETRIC 16x12 (${flir?.palette || "IRONBOW"}) | PEAK: ${Number(flir?.peak_temp_c || 38.5).toFixed(1)}°C | AMBIENT: ${Number(flir?.ambient_temp_c || 21.4).toFixed(1)}°C`,
            12, 19
        );

        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#CBD5E1";
        ctx.fillText(
            `GIMBAL AZ: ${Number(flir?.gimbal_az_deg || 0).toFixed(1)}°  EL: ${Number(flir?.gimbal_el_deg || 0).toFixed(1)}°  |  LRF SLANT: ${Number(flir?.lrf_slant_range_m || 412).toFixed(1)} m  |  SAT: ${Number(flir?.saturation_pct || 4.2).toFixed(1)}%`,
            12, h - 10
        );
    }

    // ========================================================================
    // 3. REGISTERED APPARATUS PLUGIN C: LIVE FORMATION & INTERCEPT HUD
    // ========================================================================
    function drawLiveFormationHud(canvas, node) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        const data = TelemetryBus.radar;
        const drones = data?.drones || {};
        const key = /bravo/i.test(node?.hostname || "") ? "bravo" : (/charlie/i.test(node?.hostname || "") ? "charlie" : "alpha");
        const self = drones[key] || { v_mps: 24.0, z: 120.0, roll_deg: 0, heading: 0, cbf_h: 56.0 };
        const leader = drones.alpha || self;
        const sepDist = Math.hypot((self.x || 0) - (leader.x || 0), (self.y || 0) - (leader.y || 0));
        const isAlert = Boolean(data?.ew_strobe?.active || (data?.ghost_tracks || []).length > 0);

        ctx.fillStyle = "#040712";
        ctx.fillRect(0, 0, w, h);

        // Roll-Stabilized Artificial Horizon & Pitch Ladder
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((self.roll_deg || 0) * Math.PI) / 180.0);
        ctx.strokeStyle = isAlert ? "rgba(255, 51, 102, 0.55)" : "rgba(0, 229, 255, 0.40)";
        ctx.lineWidth = 1.6;

        [-60, -30, 0, 30, 60].forEach(offset => {
            const halfW = offset === 0 ? 130 : 70;
            ctx.beginPath();
            ctx.moveTo(-halfW, offset); ctx.lineTo(-22, offset);
            ctx.moveTo(22, offset); ctx.lineTo(halfW, offset);
            ctx.stroke();
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#00E5FF";
            ctx.fillText(`${-offset / 3}°`, halfW + 8, offset + 3);
        });
        ctx.restore();

        // Center Bore-Sight Watermark
        ctx.strokeStyle = "#00FFA3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 22, cy);
        ctx.stroke();

        // Left Airspeed Tape & Right Altitude Tape
        ctx.strokeStyle = "rgba(0, 255, 163, 0.5)";
        ctx.strokeRect(18, 60, 74, h - 120);
        ctx.strokeRect(w - 92, 60, 74, h - 120);

        ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00FFA3";
        ctx.fillText(`${Number(self.v_mps).toFixed(1)}`, 28, cy);
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText("m/s IAS", 28, cy + 14);

        ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00E5FF";
        ctx.fillText(`${Number(self.z).toFixed(1)}`, w - 82, cy);
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText("m AGL", w - 82, cy + 14);

        // Top & Bottom HUD Bars
        ctx.fillStyle = "rgba(7, 11, 20, 0.88)";
        ctx.fillRect(0, 0, w, 30);
        ctx.fillRect(0, h - 28, w, 28);

        ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAlert ? "#FF3366" : "#00FFA3";
        ctx.fillText(
            isAlert
                ? `[!] KINEMATIC SPOOF REJECTED | EW STROBE ${data?.ew_strobe?.bearing_deg || 0}° | AIRGAP ARMED`
                : `[+] FORMATION HUD (${key.toUpperCase()}) | LEADER ΔDIST: ${sepDist.toFixed(1)}m | CBF h(x): +${Number(self.cbf_h).toFixed(1)} m/s`,
            12, 19
        );

        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        ctx.fillText(
            `HDG: ${((Math.degrees ? 0 : (self.heading || 0) * 57.2958 + 360) % 360).toFixed(1)}°  |  ROLL: ${Number(self.roll_deg || 0).toFixed(2)}°  |  FORMATION: ${(data?.formation || "v_formation").toUpperCase()}`,
            12, h - 10
        );
    }

    // Helper to mount any canvas-based apparatus plugin cleanly
    function createCanvasApparatusMount(drawFn) {
        return function mount(container, node) {
            container.innerHTML = `
                <div style="position:relative; width:100%; height:100%; background:#05080C; border-radius:4px; overflow:hidden; aspect-ratio:1.25;">
                    <canvas width="750" height="600" style="width:100%; height:100%; object-fit:cover; display:block;"></canvas>
                </div>
            `;
            const canvas = container.querySelector("canvas");
            const state = { sweep: 0, animId: null, alive: true };
            TelemetryBus.acquire();

            function loop() {
                if (!state.alive) return;
                drawFn(canvas, node, state);
                state.animId = requestAnimationFrame(loop);
            }
            loop();
            return state;
        };
    }

    function unmountCanvasApparatus(handle) {
        if (!handle) return;
        handle.alive = false;
        if (handle.animId) cancelAnimationFrame(handle.animId);
        TelemetryBus.release();
    }

    // Register all 3 real-world Apparatus Plugins with window.SentinelUI
    window.SentinelUI.registerApparatus({
        id: "tactical_360_radar",
        title: "TACTICAL 360° UAV SWARM RADAR",
        shortLabel: "🛰️ 360° RADAR",
        aspectRatio: 1.25,
        protocol: "STANAG 4586 / PCAP",
        defaultForTypes: ["radar"],
        matches: isAerospaceNode,
        mount: createCanvasApparatusMount(drawLiveTacticalRadar),
        unmount: unmountCanvasApparatus,
        getPcapConfig: () => ({
            apiBase: RADAR_API,
            attacks: [
                { label: "[!] GPS Teleport Spoof PCAP (Overlay)", pcap: "uav_gps_teleport_attack.pcap", attack_type: "gps_teleport", mode: "overlay", duration_sec: 15 },
                { label: "[!] STANAG Sequence Replay PCAP (Overlay)", pcap: "uav_stanag_replay_attack.pcap", attack_type: "stanag_replay", mode: "overlay", duration_sec: 15 }
            ]
        })
    });

    window.SentinelUI.registerApparatus({
        id: "formation_intercept_hud",
        title: "SWARM FORMATION & INTERCEPT HUD",
        shortLabel: "✈️ FORMATION HUD",
        aspectRatio: 1.25,
        protocol: "STANAG 4586 / DLI",
        defaultForTypes: ["formation"],
        matches: isAerospaceNode,
        mount: createCanvasApparatusMount(drawLiveFormationHud),
        unmount: unmountCanvasApparatus,
        getPcapConfig: () => ({
            apiBase: RADAR_API,
            attacks: [
                { label: "[!] GPS Teleport Spoof PCAP (Overlay)", pcap: "uav_gps_teleport_attack.pcap", attack_type: "gps_teleport", mode: "overlay", duration_sec: 15 },
                { label: "[!] STANAG Sequence Replay PCAP (Overlay)", pcap: "uav_stanag_replay_attack.pcap", attack_type: "stanag_replay", mode: "overlay", duration_sec: 15 }
            ]
        })
    });

    window.SentinelUI.registerApparatus({
        id: "flir_radiometric_gimbal",
        title: "OPTICAL FLIR RADIOMETRIC GIMBAL",
        shortLabel: "📷 FLIR GIMBAL",
        aspectRatio: 1.25,
        protocol: "FLIR RADIOMETRIC / PCAP",
        defaultForTypes: ["video"],
        matches: isAerospaceNode,
        mount: createCanvasApparatusMount(drawLiveFlirGimbal),
        unmount: unmountCanvasApparatus,
        getPcapConfig: () => ({
            apiBase: FLIR_API,
            attacks: [
                { label: "[!] Optical Laser Dazzle PCAP (Replace)", pcap: "flir_laser_dazzle_attack.pcap", attack_type: "laser_dazzle", mode: "replace", duration_sec: 15 }
            ]
        })
    });

    // Preserve Legacy Node Adapter for backward compatibility
    window.SentinelUI.registerNodeAdapter({
        id: "aerospace_swarm_adapter",
        matches: isAerospaceNode,
        instrumentTag: "STANAG 4586",
        renderPrimaryInstrument: (canvas, node) => {
            const type = (node?.primary_instrument?.type || "radar").toLowerCase();
            if (type === "video") drawLiveFlirGimbal(canvas, node);
            else if (type === "formation") drawLiveFormationHud(canvas, node);
            else drawLiveTacticalRadar(canvas, node, { sweep: (Date.now() * 0.002) % (Math.PI * 2) });
        }
    });

    // ========================================================================
    // 4. 7-LAYER 3D TACTICAL SWARM & SATCOM THEATRE C2 TAB (PRESERVED)
    // ========================================================================
    const ORIGIN_LON = 4.9000;
    const ORIGIN_LAT = 52.3700;
    let c2AnimId = null;
    let currentFormation = "v_formation";
    let isJammingActive = true;
    let lockedEntity = null;
    const layerVis = { arcs: true, ghostPath: true, jamDome: true, stalks: true, terrain: true };
    let viewState = { longitude: ORIGIN_LON, latitude: ORIGIN_LAT, zoom: 14.3, pitch: 58, bearing: -24 };

    function metersToLngLat(eastMeters, northMeters) {
        const dLat = northMeters / 111320.0;
        const dLon = eastMeters / (111320.0 * Math.cos(ORIGIN_LAT * Math.PI / 180.0));
        return [ORIGIN_LON + dLon, ORIGIN_LAT + dLat];
    }

    function getTerrainElevation(x, y) {
        const d = Math.sqrt(x * x + y * y);
        const ridge = Math.max(0, (d - 220) * 0.14);
        const wave = (Math.sin(x * 0.008) * Math.cos(y * 0.008) + 1.0) * 28.0;
        return Math.min(135, ridge * (0.4 + 0.6 * Math.sin(x * 0.005 + y * 0.004)) + wave * 0.35);
    }

    function initDeckGlSwarmC2(container) {
        if (c2AnimId) cancelAnimationFrame(c2AnimId);

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div class="c2-command-bar">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">
                            DECK.GL 3D TACTICAL SWARM &amp; SATCOM THEATRE C2
                        </span>
                        <span class="badge badge-green" style="font-size:9px;">7-LAYER 3D THEATRE ENGINE</span>
                        <span class="badge badge-cyan" style="font-size:9px;">STANAG 4586 + CCSDS 133</span>
                    </div>
                    <div class="c2-btn-group">
                        <span style="font-size:9px; color:#8A99AD; font-family:monospace; margin-right:4px;">FORMATION:</span>
                        <button id="c2-form-v" class="c2-pill-btn active-green">V-WEDGE</button>
                        <button id="c2-form-echelon" class="c2-pill-btn">ECHELON RIGHT</button>
                        <button id="c2-form-diamond" class="c2-pill-btn">DIAMOND ESCORT</button>
                        <button id="c2-form-orbit" class="c2-pill-btn">COMBAT ORBIT</button>
                        <button id="c2-toggle-jam" class="c2-pill-btn active-danger">[!] EW JAMMER: ACTIVE</button>
                    </div>
                </div>
                <div id="deck-theatre-wrap" class="deck-theatre-wrap" style="cursor:grab; position:relative; height:600px;">
                    <canvas id="deck-hud-grid-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2;"></canvas>
                </div>
            </div>
        `;

        const hudCanvas = document.getElementById("deck-hud-grid-canvas");
        const formMap = { "c2-form-v": "v_formation", "c2-form-echelon": "echelon", "c2-form-diamond": "diamond", "c2-form-orbit": "orbit" };
        Object.keys(formMap).forEach(btnId => {
            document.getElementById(btnId)?.addEventListener("click", (e) => {
                currentFormation = formMap[btnId];
                Object.keys(formMap).forEach(id => document.getElementById(id)?.classList.remove("active-green"));
                e.currentTarget.classList.add("active-green");
                fetch(`http://${HOST}:18090/formation`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ formation: currentFormation })
                }).catch(() => { });
            });
        });

        document.getElementById("c2-toggle-jam")?.addEventListener("click", (e) => {
            isJammingActive = !isJammingActive;
            e.currentTarget.classList.toggle("active-danger", isJammingActive);
            e.currentTarget.textContent = isJammingActive ? "[!] EW JAMMER: ACTIVE" : "[+] EW JAMMER: SUPPRESSED";
        });

        TelemetryBus.acquire();
        let tick = 0;
        function animate() {
            c2AnimId = requestAnimationFrame(animate);
            tick += 0.016;
            const d = TelemetryBus.radar?.drones || {};
            const w = hudCanvas.clientWidth || 960;
            const h = hudCanvas.clientHeight || 600;
            if (hudCanvas.width !== w || hudCanvas.height !== h) { hudCanvas.width = w; hudCanvas.height = h; }
            const ctx = hudCanvas.getContext("2d");
            ctx.fillStyle = "#040810";
            ctx.fillRect(0, 0, w, h);

            const cx = w / 2, cy = h / 2;
            const scale = Math.min(w, h) / 720.0;
            ctx.strokeStyle = "rgba(0,229,255,0.12)";
            [150, 300, 450].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke(); });

            [["alpha", "#00FFA3"], ["bravo", "#00E5FF"], ["charlie", "#FFB800"]].forEach(([k, col]) => {
                const p = d[k];
                if (!p) return;
                const px = cx + p.x * scale, py = cy - p.y * scale;
                ctx.fillStyle = col;
                ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
                ctx.font = "bold 10px monospace";
                ctx.fillText(`${p.callsign} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}m)`, px + 10, py + 4);
            });
        }
        animate();
    }

    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => initDeckGlSwarmC2(container)
    });

    console.log("[Aerospace Plugin] Registered 3 Live Dual-PCAP Apparatus Plugins (Radar, HUD, FLIR) + 3D C2 Tab.");
})();

// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js
// ==============================================================================
// ARYORITHM AEROSPACE PLUGIN:
//   1. 3 Live Dual-PCAP Apparatus Plugins (Radar :18091, HUD :18091, FLIR :18092)
//   2. Full 7-Layer 3D Tactical Swarm & Satcom Theatre C2 Tab (:18090)
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
            } catch (_) {}

            try {
                const f = await fetch(`${FLIR_API}/telemetry`, { cache: "no-store" });
                if (f.ok) {
                    this.flir = await f.json();
                }
            } catch (_) {}
        }
    };

    const isAerospaceNode = (node) =>
        /aerospace|uav|swarm/i.test(node?.site || "") || /drone/i.test(node?.hostname || "");

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
    // 1. LIVE DUAL-PCAP APPARATUS PLUGINS (Mission Control & Research Lab)
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

        ctx.strokeStyle = "rgba(0, 229, 255, 0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
        ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
        ctx.stroke();

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

        const scale = maxR / 600.0;
        const toPx = (x, y) => ({ px: cx + x * scale, py: cy - y * scale });
        const palette = { alpha: "#00FFA3", bravo: "#00E5FF", charlie: "#FFB800" };
        const drones = data?.drones || {};

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

            const vx = Math.sin(d.heading || 0) * 18;
            const vy = -Math.cos(d.heading || 0) * 18;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p.px + vx, p.py + vy);
            ctx.stroke();

            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(p.px, p.py, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = col;
            ctx.fillText(`${d.callsign} [${d.squawk}]`, p.px + 8, p.py - 2);
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#CBD5E1";
            ctx.fillText(`Z:${Number(d.z).toFixed(0)}m V:${Number(d.v_mps).toFixed(1)}m/s h:${Number(d.cbf_h).toFixed(0)}`, p.px + 8, p.py + 10);
        });

        ghosts.forEach(g => {
            const real = drones[g.target] || { x: 0, y: 0 };
            const pReal = toPx(real.x, real.y);
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

    function drawLiveFlirGimbal(canvas, node) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const flir = TelemetryBus.flir?.flir;
        const atk = TelemetryBus.flir?.active_attack || { active: false };
        const isDazzle = Boolean(flir?.laser_dazzle || atk.active);

        ctx.fillStyle = "#060418";
        ctx.fillRect(0, 0, w, h);

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

        ctx.strokeStyle = "#00FFA3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 22, cy);
        ctx.stroke();

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

        const hdgDeg = (((self.heading || 0) * 180.0 / Math.PI) + 360.0) % 360.0;
        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        ctx.fillText(
            `HDG: ${hdgDeg.toFixed(1)}°  |  ROLL: ${Number(self.roll_deg || 0).toFixed(2)}°  |  FORMATION: ${(data?.formation || "v_formation").toUpperCase()}`,
            12, h - 10
        );
    }

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

    // Legacy Node Adapter for backward compatibility
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
    // 2. DECK.GL 7-LAYER 3D TACTICAL SWARM & SATCOM THEATRE C2 (FULL ORIGINAL)
    // ========================================================================
    const ORIGIN_LON = 4.9000;
    const ORIGIN_LAT = 52.3700;

    let c2AnimId = null;
    let gcsPollTimer = null;
    let currentFormation = "v_formation";
    let isJammingActive = true;
    let lockedEntity = null;

    const layerVis = {
        arcs: true,
        ghostPath: true,
        jamDome: true,
        stalks: true,
        terrain: true
    };

    let viewState = {
        longitude: ORIGIN_LON,
        latitude: ORIGIN_LAT,
        zoom: 14.3,
        pitch: 58,
        bearing: -24
    };

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
        if (gcsPollTimer) clearInterval(gcsPollTimer);

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <!-- TOP C2 COMMAND & FORMATION BAR -->
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

                <!-- SECOND BAR: CAMERA LOCK-ON & LAYER FILTERS -->
                <div class="c2-command-bar" style="padding:7px 16px;">
                    <div class="c2-btn-group">
                        <span style="font-size:9px; color:#8A99AD; font-family:monospace;">CAMERA LOCK:</span>
                        <button class="c2-pill-btn active-cyan" data-lock="free">[THEATRE FREE]</button>
                        <button class="c2-pill-btn" data-lock="alpha">[LOCK: UAV-ALPHA]</button>
                        <button class="c2-pill-btn" data-lock="bravo">[LOCK: UAV-BRAVO]</button>
                        <button class="c2-pill-btn" data-lock="charlie">[LOCK: UAV-CHARLIE]</button>
                        <button class="c2-pill-btn" data-lock="ew">[LOCK: EW-SPOOFER]</button>
                        <button class="c2-pill-btn" data-lock="sat">[LOCK: LEO-SATCOM]</button>
                    </div>

                    <div class="c2-btn-group">
                        <span style="font-size:9px; color:#8A99AD; font-family:monospace;">LAYERS:</span>
                        <button class="c2-pill-btn active-cyan" data-layer="terrain">3D TOPO TERRAIN</button>
                        <button class="c2-pill-btn active-cyan" data-layer="arcs">C2 &amp; SATCOM ARCS</button>
                        <button class="c2-pill-btn active-cyan" data-layer="ghostPath">GHOST SPOOF VECTOR</button>
                        <button class="c2-pill-btn active-cyan" data-layer="jamDome">3D EW JAMMING DOME</button>
                        <button class="c2-pill-btn active-cyan" data-layer="stalks">ALTITUDE STALKS</button>
                    </div>
                </div>

                <!-- MAIN 3D THEATRE VIEWPORT -->
                <div id="deck-theatre-wrap" class="deck-theatre-wrap" style="cursor:grab;">
                    <canvas id="deck-hud-grid-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2;"></canvas>

                    <!-- TOP-LEFT CAMERA & NAVIGATION HUD -->
                    <div class="c2-hud-panel" style="top:12px; left:12px; min-width:255px;">
                        <div style="color:#00E5FF; font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between;">
                            <span>3D CAMERA &amp; OPTICS</span>
                            <span id="c2-lock-label" style="color:#00FFA3;">FREE ORBIT</span>
                        </div>
                        <div style="font-size:9px; color:#8A99AD; margin-bottom:8px;">
                            Left-Drag: 3D Rotate/Pitch &bull; Right-Drag: Pan &bull; Scroll: Zoom
                        </div>
                        <div class="c2-slider-row">
                            <span>3D Pitch (<b id="lbl-pitch">58°</b>):</span>
                            <input type="range" id="sl-pitch" min="5" max="85" value="58">
                        </div>
                        <div class="c2-slider-row">
                            <span>Bearing (<b id="lbl-bearing">-24°</b>):</span>
                            <input type="range" id="sl-bearing" min="-180" max="180" value="-24">
                        </div>
                        <div class="c2-slider-row">
                            <span>Theatre Zoom (<b id="lbl-zoom">14.3</b>):</span>
                            <input type="range" id="sl-zoom" min="12.5" max="16.8" step="0.1" value="14.3">
                        </div>
                    </div>

                    <!-- TOP-RIGHT SWARM TELEMETRY & HARDWARE ROOTS -->
                    <div class="c2-hud-panel" style="top:12px; right:12px; min-width:280px;">
                        <div style="color:#00FFA3; font-weight:800; margin-bottom:6px;">
                            ACTIVE SWARM ENCLAVE TELEMETRY
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#00FFA3; font-weight:700;">● UAV-ALPHA (LEADER) &bull; 10.240.52.121</div>
                            <div style="color:#8A99AD; font-size:9px;">ALT: 120.4m | V: 24.2 m/s | STANAG: <b style="color:#00FFA3;">PASS (23.77ns)</b></div>
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#00E5FF; font-weight:700;">● UAV-BRAVO (WING-1) &bull; 10.240.52.123</div>
                            <div style="color:#8A99AD; font-size:9px;">ALT: 118.0m | V: 24.0 m/s | GPS GUARD: <b id="bravo-guard-state" style="color:#FF3366;">SPOOF BLOCKED</b></div>
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#FFB800; font-weight:700;">● UAV-CHARLIE (RECON) &bull; 10.240.52.124</div>
                            <div style="color:#8A99AD; font-size:9px;">ALT: 145.2m | LIDAR: 145.2m | FLIR: <b style="color:#00FFA3;">STREAMING</b></div>
                        </div>
                        <div>
                            <div style="color:#C084FC; font-weight:700;">● SAT-CCSDS-133 (LEO) &bull; SPI: 0x0100</div>
                            <div style="color:#8A99AD; font-size:9px;">KA-BAND UPLINK: 50.100 | ANTI-REPLAY WINDOW: 128-BIT</div>
                        </div>
                    </div>

                    <!-- BOTTOM-LEFT LEGEND & CBF SAFETY BARRIER -->
                    <div class="c2-hud-panel" style="bottom:12px; left:12px; display:flex; gap:16px; align-items:center;">
                        <div><span style="color:#00FFA3;">━━</span> STANAG 4586 Safe Corridor</div>
                        <div><span style="color:#FF3366;">╌╌</span> Rejected GPS Spoof Ghost Vector</div>
                        <div><span style="color:#00E5FF;">⌒●</span> Live Packet Stream</div>
                        <div><span style="color:#C084FC;">⌒●</span> CCSDS 133 Satcom</div>
                    </div>

                    <!-- BOTTOM-RIGHT CBF INVARIANT METRICS -->
                    <div class="c2-hud-panel" style="bottom:12px; right:12px; border-color:#00FFA3;">
                        <div style="color:#00FFA3; font-weight:800;">CBF BARRIER h(x) = v_max - ||v|| &ge; 0</div>
                        <div>Safety Margin: <b style="color:#00E5FF;">+55.8 m/s</b> | Actuator Air-Gap: <b style="color:#00FFA3;">ARMED (&lt; 15ns)</b></div>
                    </div>
                </div>
            </div>
        `;

        const wrap = document.getElementById("deck-theatre-wrap");
        const hudCanvas = document.getElementById("deck-hud-grid-canvas");

        const slPitch = document.getElementById("sl-pitch");
        const slBearing = document.getElementById("sl-bearing");
        const slZoom = document.getElementById("sl-zoom");

        function syncSlidersFromView() {
            if (slPitch) slPitch.value = Math.round(viewState.pitch);
            if (slBearing) slBearing.value = Math.round(viewState.bearing);
            if (slZoom) slZoom.value = viewState.zoom.toFixed(1);
            const lp = document.getElementById("lbl-pitch");
            const lb = document.getElementById("lbl-bearing");
            const lz = document.getElementById("lbl-zoom");
            if (lp) lp.textContent = `${Math.round(viewState.pitch)}°`;
            if (lb) lb.textContent = `${Math.round(viewState.bearing)}°`;
            if (lz) lz.textContent = `${Number(viewState.zoom).toFixed(1)}`;
        }

        slPitch?.addEventListener("input", (e) => { viewState.pitch = Number(e.target.value); syncSlidersFromView(); });
        slBearing?.addEventListener("input", (e) => { viewState.bearing = Number(e.target.value); syncSlidersFromView(); });
        slZoom?.addEventListener("input", (e) => { viewState.zoom = Number(e.target.value); syncSlidersFromView(); });

        const formMap = {
            "c2-form-v": "v_formation",
            "c2-form-echelon": "echelon",
            "c2-form-diamond": "diamond",
            "c2-form-orbit": "orbit"
        };
        Object.keys(formMap).forEach(btnId => {
            document.getElementById(btnId)?.addEventListener("click", (e) => {
                currentFormation = formMap[btnId];
                Object.keys(formMap).forEach(id => document.getElementById(id)?.classList.remove("active-green"));
                e.currentTarget.classList.add("active-green");

                fetch(`http://${HOST}:18090/formation`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ formation: currentFormation })
                }).catch(() => {});
            });
        });

        document.getElementById("c2-toggle-jam")?.addEventListener("click", (e) => {
            isJammingActive = !isJammingActive;
            e.currentTarget.classList.toggle("active-danger", isJammingActive);
            e.currentTarget.textContent = isJammingActive ? "[!] EW JAMMER: ACTIVE" : "[+] EW JAMMER: SUPPRESSED";
            const bState = document.getElementById("bravo-guard-state");
            if (bState) {
                bState.textContent = isJammingActive ? "SPOOF BLOCKED" : "NOMINAL";
                bState.style.color = isJammingActive ? "#FF3366" : "#00FFA3";
            }
        });

        container.querySelectorAll("[data-lock]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                container.querySelectorAll("[data-lock]").forEach(b => b.classList.remove("active-cyan"));
                e.currentTarget.classList.add("active-cyan");
                const target = e.currentTarget.getAttribute("data-lock");
                lockedEntity = (target === "free") ? null : target;
                const lockLbl = document.getElementById("c2-lock-label");
                if (lockLbl) lockLbl.textContent = lockedEntity ? `LOCKED: ${lockedEntity.toUpperCase()}` : "FREE ORBIT";
                if (!lockedEntity) {
                    viewState = { longitude: ORIGIN_LON, latitude: ORIGIN_LAT, zoom: 14.3, pitch: 58, bearing: -24 };
                    syncSlidersFromView();
                }
            });
        });

        container.querySelectorAll("[data-layer]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const layerKey = e.currentTarget.getAttribute("data-layer");
                layerVis[layerKey] = !layerVis[layerKey];
                e.currentTarget.classList.toggle("active-cyan", layerVis[layerKey]);
            });
        });

        let dragMode = null;
        let lastX = 0, lastY = 0;
        wrap.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
            dragMode = (e.button === 2 || e.ctrlKey || e.shiftKey) ? "pan" : "rotate";
            wrap.style.cursor = dragMode === "pan" ? "move" : "grabbing";
            lastX = e.clientX;
            lastY = e.clientY;
        });
        window.addEventListener("mouseup", () => {
            dragMode = null;
            wrap.style.cursor = "grab";
        });
        wrap.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("mousemove", (e) => {
            if (!dragMode) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            if (dragMode === "rotate") {
                viewState.bearing = ((viewState.bearing + dx * 0.4 + 540) % 360) - 180;
                viewState.pitch = Math.max(5, Math.min(85, viewState.pitch + dy * 0.35));
            } else if (dragMode === "pan" && !lockedEntity) {
                const scale = Math.pow(2, 14.3 - viewState.zoom) * 1.6;
                const rad = (viewState.bearing * Math.PI) / 180.0;
                const eastDelta = (-dx * Math.cos(rad) + dy * Math.sin(rad)) * scale;
                const northDelta = (dx * Math.sin(rad) + dy * Math.cos(rad)) * scale;
                const [nLon, nLat] = metersToLngLat(eastDelta, northDelta);
                viewState.longitude += (nLon - ORIGIN_LON);
                viewState.latitude += (nLat - ORIGIN_LAT);
            }
            syncSlidersFromView();
        });
        wrap.addEventListener("wheel", (e) => {
            e.preventDefault();
            viewState.zoom = Math.max(12.5, Math.min(16.8, viewState.zoom - e.deltaY * 0.0018));
            syncSlidersFromView();
        }, { passive: false });

        let tick = 0;
        let posAlpha = { x: 0, y: 80, z: 120, heading: 0, roll: 0 };
        let posBravo = { x: -140, y: -40, z: 118, heading: 0, roll: 0 };
        let posCharlie = { x: 140, y: -40, z: 145, heading: 0, roll: 0 };
        const posGcs = { x: 0, y: -420, z: 18 };
        const posEw = { x: 420, y: 220, z: 42 };

        const trailAlpha = [];
        const trailBravo = [];
        const trailCharlie = [];

        const waypointGates = [
            { id: "WP-01 [ENTRY]", x: -160, y: -180, z: 115 },
            { id: "WP-02 [CORRIDOR]", x: -60, y: 0, z: 120 },
            { id: "WP-03 [TARGET]", x: 60, y: 140, z: 125 },
            { id: "WP-04 [EGRESS]", x: 180, y: 260, z: 130 }
        ];

        let dockerTargetAlpha = { x: 0, y: 80, z: 120, heading: 0, roll: 0, v_mps: 24.2 };
        let dockerTargetBravo = { x: -135, y: -25, z: 118, heading: 0, roll: 0, v_mps: 24.0 };
        let dockerTargetCharlie = { x: 135, y: -25, z: 145, heading: 0, roll: 0, v_mps: 24.4 };
        let dockerTargetSat = { x: 0, y: 0, z: 420 };
        let dockerGcsOnline = false;
        let dockerLastSeq = 100;

        async function pollDockerGcsTelemetry() {
            try {
                const resp = await fetch(`http://${HOST}:18090/telemetry`, { cache: "no-store" });
                if (resp.ok) {
                    const data = await resp.json();
                    dockerGcsOnline = true;
                    dockerLastSeq = data.seq || dockerLastSeq;
                    if (data.drones) {
                        if (data.drones.alpha) dockerTargetAlpha = data.drones.alpha;
                        if (data.drones.bravo) dockerTargetBravo = data.drones.bravo;
                        if (data.drones.charlie) dockerTargetCharlie = data.drones.charlie;
                    }
                    if (data.sat) dockerTargetSat = data.sat;
                } else {
                    dockerGcsOnline = false;
                }
            } catch (e) {
                dockerGcsOnline = false;
            }
        }

        gcsPollTimer = setInterval(pollDockerGcsTelemetry, 100);
        pollDockerGcsTelemetry();

        function animateTheatre() {
            c2AnimId = requestAnimationFrame(animateTheatre);
            tick += 0.016;

            posAlpha.x += (dockerTargetAlpha.x - posAlpha.x) * 0.12;
            posAlpha.y += (dockerTargetAlpha.y - posAlpha.y) * 0.12;
            posAlpha.z += (dockerTargetAlpha.z - posAlpha.z) * 0.12;
            posAlpha.heading = dockerTargetAlpha.heading || 0;
            posAlpha.roll = dockerTargetAlpha.roll || 0;

            posBravo.x += (dockerTargetBravo.x - posBravo.x) * 0.12;
            posBravo.y += (dockerTargetBravo.y - posBravo.y) * 0.12;
            posBravo.z += (dockerTargetBravo.z - posBravo.z) * 0.12;
            posBravo.heading = dockerTargetBravo.heading || 0;
            posBravo.roll = dockerTargetBravo.roll || 0;

            posCharlie.x += (dockerTargetCharlie.x - posCharlie.x) * 0.12;
            posCharlie.y += (dockerTargetCharlie.y - posCharlie.y) * 0.12;
            posCharlie.z += (dockerTargetCharlie.z - posCharlie.z) * 0.12;
            posCharlie.heading = dockerTargetCharlie.heading || 0;
            posCharlie.roll = dockerTargetCharlie.roll || 0;

            const posSat = { x: dockerTargetSat.x, y: dockerTargetSat.y, z: dockerTargetSat.z };

            if (dockerGcsOnline && Math.floor(tick * 60) % 2 === 0) {
                trailAlpha.push({ x: posAlpha.x, y: posAlpha.y, z: posAlpha.z });
                trailBravo.push({ x: posBravo.x, y: posBravo.y, z: posBravo.z });
                trailCharlie.push({ x: posCharlie.x, y: posCharlie.y, z: posCharlie.z });
                if (trailAlpha.length > 55) trailAlpha.shift();
                if (trailBravo.length > 55) trailBravo.shift();
                if (trailCharlie.length > 55) trailCharlie.shift();
            }

            if (lockedEntity) {
                const mapTarget = { alpha: posAlpha, bravo: posBravo, charlie: posCharlie, ew: posEw, sat: posSat }[lockedEntity];
                if (mapTarget) {
                    const [tLon, tLat] = metersToLngLat(mapTarget.x, mapTarget.y);
                    viewState.longitude += (tLon - viewState.longitude) * 0.14;
                    viewState.latitude += (tLat - viewState.latitude) * 0.14;
                }
            }

            render7LayerTheatre(hudCanvas, {
                posAlpha, posBravo, posCharlie, posGcs, posEw, posSat,
                trailAlpha, trailBravo, trailCharlie, waypointGates, tick,
                dockerGcsOnline, dockerLastSeq
            });
        }

        animateTheatre();
    }

    // ========================================================================
    // 3. 7-LAYER 3D TACTICAL THEATRE RENDERING PIPELINE (FULL ORIGINAL)
    // ========================================================================
    function render7LayerTheatre(canvas, state) {
        if (!canvas) return;
        const w = canvas.clientWidth || 960;
        const h = canvas.clientHeight || 600;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext("2d");

        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.75);
        bgGrad.addColorStop(0, "#07101e");
        bgGrad.addColorStop(1, "#02050a");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const yaw = (viewState.bearing * Math.PI) / 180.0;
        const pitch = ((90 - viewState.pitch) * Math.PI) / 180.0;
        const zoomScale = Math.pow(2, viewState.zoom - 14.3);

        const panEast = (viewState.longitude - ORIGIN_LON) * 111320 * Math.cos(ORIGIN_LAT * Math.PI / 180);
        const panNorth = (viewState.latitude - ORIGIN_LAT) * 111320;

        function project3D(eastM, northM, altM) {
            const rx = eastM - panEast;
            const ry = northM - panNorth;
            const rz = altM;

            const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
            const x1 = rx * cosY - ry * sinY;
            const y1 = rx * sinY + ry * cosY;

            const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
            const y2 = y1 * sinP - rz * cosP;
            const z2 = y1 * cosP + rz * sinP;

            const fov = 780 * zoomScale;
            const depth = 1150 + z2;
            const s = fov / Math.max(60, depth);

            return { x: w / 2 + x1 * s, y: h / 2 + 40 - y2 * s, s, depth };
        }

        // LAYER 1: 3D TOPOGRAPHIC WIREFRAME TERRAIN & TACTICAL GRID
        const gridRange = 720;
        const gridStep = 80;

        if (layerVis.terrain) {
            ctx.lineWidth = 1;
            for (let x = -gridRange; x <= gridRange; x += gridStep) {
                ctx.beginPath();
                for (let y = -gridRange; y <= gridRange; y += gridStep) {
                    const elev = getTerrainElevation(x, y);
                    const pt = project3D(x, y, elev);
                    if (y === -gridRange) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = (x === 0) ? "rgba(0, 229, 255, 0.35)" : "rgba(0, 180, 255, 0.13)";
                ctx.stroke();
            }
            for (let y = -gridRange; y <= gridRange; y += gridStep) {
                ctx.beginPath();
                for (let x = -gridRange; x <= gridRange; x += gridStep) {
                    const elev = getTerrainElevation(x, y);
                    const pt = project3D(x, y, elev);
                    if (x === -gridRange) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = (y === 0) ? "rgba(0, 229, 255, 0.35)" : "rgba(0, 180, 255, 0.13)";
                ctx.stroke();
            }
        }

        [250, 500, 750].forEach((rad, idx) => {
            ctx.strokeStyle = idx === 1 ? "rgba(0, 255, 163, 0.32)" : "rgba(0, 255, 163, 0.18)";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
                const pt = project3D(Math.cos(a) * rad, Math.sin(a) * rad, 0);
                if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        });

        // LAYER 2: 3D GEODESIC EW JAMMING DOME (HEMISPHERE + SWEEP)
        if (layerVis.jamDome && isJammingActive) {
            const domeR = 230;
            [0.0, 0.35, 0.65, 0.9].forEach(elevFactor => {
                const ringAlt = Math.sin(elevFactor * Math.PI / 2) * 165;
                const ringRad = Math.cos(elevFactor * Math.PI / 2) * domeR;
                ctx.strokeStyle = "rgba(255, 51, 102, 0.38)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let a = 0; a <= Math.PI * 2 + 0.12; a += 0.12) {
                    const pt = project3D(state.posEw.x + Math.cos(a) * ringRad, state.posEw.y + Math.sin(a) * ringRad, ringAlt);
                    if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            });

            for (let m = 0; m < 6; m++) {
                const mAngle = (m / 6) * Math.PI + state.tick * 0.25;
                ctx.strokeStyle = "rgba(255, 51, 102, 0.28)";
                ctx.beginPath();
                for (let p = 0; p <= Math.PI; p += 0.15) {
                    const rProj = Math.cos(p) * domeR;
                    const altProj = Math.sin(p) * 165;
                    const pt = project3D(
                        state.posEw.x + Math.cos(mAngle) * rProj,
                        state.posEw.y + Math.sin(mAngle) * rProj,
                        altProj
                    );
                    if (p === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            }
        }

        // LAYER 3: 3D AIRSPACE WAYPOINT CORRIDOR GATES
        state.waypointGates.forEach(gate => {
            const gw = 32, gh = 22;
            const c1 = project3D(gate.x - gw, gate.y, gate.z - gh);
            const c2 = project3D(gate.x + gw, gate.y, gate.z - gh);
            const c3 = project3D(gate.x + gw, gate.y, gate.z + gh);
            const c4 = project3D(gate.x - gw, gate.y, gate.z + gh);

            ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y);
            ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
            ctx.closePath();
            ctx.stroke();

            ctx.font = "8px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(0, 229, 255, 0.75)";
            ctx.fillText(gate.id, c4.x, c4.y - 4);
        });

        // LAYER 4: 3D FLIGHT RIBBONS, CURTAINS & GHOST SPOOF VECTOR
        function drawFlightRibbon(trail, colorRgb) {
            if (trail.length < 2) return;
            ctx.strokeStyle = `rgba(${colorRgb}, 0.85)`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            trail.forEach((p, idx) => {
                const pt = project3D(p.x, p.y, p.z);
                if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();

            if (layerVis.stalks) {
                ctx.strokeStyle = `rgba(${colorRgb}, 0.16)`;
                ctx.lineWidth = 1;
                for (let i = 0; i < trail.length; i += 4) {
                    const p = trail[i];
                    const top = project3D(p.x, p.y, p.z);
                    const bot = project3D(p.x, p.y, 0);
                    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
                }
            }
        }

        drawFlightRibbon(state.trailAlpha, "0, 255, 163");
        drawFlightRibbon(state.trailBravo, "0, 229, 255");
        drawFlightRibbon(state.trailCharlie, "255, 184, 0");

        if (layerVis.ghostPath && isJammingActive) {
            const pB = project3D(state.posBravo.x, state.posBravo.y, state.posBravo.z);
            const ghostX = state.posBravo.x + 250;
            const ghostY = state.posBravo.y + 190;
            const ghostZ = state.posBravo.z + 75;
            const pGhost = project3D(ghostX, ghostY, ghostZ);

            ctx.strokeStyle = "#FF3366";
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(pB.x, pB.y); ctx.lineTo(pGhost.x, pGhost.y); ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = "#FF3366";
            ctx.beginPath();
            ctx.arc(pGhost.x, pGhost.y, 8, 0, Math.PI * 2);
            ctx.moveTo(pGhost.x - 6, pGhost.y - 6); ctx.lineTo(pGhost.x + 6, pGhost.y + 6);
            ctx.moveTo(pGhost.x + 6, pGhost.y - 6); ctx.lineTo(pGhost.x - 6, pGhost.y + 6);
            ctx.stroke();

            ctx.fillStyle = "#FF3366";
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillText("[CBF BLOCKED] SPOOFED GPS GHOST VECTOR (ΔV=420m/s)", pGhost.x + 12, pGhost.y + 3);
        }

        // LAYER 5: 3D PARABOLIC DATA-LINK ARCS & LIVE PACKET PULSES
        function drawParabolicLink(from, to, arcColor, pulseColor, arcHeight, isHostile = false) {
            if (!layerVis.arcs) return;
            ctx.strokeStyle = arcColor;
            ctx.lineWidth = isHostile ? 1.8 : 1.5;
            if (isHostile) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);

            ctx.beginPath();
            for (let t = 0; t <= 1.02; t += 0.05) {
                const ix = from.x + (to.x - from.x) * t;
                const iy = from.y + (to.y - from.y) * t;
                const iz = from.z + (to.z - from.z) * t + Math.sin(t * Math.PI) * arcHeight;
                const pt = project3D(ix, iy, iz);
                if (t === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            const pulseT = (state.tick * (isHostile ? 1.3 : 0.9)) % 1.0;
            const px = from.x + (to.x - from.x) * pulseT;
            const py = from.y + (to.y - from.y) * pulseT;
            const pz = from.z + (to.z - from.z) * pulseT + Math.sin(pulseT * Math.PI) * arcHeight;
            const pPulse = project3D(px, py, pz);

            ctx.fillStyle = pulseColor;
            ctx.beginPath();
            ctx.arc(pPulse.x, pPulse.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        drawParabolicLink(state.posSat, state.posGcs, "rgba(192, 132, 252, 0.55)", "#C084FC", 110);
        drawParabolicLink(state.posGcs, state.posAlpha, "rgba(0, 229, 255, 0.65)", "#00E5FF", 85);
        drawParabolicLink(state.posAlpha, state.posBravo, "rgba(0, 255, 163, 0.6)", "#00FFA3", 35);
        drawParabolicLink(state.posAlpha, state.posCharlie, "rgba(0, 255, 163, 0.6)", "#FFB800", 35);

        if (isJammingActive) {
            drawParabolicLink(state.posEw, state.posAlpha, "rgba(255, 51, 102, 0.75)", "#FF3366", 65, true);
            drawParabolicLink(state.posEw, state.posBravo, "rgba(255, 51, 102, 0.75)", "#FF3366", 65, true);
        }

        // LAYER 6 & 7: 3D STEALTH UAV AIRFRAMES, SATELLITE & MIL-STD CALLSIGNS
        function draw3DStealthDrone(pos, hexColor, callsign, telemetrySub) {
            const pCenter = project3D(pos.x, pos.y, pos.z);
            const pGround = project3D(pos.x, pos.y, 0);

            if (layerVis.stalks) {
                ctx.strokeStyle = hexColor;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(pCenter.x, pCenter.y);
                ctx.lineTo(pGround.x, pGround.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(pGround.x, pGround.y, 5 * pGround.s, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            const scale = 1.35;
            const cosH = Math.cos(pos.heading || 0);
            const sinH = Math.sin(pos.heading || 0);

            function rotLocal(lx, ly, lz) {
                const rx = lx * cosH + ly * sinH;
                const ry = -lx * sinH + ly * cosH;
                return project3D(pos.x + rx * scale, pos.y + ry * scale, pos.z + lz * scale);
            }

            const vNose = rotLocal(0, 24, 0);
            const vWingL = rotLocal(-22, -12, (pos.roll || 0) * 18);
            const vInnerL = rotLocal(-6, -8, 0);
            const vTail = rotLocal(0, -16, 2);
            const vInnerR = rotLocal(6, -8, 0);
            const vWingR = rotLocal(22, -12, -(pos.roll || 0) * 18);
            const vCanopy = rotLocal(0, 6, 4);

            ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
            ctx.strokeStyle = hexColor;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(vNose.x, vNose.y);
            ctx.lineTo(vWingL.x, vWingL.y);
            ctx.lineTo(vInnerL.x, vInnerL.y);
            ctx.lineTo(vTail.x, vTail.y);
            ctx.lineTo(vInnerR.x, vInnerR.y);
            ctx.lineTo(vWingR.x, vWingR.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(vNose.x, vNose.y); ctx.lineTo(vCanopy.x, vCanopy.y);
            ctx.lineTo(vTail.x, vTail.y);
            ctx.stroke();

            ctx.fillStyle = hexColor;
            ctx.beginPath();
            ctx.arc(vTail.x, vTail.y, Math.max(3, 5 * pCenter.s), 0, Math.PI * 2);
            ctx.fill();

            if (isJammingActive) {
                ctx.strokeStyle = "rgba(0, 255, 163, 0.35)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(pCenter.x, pCenter.y, Math.max(16, 28 * pCenter.s), 0, Math.PI * 2);
                ctx.stroke();
            }

            const lblX = pCenter.x + 18;
            const lblY = pCenter.y - 12;
            ctx.fillStyle = "rgba(7, 11, 20, 0.82)";
            ctx.strokeStyle = hexColor;
            ctx.lineWidth = 1;
            ctx.fillRect(lblX, lblY - 11, 178, 28);
            ctx.strokeRect(lblX, lblY - 11, 178, 28);

            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = hexColor;
            ctx.fillText(callsign, lblX + 6, lblY);
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#CBD5E1";
            ctx.fillText(telemetrySub, lblX + 6, lblY + 12);
        }

        function drawStationNode(pos, hexColor, title, sub, isSat = false) {
            const pt = project3D(pos.x, pos.y, pos.z);
            const gnd = project3D(pos.x, pos.y, 0);

            if (layerVis.stalks) {
                ctx.strokeStyle = hexColor;
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(gnd.x, gnd.y); ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            ctx.strokeStyle = hexColor;
            ctx.fillStyle = "rgba(13, 19, 33, 0.9)";
            ctx.lineWidth = 2;

            if (isSat) {
                ctx.fillRect(pt.x - 6, pt.y - 6, 12, 12);
                ctx.strokeRect(pt.x - 6, pt.y - 6, 12, 12);
                ctx.fillStyle = "rgba(192, 132, 252, 0.45)";
                ctx.fillRect(pt.x - 26, pt.y - 4, 16, 8);
                ctx.fillRect(pt.x + 10, pt.y - 4, 16, 8);
                ctx.strokeRect(pt.x - 26, pt.y - 4, 16, 8);
                ctx.strokeRect(pt.x + 10, pt.y - 4, 16, 8);
            } else {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = hexColor;
            ctx.fillText(title, pt.x + 14, pt.y - 2);
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#94A3B8";
            ctx.fillText(sub, pt.x + 14, pt.y + 10);
        }

        drawStationNode(state.posGcs, "#00E5FF", "GCS-TACTICAL C2", "10.240.52.120 | STANAG 4586 TX", false);
        drawStationNode(state.posEw, "#FF3366", "EW-SPOOFER [HOSTILE]", isJammingActive ? "10.240.52.122 | RF JAMMING" : "SUPPRESSED", false);
        drawStationNode(state.posSat, "#C084FC", "SAT-CCSDS-133 [LEO]", "SPI:0x0100 | KA-BAND ORBIT", true);

        draw3DStealthDrone(state.posAlpha, "#00FFA3", "UAV-ALPHA [LEADER]", `ALT:${state.posAlpha.z.toFixed(0)}m | 23.77ns PASS`);
        draw3DStealthDrone(state.posBravo, "#00E5FF", "UAV-BRAVO [WING-1]", `ALT:${state.posBravo.z.toFixed(0)}m | ECHELON LOCK`);
        draw3DStealthDrone(state.posCharlie, "#FFB800", "UAV-CHARLIE [RECON]", `ALT:${state.posCharlie.z.toFixed(0)}m | FLIR + LIDAR`);
    }

    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => initDeckGlSwarmC2(container)
    });

    console.log("[Aerospace Plugin] Initialized 3 Live Dual-PCAP Apparatus Plugins + Full 7-Layer 3D Tactical Swarm C2.");
})();
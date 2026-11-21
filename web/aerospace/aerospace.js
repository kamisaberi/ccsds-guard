// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js
// ==============================================================================
// ARYORITHM AEROSPACE PLUGIN:
//   1. Tactical 360° Swarm Airspace Radar (Alpha Leader)
//   2. Ground Vehicle Tracking Radar - GMTI (Charlie Recon)
//   3. Swarm Formation & Intercept HUD (Bravo Wingman)
//   4. Optical FLIR Radiometric Gimbal (Thermal)
//   5. Full 7-Layer 3D Tactical Swarm & Satcom Theatre C2 (:18090)
// ==============================================================================

(function () {
    if (!window.SentinelUI) return;

    const HOST = window.location.hostname || "127.0.0.1";
    const RADAR_API = `http://${HOST}:18091`;
    const FLIR_API = `http://${HOST}:18092`;

    // Shared Live Telemetry Bus
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
                if (f.ok) this.flir = await f.json();
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
    // 1A. ALPHA LEADER: 360° TACTICAL SWARM AIRSPACE RADAR
    // ========================================================================
    function drawLiveTacticalRadar(canvas, node, state) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
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

        // Sweep
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
            ? `[!] EW THREAT ACTIVE: ${ew.reason || atk.attack_type} | BRG ${ew.bearing_deg || 0}°`
            : `[+] TACTICAL 360° AIRSPACE RADAR (ALPHA LEADER) | SEQ ${data?.seq || 0}`;
        ctx.fillText(statusMsg, 12, 18);

        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        const stats = data?.stats || {};
        ctx.fillText(
            `AIR TRACKS: 3 ACTIVE  |  NOMINAL TX: ${stats.nominal_packets_tx || 0}  |  DROPS: ${stats.kinematic_breaches_observed || 0}`,
            12, h - 9
        );
    }

    // ========================================================================
    // 1B. CHARLIE RECON: DEDICATED GROUND VEHICLE TRACKING RADAR (GMTI / RECON)
    // ========================================================================
    function drawGroundVehicleTrackingRadar(canvas, node, state) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        state.sweep = (state.sweep + 0.04) % (Math.PI * 2);

        const data = TelemetryBus.radar;
        const charlieDrone = data?.drones?.charlie || { x: 135, y: -25, z: 145, v_mps: 24.4, heading: 0.15 };
        const isAlert = Boolean(data?.ew_strobe?.active || (data?.ghost_tracks || []).length > 0);

        ctx.fillStyle = "#030611";
        ctx.fillRect(0, 0, w, h);

        const originX = w / 2;
        const originY = h - 35;
        const radarR = h - 60;
        const sectorAngle = Math.PI * 0.44; // 80° forward recon sector

        // Sector Arc & Range Bins (300m, 600m, 900m, 1200m)
        const leftAngle = -Math.PI / 2 - sectorAngle / 2;
        const rightAngle = -Math.PI / 2 + sectorAngle / 2;

        [0.25, 0.50, 0.75, 1.0].forEach((f, idx) => {
            ctx.strokeStyle = (idx === 3)
                ? (isAlert ? "rgba(255, 51, 102, 0.45)" : "rgba(0, 255, 163, 0.35)")
                : "rgba(0, 229, 255, 0.16)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(originX, originY, radarR * f, leftAngle, rightAngle);
            ctx.stroke();

            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#64748B";
            ctx.fillText(`${(idx + 1) * 300}m`, originX + 6, originY - radarR * f + 11);
        });

        // Azimuth Ray Lines
        [-sectorAngle / 2, -sectorAngle / 4, 0, sectorAngle / 4, sectorAngle / 2].forEach(a => {
            const rayAngle = -Math.PI / 2 + a;
            ctx.strokeStyle = "rgba(0, 229, 255, 0.12)";
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(originX + Math.cos(rayAngle) * radarR, originY + Math.sin(rayAngle) * radarR);
            ctx.stroke();
        });

        // Sector Sweep Beam (Wandering Back & Forth across the 80° Sector)
        const sweepPhase = Math.sin(state.sweep);
        const currentSweepAngle = -Math.PI / 2 + (sweepPhase * (sectorAngle / 2));

        ctx.save();
        ctx.translate(originX, originY);
        ctx.rotate(currentSweepAngle);
        const beamGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radarR);
        beamGrad.addColorStop(0, isAlert ? "rgba(255, 51, 102, 0.40)" : "rgba(0, 229, 255, 0.35)");
        beamGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radarR, -0.10, 0.10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Ground Road Grid Simulation (Terrain Corridor for Convoy)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(originX - 45, originY);
        ctx.lineTo(originX - 110, originY - radarR);
        ctx.moveTo(originX + 45, originY);
        ctx.lineTo(originX + 110, originY - radarR);
        ctx.stroke();

        // 4 Dynamic Ground Vehicle Tracks moving down the road
        const now = Date.now() / 1000.0;
        const groundTargets = [
            { id: "TGT-01", name: "LEAD CONVOY", range_m: 840, bearing_deg: 14.0, speed_kmh: 48.0, doppler: +13.3 },
            { id: "TGT-02", name: "ARMORED ESCORT", range_m: 920, bearing_deg: 18.0, speed_kmh: 46.0, doppler: +12.8 },
            { id: "TGT-03", name: "LOGISTICS TRK", range_m: 1050, bearing_deg: 12.0, speed_kmh: 42.0, doppler: +11.6 },
            { id: "TGT-04", name: "COMMAND VAN", range_m: 1180, bearing_deg: 16.0, speed_kmh: 44.0, doppler: +12.2 }
        ];

        groundTargets.forEach((tgt, idx) => {
            // Convoy moves forward along road with slight dynamic oscillation
            const movingRange = tgt.range_m - ((now * (tgt.speed_kmh / 3.6) + idx * 80) % 700);
            const normR = (movingRange / 1200.0) * radarR;
            const bRad = -Math.PI / 2 + ((tgt.bearing_deg - 15.0) * (Math.PI / 180.0));

            const tx = originX + Math.cos(bRad) * normR;
            const ty = originY + Math.sin(bRad) * normR;

            // Target Reticle Box
            ctx.strokeStyle = isAlert ? "#FF3366" : "#00FFA3";
            ctx.lineWidth = 1.6;
            ctx.strokeRect(tx - 12, ty - 8, 24, 16);

            // Ground Target Point
            ctx.fillStyle = isAlert ? "#FF3366" : "#00FFA3";
            ctx.beginPath();
            ctx.arc(tx, ty, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Velocity Vector Line pointing along road
            ctx.strokeStyle = "#00E5FF";
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - 4, ty + 18);
            ctx.stroke();

            // Target Data Label Block
            ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
            ctx.fillStyle = isAlert ? "#FF3366" : "#00FFA3";
            ctx.fillText(`${tgt.id}: ${tgt.name}`, tx + 16, ty - 1);
            ctx.font = "8.5px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#CBD5E1";
            ctx.fillText(`RNG:${movingRange.toFixed(0)}m SPD:${tgt.speed_kmh}km/h DOP:${tgt.doppler}m/s`, tx + 16, ty + 10);
        });

        // Top Header Strip
        ctx.fillStyle = "rgba(7, 11, 20, 0.88)";
        ctx.fillRect(0, 0, w, 28);
        ctx.fillRect(0, h - 26, w, 26);

        ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAlert ? "#FF3366" : "#00FFA3";
        ctx.fillText(
            isAlert
                ? `[!] RADAR JAMMING DETECTED | RECON POD CLUTTER ELEVATED`
                : `[+] TACTICAL VEHICLE TRACKING RADAR (CHARLIE RECON) | GMTI 80° SECTOR LOCK`,
            12, 18
        );

        ctx.font = "9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#94A3B8";
        ctx.fillText(
            `GMTI MODE: 4 GROUND TARGETS LOCKED  |  CHARLIE ALT: ${Number(charlieDrone.z || 145).toFixed(0)}m  |  POD SLANT: 840m  |  DOPPLER: ACTIVE`,
            12, h - 9
        );
    }

    // ========================================================================
    // 1C. FLIR RADIOMETRIC GIMBAL & FORMATION HUD
    // ========================================================================
    function drawLiveFlirGimbal(canvas, node) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width, h = canvas.height;
        const flir = TelemetryBus.flir?.flir;
        const atk = TelemetryBus.flir?.active_attack || { active: false };
        const isDazzle = Boolean(flir?.laser_dazzle || atk.active);

        ctx.fillStyle = "#060418";
        ctx.fillRect(0, 0, w, h);

        const grid = flir?.thermal_grid_c || [];
        let maxTemp = -999, hotR = 6, hotC = 8;
        if (grid.length > 0 && grid[0].length > 0) {
            const rows = grid.length, cols = grid[0].length;
            const cellW = w / cols, cellH = h / rows;
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
                ? `[!] OPTICAL LASER DAZZLE DETECTED | SATURATION: ${Number(flir?.saturation_pct || 94).toFixed(1)}%`
                : `[+] FLIR RADIOMETRIC 16x12 | PEAK: ${Number(flir?.peak_temp_c || 38.5).toFixed(1)}°C | AMBIENT: ${Number(flir?.ambient_temp_c || 21.4).toFixed(1)}°C`,
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
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;

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

    // ========================================================================
    // 2. APPARATUS PLUGIN REGISTRATIONS (ALPHA = 360° RADAR, CHARLIE = VEHICLE RADAR)
    // ========================================================================

    // Charlie's Dedicated Ground Vehicle Tracking Radar
    window.SentinelUI.registerApparatus({
        id: "ground_vehicle_tracking_radar",
        title: "TACTICAL VEHICLE TRACKING RADAR (CHARLIE RECON)",
        shortLabel: "🎯 VEHICLE RADAR",
        aspectRatio: 1.25,
        protocol: "STANAG 4586 / GMTI",
        defaultForTypes: ["radar"],
        matches: (node) => /charlie/i.test(node?.hostname || "") || /vehicle/i.test(node?.primary_instrument?.title || ""),
        mount: createCanvasApparatusMount(drawGroundVehicleTrackingRadar),
        unmount: unmountCanvasApparatus,
        getPcapConfig: () => ({
            apiBase: RADAR_API,
            attacks: [
                { label: "[!] GPS Teleport Spoof PCAP (Overlay)", pcap: "uav_gps_teleport_attack.pcap", attack_type: "gps_teleport", mode: "overlay", duration_sec: 15 },
                { label: "[!] Optical Laser Dazzle PCAP (Replace)", pcap: "flir_laser_dazzle_attack.pcap", attack_type: "laser_dazzle", mode: "replace", duration_sec: 15 }
            ]
        })
    });

    // Alpha Leader's 360° Tactical Swarm Airspace Radar
    window.SentinelUI.registerApparatus({
        id: "tactical_360_radar",
        title: "TACTICAL 360° UAV SWARM RADAR (ALPHA LEADER)",
        shortLabel: "🛰️ 360° RADAR",
        aspectRatio: 1.25,
        protocol: "STANAG 4586 / PCAP",
        defaultForTypes: ["radar"],
        matches: (node) => !/charlie/i.test(node?.hostname || "") && isAerospaceNode(node),
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

    // Bravo Wingman's Formation HUD
    window.SentinelUI.registerApparatus({
        id: "formation_intercept_hud",
        title: "SWARM FORMATION & INTERCEPT HUD (BRAVO WINGMAN)",
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
                { label: "[!] GPS Teleport Spoof PCAP (Overlay)", pcap: "uav_gps_teleport_attack.pcap", attack_type: "gps_teleport", mode: "overlay", duration_sec: 15 }
            ]
        })
    });

    // Optical FLIR Gimbal
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

    // Legacy Node Adapter
    window.SentinelUI.registerNodeAdapter({
        id: "aerospace_swarm_adapter",
        matches: isAerospaceNode,
        instrumentTag: "STANAG 4586",
        renderPrimaryInstrument: (canvas, node) => {
            const h = (node?.hostname || "").toLowerCase();
            if (h.includes("charlie")) drawGroundVehicleTrackingRadar(canvas, node, { sweep: (Date.now() * 0.002) % (Math.PI * 2) });
            else if (h.includes("bravo")) drawLiveFormationHud(canvas, node);
            else drawLiveTacticalRadar(canvas, node, { sweep: (Date.now() * 0.002) % (Math.PI * 2) });
        }
    });

    // ========================================================================
    // 3. 7-LAYER 3D TACTICAL SWARM C2 (FULL ORIGINAL SYNCHRONIZED)
    // ========================================================================
    const ORIGIN_LON = 4.9000;
    const ORIGIN_LAT = 52.3700;

    let c2AnimId = null;
    let gcsPollTimer = null;
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
        if (gcsPollTimer) clearInterval(gcsPollTimer);

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div class="c2-command-bar">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">
                            DECK.GL 3D TACTICAL SWARM &amp; SATCOM THEATRE C2
                        </span>
                        <span class="badge badge-green" style="font-size:9px;">SYNCED TO LIVE RADAR (:18091)</span>
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

                <div id="deck-theatre-wrap" class="deck-theatre-wrap" style="cursor:grab;">
                    <canvas id="deck-hud-grid-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2;"></canvas>

                    <div class="c2-hud-panel" style="top:12px; left:12px; min-width:255px;">
                        <div style="color:#00E5FF; font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between;">
                            <span>3D CAMERA &amp; OPTICS</span>
                            <span id="c2-lock-label" style="color:#00FFA3;">FREE ORBIT</span>
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

                    <div class="c2-hud-panel" style="top:12px; right:12px; min-width:280px;">
                        <div style="color:#00FFA3; font-weight:800; margin-bottom:6px;">
                            ACTIVE SWARM TELEMETRY (RADAR SYNC)
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#00FFA3; font-weight:700;">● UAV-ALPHA (LEADER) &bull; 10.240.52.121</div>
                            <div id="c2-hud-alpha" style="color:#8A99AD; font-size:9px;">ALT: 120.4m | V: 24.2 m/s | STANAG: <b style="color:#00FFA3;">PASS</b></div>
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#00E5FF; font-weight:700;">● UAV-BRAVO (WING-1) &bull; 10.240.52.123</div>
                            <div id="c2-hud-bravo" style="color:#8A99AD; font-size:9px;">ALT: 118.0m | V: 24.0 m/s</div>
                        </div>
                        <div style="border-bottom:1px solid #1E293B; padding-bottom:5px; margin-bottom:5px;">
                            <div style="color:#FFB800; font-weight:700;">● UAV-CHARLIE (RECON) &bull; 10.240.52.124</div>
                            <div id="c2-hud-charlie" style="color:#8A99AD; font-size:9px;">ALT: 145.2m | V: 24.4 m/s | GMTI: <b style="color:#00FFA3;">LOCKED</b></div>
                        </div>
                    </div>

                    <div class="c2-hud-panel" style="bottom:12px; right:12px; border-color:#00FFA3;">
                        <div style="color:#00FFA3; font-weight:800;">CBF BARRIER h(x) = v_max - ||v|| &ge; 0</div>
                        <div>Safety Margin: <b id="c2-cbf-margin" style="color:#00E5FF;">+55.8 m/s</b> | Air-Gap: <b style="color:#00FFA3;">ARMED (&lt; 15ns)</b></div>
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

        const formMap = { "c2-form-v": "v_formation", "c2-form-echelon": "echelon", "c2-form-diamond": "diamond", "c2-form-orbit": "orbit" };
        Object.keys(formMap).forEach(btnId => {
            document.getElementById(btnId)?.addEventListener("click", (e) => {
                currentFormation = formMap[btnId];
                Object.keys(formMap).forEach(id => document.getElementById(id)?.classList.remove("active-green"));
                e.currentTarget.classList.add("active-green");
                const payload = JSON.stringify({ formation: currentFormation });
                fetch(`${RADAR_API}/formation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
            });
        });

        document.getElementById("c2-toggle-jam")?.addEventListener("click", (e) => {
            isJammingActive = !isJammingActive;
            e.currentTarget.classList.toggle("active-danger", isJammingActive);
            e.currentTarget.textContent = isJammingActive ? "[!] EW JAMMER: ACTIVE" : "[+] EW JAMMER: SUPPRESSED";
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

        let dragMode = null, lastX = 0, lastY = 0;
        wrap.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
            dragMode = (e.button === 2 || e.ctrlKey || e.shiftKey) ? "pan" : "rotate";
            wrap.style.cursor = dragMode === "pan" ? "move" : "grabbing";
            lastX = e.clientX; lastY = e.clientY;
        });
        window.addEventListener("mouseup", () => { dragMode = null; wrap.style.cursor = "grab"; });
        wrap.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("mousemove", (e) => {
            if (!dragMode) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
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

        const trailAlpha = [], trailBravo = [], trailCharlie = [];
        const waypointGates = [
            { id: "WP-01 [ENTRY]", x: -160, y: -180, z: 115 },
            { id: "WP-02 [CORRIDOR]", x: -60, y: 0, z: 120 },
            { id: "WP-03 [TARGET]", x: 60, y: 140, z: 125 },
            { id: "WP-04 [EGRESS]", x: 180, y: 260, z: 130 }
        ];

        let radarTargetAlpha = { x: 0, y: 80, z: 120, heading: 0, roll: 0, v_mps: 24.2, cbf_h: 55.8 };
        let radarTargetBravo = { x: -135, y: -25, z: 118, heading: 0, roll: 0, v_mps: 24.0, cbf_h: 56.0 };
        let radarTargetCharlie = { x: 135, y: -25, z: 145, heading: 0, roll: 0, v_mps: 24.4, cbf_h: 55.6 };
        let radarTargetSat = null;
        let radarFeedOnline = false;

        function normalizeDrone(raw, fallback) {
            if (!raw) return fallback;
            const rollRad = (raw.roll !== undefined) ? Number(raw.roll) : ((Number(raw.roll_deg || 0) * Math.PI) / 180.0);
            return {
                x: Number(raw.x ?? fallback.x), y: Number(raw.y ?? fallback.y), z: Number(raw.z ?? fallback.z),
                heading: Number(raw.heading ?? fallback.heading), roll: rollRad,
                v_mps: Number(raw.v_mps ?? fallback.v_mps),
                cbf_h: Number(raw.cbf_h ?? (80.0 - Number(raw.v_mps ?? 24.0)))
            };
        }

        async function pollRadarSyncedTelemetry() {
            let data = null;
            try {
                const resp = await fetch(`${RADAR_API}/telemetry`, { cache: "no-store" });
                if (resp.ok) data = await resp.json();
            } catch (_) {}

            if (data) {
                radarFeedOnline = true;
                if (data.drones) {
                    radarTargetAlpha = normalizeDrone(data.drones.alpha, radarTargetAlpha);
                    radarTargetBravo = normalizeDrone(data.drones.bravo, radarTargetBravo);
                    radarTargetCharlie = normalizeDrone(data.drones.charlie, radarTargetCharlie);
                }
                radarTargetSat = data.sat || null;

                const hudA = document.getElementById("c2-hud-alpha");
                if (hudA) hudA.innerHTML = `ALT: ${radarTargetAlpha.z.toFixed(1)}m | V: ${radarTargetAlpha.v_mps.toFixed(1)} m/s | STANAG: <b style="color:#00FFA3;">PASS</b>`;
                const hudB = document.getElementById("c2-hud-bravo");
                if (hudB) hudB.textContent = `ALT: ${radarTargetBravo.z.toFixed(1)}m | V: ${radarTargetBravo.v_mps.toFixed(1)} m/s`;
                const hudC = document.getElementById("c2-hud-charlie");
                if (hudC) hudC.innerHTML = `ALT: ${radarTargetCharlie.z.toFixed(1)}m | V: ${radarTargetCharlie.v_mps.toFixed(1)} m/s | GMTI: <b style="color:#00FFA3;">LOCKED</b>`;
                const cbfEl = document.getElementById("c2-cbf-margin");
                if (cbfEl) cbfEl.textContent = `+${radarTargetAlpha.cbf_h.toFixed(1)} m/s`;
            } else {
                radarFeedOnline = false;
            }
        }

        gcsPollTimer = setInterval(pollRadarSyncedTelemetry, 100);
        pollRadarSyncedTelemetry();

        function lerpAngle(cur, target, alpha) {
            let diff = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return cur + diff * alpha;
        }

        function animateTheatre() {
            c2AnimId = requestAnimationFrame(animateTheatre);
            tick += 0.016;
            const k = 0.22;

            posAlpha.x += (radarTargetAlpha.x - posAlpha.x) * k;
            posAlpha.y += (radarTargetAlpha.y - posAlpha.y) * k;
            posAlpha.z += (radarTargetAlpha.z - posAlpha.z) * k;
            posAlpha.heading = lerpAngle(posAlpha.heading, radarTargetAlpha.heading, k);
            posAlpha.roll += (radarTargetAlpha.roll - posAlpha.roll) * k;

            posBravo.x += (radarTargetBravo.x - posBravo.x) * k;
            posBravo.y += (radarTargetBravo.y - posBravo.y) * k;
            posBravo.z += (radarTargetBravo.z - posBravo.z) * k;
            posBravo.heading = lerpAngle(posBravo.heading, radarTargetBravo.heading, k);
            posBravo.roll += (radarTargetBravo.roll - posBravo.roll) * k;

            posCharlie.x += (radarTargetCharlie.x - posCharlie.x) * k;
            posCharlie.y += (radarTargetCharlie.y - posCharlie.y) * k;
            posCharlie.z += (radarTargetCharlie.z - posCharlie.z) * k;
            posCharlie.heading = lerpAngle(posCharlie.heading, radarTargetCharlie.heading, k);
            posCharlie.roll += (radarTargetCharlie.roll - posCharlie.roll) * k;

            const posSat = radarTargetSat
                ? { x: radarTargetSat.x, y: radarTargetSat.y, z: radarTargetSat.z }
                : { x: Math.sin(tick * 0.25) * 460.0, y: Math.cos(tick * 0.25) * 280.0, z: 420.0 };

            if (radarFeedOnline && Math.floor(tick * 60) % 2 === 0) {
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
                trailAlpha, trailBravo, trailCharlie, waypointGates, tick
            });
        }

        animateTheatre();
    }

    function render7LayerTheatre(canvas, state) {
        if (!canvas) return;
        const w = canvas.clientWidth || 960, h = canvas.clientHeight || 600;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const ctx = canvas.getContext("2d");

        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.75);
        bgGrad.addColorStop(0, "#07101e"); bgGrad.addColorStop(1, "#02050a");
        ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h);

        const yaw = (viewState.bearing * Math.PI) / 180.0;
        const pitch = ((90 - viewState.pitch) * Math.PI) / 180.0;
        const zoomScale = Math.pow(2, viewState.zoom - 14.3);
        const panEast = (viewState.longitude - ORIGIN_LON) * 111320 * Math.cos(ORIGIN_LAT * Math.PI / 180);
        const panNorth = (viewState.latitude - ORIGIN_LAT) * 111320;

        function project3D(eastM, northM, altM) {
            const rx = eastM - panEast, ry = northM - panNorth, rz = altM;
            const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
            const x1 = rx * cosY - ry * sinY, y1 = rx * sinY + ry * cosY;
            const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
            const y2 = y1 * sinP - rz * cosP, z2 = y1 * cosP + rz * sinP;
            const fov = 780 * zoomScale;
            const depth = 1150 + z2;
            const s = fov / Math.max(60, depth);
            return { x: w / 2 + x1 * s, y: h / 2 + 40 - y2 * s, s };
        }

        // Layer 1: Terrain
        if (layerVis.terrain) {
            ctx.lineWidth = 1;
            for (let x = -720; x <= 720; x += 80) {
                ctx.beginPath();
                for (let y = -720; y <= 720; y += 80) {
                    const pt = project3D(x, y, getTerrainElevation(x, y));
                    if (y === -720) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = "rgba(0, 180, 255, 0.13)"; ctx.stroke();
            }
            for (let y = -720; y <= 720; y += 80) {
                ctx.beginPath();
                for (let x = -720; x <= 720; x += 80) {
                    const pt = project3D(x, y, getTerrainElevation(x, y));
                    if (x === -720) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = "rgba(0, 180, 255, 0.13)"; ctx.stroke();
            }
        }

        // Layer 4: Ribbons
        function drawRibbon(trail, rgb) {
            if (trail.length < 2) return;
            ctx.strokeStyle = `rgba(${rgb}, 0.85)`; ctx.lineWidth = 2.4; ctx.beginPath();
            trail.forEach((p, idx) => {
                const pt = project3D(p.x, p.y, p.z);
                if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
        }
        drawRibbon(state.trailAlpha, "0, 255, 163");
        drawRibbon(state.trailBravo, "0, 229, 255");
        drawRibbon(state.trailCharlie, "255, 184, 0");

        // Layer 6: Airframes
        function drawDrone(pos, col, name) {
            const pt = project3D(pos.x, pos.y, pos.z);
            const gnd = project3D(pos.x, pos.y, 0);
            ctx.strokeStyle = col + "55"; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(gnd.x, gnd.y); ctx.stroke();
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.font = "bold 9.5px 'JetBrains Mono', monospace"; ctx.fillStyle = col;
            ctx.fillText(name, pt.x + 8, pt.y - 2);
        }
        drawDrone(state.posAlpha, "#00FFA3", "UAV-ALPHA (LEADER)");
        drawDrone(state.posBravo, "#00E5FF", "UAV-BRAVO (WING)");
        drawDrone(state.posCharlie, "#FFB800", "UAV-CHARLIE (RECON - GMTI)");
    }

    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => initDeckGlSwarmC2(container)
    });

    console.log("[Aerospace Plugin] Dedicated Charlie Vehicle Tracking Radar + Alpha 360° Airspace Radar registered.");
})();
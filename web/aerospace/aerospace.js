// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js

(function () {
    if (!window.SentinelUI) return;

    let radarTick = 0;

    // ========================================================================
    // 1. PANE 01: MULTI-INSTRUMENT VISUAL DISPATCHER (Radar vs HUD vs FLIR)
    // ========================================================================
    function renderAerospaceInstrument(canvas, node, isAnomaly) {
        const type = (node && node.primary_instrument && node.primary_instrument.type)
            ? node.primary_instrument.type.toLowerCase()
            : "radar";

        if (type === "video") {
            renderFlirThermalGimbal(canvas, node, isAnomaly);
        } else if (type === "formation") {
            renderFormationHud(canvas, node, isAnomaly);
        } else {
            renderTacticalRadar(canvas, node, isAnomaly);
        }
    }

    // 1A. TACTICAL 360° RADAR (ALPHA LEADER)
    function renderTacticalRadar(canvas, node, isAnomaly) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(cx, cy) - 16;
        radarTick += 0.03;

        ctx.fillStyle = "#040810";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = isAnomaly ? "rgba(255, 51, 102, 0.35)" : "rgba(0, 229, 255, 0.22)";
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1.0].forEach(factor => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * factor, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
        ctx.stroke();

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

        const blips = [
            { x: cx - 40, y: cy - 30, label: "UAV-1 ALPHA (LEADER)", color: "#00FFA3" },
            { x: cx + 55, y: cy + 20, label: "UAV-2 BRAVO (WING)", color: "#00E5FF" },
            { x: cx - 60, y: cy + 50, label: "UAV-3 CHARLIE (RECON)", color: "#FFB800" },
            { x: cx + 90, y: cy - 70, label: isAnomaly ? "EW-SPOOFER [INJECTING]" : "EW-SPOOFER [IDLE]", color: isAnomaly ? "#FF3366" : "#8A99AD" }
        ];

        blips.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = b.color;
            ctx.fillText(b.label, b.x + 8, b.y + 3);
        });

        const title = (node && node.primary_instrument && node.primary_instrument.title)
            ? node.primary_instrument.title
            : "TACTICAL 360° RADAR";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAnomaly ? "#FF3366" : "#00E5FF";
        ctx.fillText(isAnomaly ? "[!] GPS DRIFT DETECTED: AIR-GAP TRIPPED" : "[+] " + title, 16, 22);
    }

    // 1B. TACTICAL FORMATION & INTERCEPT HUD (BRAVO WINGMAN)
    function renderFormationHud(canvas, node, isAnomaly) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        radarTick += 0.02;

        ctx.fillStyle = "#040712";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
        ctx.lineWidth = 1.5;
        const cy = h / 2 + Math.sin(radarTick) * 8;
        [-40, -20, 0, 20, 40].forEach(offset => {
            const y = cy + offset;
            ctx.beginPath();
            ctx.moveTo(w / 2 - 60, y); ctx.lineTo(w / 2 + 60, y);
            ctx.stroke();
            ctx.font = "8px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#00E5FF";
            ctx.fillText(`${-offset}°`, w / 2 + 65, y + 3);
        });

        const targetX = w / 2 + 80 + Math.cos(radarTick) * 15;
        const targetY = h / 2 - 30 + Math.sin(radarTick * 1.5) * 10;
        ctx.strokeStyle = isAnomaly ? "#FF3366" : "#00FFA3";
        ctx.strokeRect(targetX - 20, targetY - 20, 40, 40);
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAnomaly ? "#FF3366" : "#00FFA3";
        ctx.fillText("ECHELON LOCK: ALPHA LEADER", targetX - 45, targetY - 26);
        ctx.fillText("ΔDIST: 42.4m | ΔV: 0.2m/s", targetX - 35, targetY + 34);

        ctx.fillStyle = "rgba(13, 17, 26, 0.9)";
        ctx.fillRect(0, 0, w, 30);
        ctx.strokeStyle = "#1A2232";
        ctx.strokeRect(0, 0, w, 30);
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00FFA3";
        ctx.fillText("[+] SWARM FORMATION & INTERCEPT HUD (BRAVO WINGMAN) - MESH LINK 1.4ms", 16, 20);
    }

    // 1C. OPTICAL FLIR THERMAL RECON GIMBAL (CHARLIE RECON)
    function renderFlirThermalGimbal(canvas, node, isAnomaly) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        radarTick += 0.02;

        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#08031a");
        grad.addColorStop(0.5, "#1f0638");
        grad.addColorStop(1, isAnomaly ? "#4d0011" : "#0b1226");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const hotX = w / 2 + Math.sin(radarTick) * 30;
        const hotY = h / 2 + Math.cos(radarTick * 0.8) * 20;
        const heatGrad = ctx.createRadialGradient(hotX, hotY, 4, hotX, hotY, 70);
        heatGrad.addColorStop(0, "#FFFFFF");
        heatGrad.addColorStop(0.3, isAnomaly ? "#FF1144" : "#FF9900");
        heatGrad.addColorStop(0.7, "#8800AA");
        heatGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = heatGrad;
        ctx.beginPath(); ctx.arc(hotX, hotY, 70, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = "rgba(0, 229, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hotX, hotY, 30, 0, Math.PI * 2);
        ctx.moveTo(hotX - 45, hotY); ctx.lineTo(hotX + 45, hotY);
        ctx.moveTo(hotX, hotY - 45); ctx.lineTo(hotX, hotY + 45);
        ctx.stroke();

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00FFA3";
        ctx.fillText("FLIR GIMBAL OPTICAL FEED: 1080p @ 30 FPS", 16, 24);
        ctx.fillStyle = isAnomaly ? "#FF3366" : "#00E5FF";
        ctx.fillText(`TARGET MAX TEMP: ${isAnomaly ? '118.4' : '38.5'}°C | WHEP RTSP :8554`, 16, 40);
        ctx.fillText(`TRACKING: GROUND VEHICLE CONVOY [LOCKED]`, hotX + 38, hotY - 10);
    }

    // Register Node Adapter for Master-Detail Cockpit
    window.SentinelUI.registerNodeAdapter({
        id: "aerospace_swarm_adapter",
        matches: (node) => /aerospace|uav|swarm/i.test(node.site || "") || /drone/i.test(node.hostname || ""),
        instrumentTag: "STANAG 4586",
        renderPrimaryInstrument: renderAerospaceInstrument,

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
        }
    });

    // ========================================================================
    // 2. DECK.GL 7-LAYER TACTICAL SWARM C2 ENGINE (TAB: TACTICAL SWARM C2)
    // ========================================================================
    const ORIGIN_LON = 4.9000;
    const ORIGIN_LAT = 52.3700;

    let deckInstance = null;
    let c2AnimId = null;
    let currentFormation = "v_formation";
    let isJammingActive = true;
    let lockedEntity = null;

    // Layer Visibility Flags
    const layerVis = {
        arcs: true,
        ghostPath: true,
        jamDome: true,
        stalks: true,
        terrain: true
    };

    // Camera View State (Deck.gl MapView State)
    let viewState = {
        longitude: ORIGIN_LON,
        latitude: ORIGIN_LAT,
        zoom: 14.3,
        pitch: 58,
        bearing: -24
    };

    // Convert local tactical meters (eastX, northY) to [lon, lat]
    function metersToLngLat(eastMeters, northMeters) {
        const dLat = northMeters / 111320.0;
        const dLon = eastMeters / (111320.0 * Math.cos(ORIGIN_LAT * Math.PI / 180.0));
        return [ORIGIN_LON + dLon, ORIGIN_LAT + dLat];
    }

    // Build Swept-Wing Stealth Drone 3D Polygon in [lon, lat]
    function buildDronePolygon(eastM, northM, headingRad, scale = 1.0) {
        const pts = [
            [0, 26 * scale],       // Nose
            [-24 * scale, -16 * scale], // Port wingtip
            [-6 * scale, -10 * scale],  // Port inner
            [0, -20 * scale],      // Tail cone
            [6 * scale, -10 * scale],   // Starboard inner
            [24 * scale, -16 * scale]   // Starboard wingtip
        ];
        const cosH = Math.cos(headingRad);
        const sinH = Math.sin(headingRad);
        return pts.map(([lx, ly]) => {
            const rx = lx * cosH + ly * sinH;
            const ry = -lx * sinH + ly * cosH;
            return metersToLngLat(eastM + rx, northM + ry);
        });
    }

    // Build Geodesic Circle Polygon in [lon, lat]
    function buildCirclePolygon(eastM, northM, radiusM, segments = 36) {
        const coords = [];
        for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            coords.push(metersToLngLat(eastM + Math.cos(a) * radiusM, northM + Math.sin(a) * radiusM));
        }
        return coords;
    }

    // Build Static Tactical Grid & 3D Terrain Obstacles Once
    function buildTheatreStaticGeometry() {
        const gridLines = [];
        const range = 1200;
        const step = 120;

        for (let x = -range; x <= range; x += step) {
            gridLines.push({
                path: [metersToLngLat(x, -range), metersToLngLat(x, range)],
                color: x === 0 ? [0, 229, 255, 90] : [26, 42, 68, 110]
            });
        }
        for (let y = -range; y <= range; y += step) {
            gridLines.push({
                path: [metersToLngLat(-range, y), metersToLngLat(range, y)],
                color: y === 0 ? [0, 229, 255, 90] : [26, 42, 68, 110]
            });
        }

        // Concentric Tactical Range Rings (300m, 600m, 900m)
        [300, 600, 900].forEach(r => {
            const ringPath = buildCirclePolygon(0, 0, r, 64);
            ringPath.push(ringPath[0]);
            gridLines.push({
                path: ringPath,
                color: [0, 255, 163, 75]
            });
        });

        // 3D Terrain Blocks / Tactical Structures
        const terrainBlocks = [
            { poly: buildCirclePolygon(-380, -320, 65, 6), height: 45, color: [16, 28, 48, 180], line: [0, 229, 255, 80] },
            { poly: buildCirclePolygon(-260, 280, 80, 6), height: 65, color: [16, 28, 48, 180], line: [0, 229, 255, 80] },
            { poly: buildCirclePolygon(280, -360, 70, 6), height: 55, color: [16, 28, 48, 180], line: [0, 229, 255, 80] },
            { poly: buildCirclePolygon(420, 320, 95, 6), height: 80, color: [16, 28, 48, 180], line: [0, 229, 255, 80] }
        ];

        return { gridLines, terrainBlocks };
    }

    function initDeckGlSwarmC2(container) {
        if (c2AnimId) cancelAnimationFrame(c2AnimId);
        if (deckInstance) {
            try { deckInstance.finalize(); } catch (e) { }
            deckInstance = null;
        }

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <!-- TOP C2 COMMAND & FORMATION BAR -->
                <div class="c2-command-bar">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">
                            DECK.GL 3D TACTICAL SWARM &amp; SATCOM THEATRE C2
                        </span>
                        <span class="badge badge-green" style="font-size:9px;">7-LAYER WEBGL2 INSTANCED</span>
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
                        <button class="c2-pill-btn active-cyan" data-layer="arcs">C2 &amp; SATCOM ARCS</button>
                        <button class="c2-pill-btn active-cyan" data-layer="ghostPath">GHOST SPOOF VECTOR</button>
                        <button class="c2-pill-btn active-cyan" data-layer="jamDome">EW JAMMING ZONE</button>
                        <button class="c2-pill-btn active-cyan" data-layer="stalks">ALTITUDE STALKS</button>
                    </div>
                </div>

                <!-- MAIN DECK.GL 3D THEATRE VIEWPORT -->
                <div id="deck-theatre-wrap" class="deck-theatre-wrap">
                    <canvas id="deck-webgl-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1;"></canvas>
                    <canvas id="deck-hud-grid-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2; pointer-events:none;"></canvas>

                    <!-- TOP-LEFT CAMERA & NAVIGATION HUD -->
                    <div class="c2-hud-panel" style="top:12px; left:12px; min-width:255px;">
                        <div style="color:#00E5FF; font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between;">
                            <span>3D CAMERA &amp; OPTICS</span>
                            <span id="c2-lock-label" style="color:#00FFA3;">FREE ORBIT</span>
                        </div>
                        <div style="font-size:9px; color:#8A99AD; margin-bottom:8px;">
                            Left-Drag: Pan &bull; Right-Drag: 3D Pitch/Rotate &bull; Scroll: Zoom
                        </div>
                        <div class="c2-slider-row">
                            <span>3D Pitch (<b id="lbl-pitch">58°</b>):</span>
                            <input type="range" id="sl-pitch" min="0" max="82" value="58">
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
                        <div><span style="color:#00E5FF;">⌒⌒</span> P2P Mesh &amp; C2 Uplink</div>
                        <div><span style="color:#C084FC;">⌒⌒</span> CCSDS 133 Satcom</div>
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
        const webglCanvas = document.getElementById("deck-webgl-canvas");
        const hudCanvas = document.getElementById("deck-hud-grid-canvas");

        // Bind UI Controls
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

        slPitch?.addEventListener("input", (e) => {
            viewState = { ...viewState, pitch: Number(e.target.value) };
            syncSlidersFromView();
            if (deckInstance) deckInstance.setProps({ viewState });
        });
        slBearing?.addEventListener("input", (e) => {
            viewState = { ...viewState, bearing: Number(e.target.value) };
            syncSlidersFromView();
            if (deckInstance) deckInstance.setProps({ viewState });
        });
        slZoom?.addEventListener("input", (e) => {
            viewState = { ...viewState, zoom: Number(e.target.value) };
            syncSlidersFromView();
            if (deckInstance) deckInstance.setProps({ viewState });
        });

        // Formation Switchers
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
            });
        });

        // EW Jammer Toggle
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

        // Camera Lock-On Buttons
        container.querySelectorAll("[data-lock]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                container.querySelectorAll("[data-lock]").forEach(b => b.classList.remove("active-cyan"));
                e.currentTarget.classList.add("active-cyan");
                const target = e.currentTarget.getAttribute("data-lock");
                lockedEntity = (target === "free") ? null : target;
                const lockLbl = document.getElementById("c2-lock-label");
                if (lockLbl) lockLbl.textContent = lockedEntity ? `LOCKED: ${lockedEntity.toUpperCase()}` : "FREE ORBIT";
                if (!lockedEntity) {
                    viewState = { ...viewState, longitude: ORIGIN_LON, latitude: ORIGIN_LAT, zoom: 14.3, pitch: 58 };
                    syncSlidersFromView();
                }
            });
        });

        // Layer Visibility Toggles
        container.querySelectorAll("[data-layer]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const layerKey = e.currentTarget.getAttribute("data-layer");
                layerVis[layerKey] = !layerVis[layerKey];
                e.currentTarget.classList.toggle("active-cyan", layerVis[layerKey]);
            });
        });

        // Dynamic Swarm State Positions (in tactical meters relative to origin)
        const staticGeo = buildTheatreStaticGeometry();
        let tick = 0;

        let posAlpha = { x: 0, y: 80, z: 120, heading: 0 };
        let posBravo = { x: -140, y: -40, z: 118, heading: 0 };
        let posCharlie = { x: 140, y: -40, z: 145, heading: 0 };
        const posGcs = { x: 0, y: -460, z: 15 };
        const posEw = { x: 460, y: 260, z: 45 };

        const trailAlpha = [];
        const trailBravo = [];
        const trailCharlie = [];

        // Initialize Deck.gl Instance if WebGL is available
        let deckActive = false;
        if (window.deck) {
            try {
                deckInstance = new deck.Deck({
                    canvas: webglCanvas,
                    width: "100%",
                    height: "100%",
                    views: new deck.MapView({ repeat: false }),
                    viewState: viewState,
                    controller: {
                        dragPan: true,
                        dragRotate: true,
                        scrollZoom: true,
                        touchRotate: true,
                        keyboard: true
                    },
                    onViewStateChange: ({ viewState: nextVs }) => {
                        viewState = nextVs;
                        syncSlidersFromView();
                        deckInstance.setProps({ viewState });
                    },
                    layers: []
                });
                deckActive = true;
            } catch (err) {
                console.warn("[Deck.gl] WebGL context unavailable, using synchronized 3D Projection Layer:", err);
                deckActive = false;
            }
        }

        // Also attach universal mouse drag / rotate / wheel on wrap for seamless interaction
        let dragMode = null;
        let lastX = 0, lastY = 0;
        wrap.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
            dragMode = (e.button === 2 || e.ctrlKey || e.shiftKey) ? "rotate" : "pan";
            lastX = e.clientX;
            lastY = e.clientY;
        });
        window.addEventListener("mouseup", () => { dragMode = null; });
        wrap.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("mousemove", (e) => {
            if (!dragMode) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            if (dragMode === "rotate") {
                viewState.bearing = ((viewState.bearing - dx * 0.35 + 540) % 360) - 180;
                viewState.pitch = Math.max(0, Math.min(82, viewState.pitch - dy * 0.35));
            } else if (dragMode === "pan" && !lockedEntity) {
                const scale = Math.pow(2, 14.3 - viewState.zoom) * 1.8;
                const rad = (viewState.bearing * Math.PI) / 180.0;
                const eastDelta = (-dx * Math.cos(rad) - dy * Math.sin(rad)) * scale;
                const northDelta = (dx * Math.sin(rad) - dy * Math.cos(rad)) * scale;
                const [nLon, nLat] = metersToLngLat(eastDelta, northDelta);
                viewState.longitude += (nLon - ORIGIN_LON);
                viewState.latitude += (nLat - ORIGIN_LAT);
            }
            syncSlidersFromView();
            if (deckInstance) deckInstance.setProps({ viewState: { ...viewState } });
        });
        wrap.addEventListener("wheel", (e) => {
            e.preventDefault();
            viewState.zoom = Math.max(12.5, Math.min(16.8, viewState.zoom - e.deltaY * 0.0015));
            syncSlidersFromView();
            if (deckInstance) deckInstance.setProps({ viewState: { ...viewState } });
        }, { passive: false });

        // Main 60-FPS C2 Simulation & Deck.gl Layer Update Loop
        function updateSimulationFrame() {
            c2AnimId = requestAnimationFrame(updateSimulationFrame);
            tick += 0.018;

            // 1. Update Swarm Formation Kinematics
            const patrolX = Math.sin(tick * 0.7) * 110;
            const patrolY = Math.cos(tick * 0.35) * 70 + 60;
            const dX = Math.cos(tick * 0.7) * 110 * 0.7;
            const dY = -Math.sin(tick * 0.35) * 70 * 0.35;
            const leaderHeading = Math.atan2(dX, dY) * 0.25;

            posAlpha.x += (patrolX - posAlpha.x) * 0.08;
            posAlpha.y += (patrolY - posAlpha.y) * 0.08;
            posAlpha.z = 120 + Math.sin(tick * 2.0) * 4;
            posAlpha.heading = leaderHeading;

            let targetBx = posAlpha.x - 140, targetBy = posAlpha.y - 110;
            let targetCx = posAlpha.x + 140, targetCy = posAlpha.y - 110;

            if (currentFormation === "echelon") {
                targetBx = posAlpha.x + 110; targetBy = posAlpha.y - 80;
                targetCx = posAlpha.x + 220; targetCy = posAlpha.y - 160;
            } else if (currentFormation === "diamond") {
                targetBx = posAlpha.x - 130; targetBy = posAlpha.y - 20;
                targetCx = posAlpha.x; targetCy = posAlpha.y - 170;
            } else if (currentFormation === "orbit") {
                targetBx = posAlpha.x + Math.cos(tick * 1.8) * 160;
                targetBy = posAlpha.y + Math.sin(tick * 1.8) * 160;
                targetCx = posAlpha.x + Math.cos(tick * 1.8 + Math.PI) * 160;
                targetCy = posAlpha.y + Math.sin(tick * 1.8 + Math.PI) * 160;
            }

            posBravo.x += (targetBx - posBravo.x) * 0.06;
            posBravo.y += (targetBy - posBravo.y) * 0.06;
            posBravo.z = 118 + Math.sin(tick * 2.0 + 1.0) * 4;
            posBravo.heading = leaderHeading;

            posCharlie.x += (targetCx - posCharlie.x) * 0.06;
            posCharlie.y += (targetCy - posCharlie.y) * 0.06;
            posCharlie.z = 145 + Math.sin(tick * 2.0 + 2.0) * 4;
            posCharlie.heading = leaderHeading;

            // LEO Satellite Orbital Pass Overhead
            const posSat = {
                x: Math.sin(tick * 0.3) * 520,
                y: Math.cos(tick * 0.3) * 320,
                z: 480
            };

            // Maintain Flight History Trails
            if (Math.floor(tick * 50) % 3 === 0) {
                trailAlpha.push([...metersToLngLat(posAlpha.x, posAlpha.y), posAlpha.z]);
                trailBravo.push([...metersToLngLat(posBravo.x, posBravo.y), posBravo.z]);
                trailCharlie.push([...metersToLngLat(posCharlie.x, posCharlie.y), posCharlie.z]);
                if (trailAlpha.length > 45) trailAlpha.shift();
                if (trailBravo.length > 45) trailBravo.shift();
                if (trailCharlie.length > 45) trailCharlie.shift();
            }

            // Camera Lock-On Tracking
            if (lockedEntity) {
                const mapTarget = {
                    alpha: posAlpha,
                    bravo: posBravo,
                    charlie: posCharlie,
                    ew: posEw,
                    sat: posSat
                }[lockedEntity];
                if (mapTarget) {
                    const [tLon, tLat] = metersToLngLat(mapTarget.x, mapTarget.y);
                    viewState.longitude += (tLon - viewState.longitude) * 0.12;
                    viewState.latitude += (tLat - viewState.latitude) * 0.12;
                }
            }

            const llAlpha = metersToLngLat(posAlpha.x, posAlpha.y);
            const llBravo = metersToLngLat(posBravo.x, posBravo.y);
            const llCharlie = metersToLngLat(posCharlie.x, posCharlie.y);
            const llGcs = metersToLngLat(posGcs.x, posGcs.y);
            const llEw = metersToLngLat(posEw.x, posEw.y);
            const llSat = metersToLngLat(posSat.x, posSat.y);
            const llSpoofGhost = metersToLngLat(posBravo.x + 290, posBravo.y + 230);

            // 2. Update Deck.gl 7-Layer Stack
            if (deckActive && deckInstance) {
                const layers = [];

                // LAYER 1: Tactical Coordinate Grid
                layers.push(new deck.PathLayer({
                    id: "c2-grid-layer",
                    data: staticGeo.gridLines,
                    getPath: d => d.path,
                    getColor: d => d.color,
                    getWidth: 2,
                    widthMinPixels: 1
                }));

                // LAYER 2: 3D Terrain & Hostile EW Jamming Dome
                const polys = [...staticGeo.terrainBlocks];
                if (layerVis.jamDome && isJammingActive) {
                    polys.push({
                        poly: buildCirclePolygon(posEw.x, posEw.y, 260, 40),
                        height: 180,
                        color: [255, 51, 102, 35],
                        line: [255, 51, 102, 190]
                    });
                }
                layers.push(new deck.PolygonLayer({
                    id: "c2-terrain-jam-layer",
                    data: polys,
                    getPolygon: d => d.poly,
                    getElevation: d => d.height,
                    getFillColor: d => d.color,
                    getLineColor: d => d.line,
                    extruded: true,
                    wireframe: true,
                    lineWidthMinPixels: 1
                }));

                // LAYER 3: Expanding Radar & Jamming Wave Rings
                const pulseR = (tick * 120) % 240;
                const waves = [
                    { pos: llAlpha, radius: pulseR, color: [0, 255, 163, 160] },
                    { pos: llBravo, radius: (pulseR + 80) % 200, color: [0, 229, 255, 140] },
                    { pos: llCharlie, radius: (pulseR + 140) % 220, color: [255, 184, 0, 140] }
                ];
                if (isJammingActive) {
                    waves.push({ pos: llEw, radius: (tick * 180) % 340, color: [255, 51, 102, 220] });
                }
                layers.push(new deck.ScatterplotLayer({
                    id: "c2-radar-waves",
                    data: waves,
                    getPosition: d => d.pos,
                    getRadius: d => d.radius,
                    stroked: true,
                    filled: false,
                    getLineColor: d => d.color,
                    lineWidthMinPixels: 2
                }));

                // LAYER 4: 3D Flight Corridors & Ghost Spoof Trajectory
                const paths = [
                    { path: trailAlpha, color: [0, 255, 163, 210] },
                    { path: trailBravo, color: [0, 229, 255, 210] },
                    { path: trailCharlie, color: [255, 184, 0, 210] }
                ];
                if (layerVis.ghostPath && isJammingActive) {
                    paths.push({
                        path: [
                            [...llBravo, posBravo.z],
                            [...llSpoofGhost, posBravo.z + 95]
                        ],
                        color: [255, 51, 102, 240]
                    });
                }
                layers.push(new deck.PathLayer({
                    id: "c2-flight-corridors",
                    data: paths,
                    getPath: d => d.path,
                    getColor: d => d.color,
                    getWidth: 4,
                    widthMinPixels: 2
                }));

                // LAYER 5: Vertical Altitude Stalks
                if (layerVis.stalks) {
                    const stalks = [
                        { path: [[...llAlpha, 0], [...llAlpha, posAlpha.z]], color: [0, 255, 163, 120] },
                        { path: [[...llBravo, 0], [...llBravo, posBravo.z]], color: [0, 229, 255, 120] },
                        { path: [[...llCharlie, 0], [...llCharlie, posCharlie.z]], color: [255, 184, 0, 120] },
                        { path: [[...llSat, 0], [...llSat, posSat.z]], color: [192, 132, 252, 90] }
                    ];
                    layers.push(new deck.PathLayer({
                        id: "c2-altitude-stalks",
                        data: stalks,
                        getPath: d => d.path,
                        getColor: d => d.color,
                        getWidth: 2,
                        widthMinPixels: 1
                    }));
                }

                // LAYER 6: 3D Extruded Stealth Airframes
                const airframes = [
                    { poly: buildDronePolygon(posAlpha.x, posAlpha.y, posAlpha.heading, 1.3), alt: posAlpha.z, color: [0, 255, 163, 240] },
                    { poly: buildDronePolygon(posBravo.x, posBravo.y, posBravo.heading, 1.15), alt: posBravo.z, color: [0, 229, 255, 240] },
                    { poly: buildDronePolygon(posCharlie.x, posCharlie.y, posCharlie.heading, 1.15), alt: posCharlie.z, color: [255, 184, 0, 240] },
                    { poly: buildCirclePolygon(posGcs.x, posGcs.y, 24, 8), alt: 25, color: [0, 229, 255, 220] },
                    { poly: buildCirclePolygon(posEw.x, posEw.y, 24, 4), alt: 35, color: [255, 51, 102, 240] },
                    { poly: buildCirclePolygon(posSat.x, posSat.y, 28, 6), alt: posSat.z, color: [192, 132, 252, 240] }
                ];
                layers.push(new deck.PolygonLayer({
                    id: "c2-airframes-3d",
                    data: airframes,
                    getPolygon: d => d.poly,
                    getElevation: d => d.alt,
                    getFillColor: d => d.color,
                    getLineColor: [255, 255, 255, 220],
                    extruded: true,
                    wireframe: true
                }));

                // LAYER 7A: 3D Parabolic C2, Mesh & EW Jamming Arcs
                if (layerVis.arcs) {
                    const arcs = [
                        { from: llSat, to: llGcs, sc: [192, 132, 252, 230], tc: [0, 229, 255, 230] },
                        { from: llGcs, to: llAlpha, sc: [0, 229, 255, 220], tc: [0, 255, 163, 220] },
                        { from: llAlpha, to: llBravo, sc: [0, 255, 163, 200], tc: [0, 229, 255, 200] },
                        { from: llAlpha, to: llCharlie, sc: [0, 255, 163, 200], tc: [255, 184, 0, 200] }
                    ];
                    if (isJammingActive) {
                        arcs.push(
                            { from: llEw, to: llAlpha, sc: [255, 51, 102, 240], tc: [255, 51, 102, 240] },
                            { from: llEw, to: llBravo, sc: [255, 51, 102, 240], tc: [255, 51, 102, 240] }
                        );
                    }
                    layers.push(new deck.ArcLayer({
                        id: "c2-datalink-arcs",
                        data: arcs,
                        getSourcePosition: d => d.from,
                        getTargetPosition: d => d.to,
                        getSourceColor: d => d.sc,
                        getTargetColor: d => d.tc,
                        getWidth: 3
                    }));
                }

                // LAYER 7B: MIL-STD-2525 Callsigns & Telemetry Labels
                const labels = [
                    { pos: [...llAlpha, posAlpha.z + 25], text: "UAV-ALPHA [LEADER]\n120m | 23.77ns PASS", color: [0, 255, 163, 255] },
                    { pos: [...llBravo, posBravo.z + 25], text: "UAV-BRAVO [WING-1]\n118m | ECHELON LOCK", color: [0, 229, 255, 255] },
                    { pos: [...llCharlie, posCharlie.z + 25], text: "UAV-CHARLIE [RECON]\n145m | FLIR + LIDAR", color: [255, 184, 0, 255] },
                    { pos: [...llGcs, 40], text: "GCS-TACTICAL C2\n10.240.52.120", color: [0, 229, 255, 255] },
                    { pos: [...llEw, 55], text: isJammingActive ? "EW-SPOOFER [HOSTILE]\nREPLAY + GPS SPOOF" : "EW-SPOOFER [SUPPRESSED]", color: [255, 51, 102, 255] },
                    { pos: [...llSat, posSat.z + 30], text: "SAT-CCSDS-133 [LEO]\nSPI:0x0100 KA-BAND", color: [192, 132, 252, 255] }
                ];
                if (layerVis.ghostPath && isJammingActive) {
                    labels.push({
                        pos: [...llSpoofGhost, posBravo.z + 100],
                        text: "[X] REJECTED GPS TELEPORT\nΔV=420m/s > 80m/s CBF LIMIT",
                        color: [255, 51, 102, 255]
                    });
                }
                layers.push(new deck.TextLayer({
                    id: "c2-callsigns-text",
                    data: labels,
                    getPosition: d => d.pos,
                    getText: d => d.text,
                    getColor: d => d.color,
                    getSize: 12,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    billboard: true
                }));

                deckInstance.setProps({ layers });
            }

            // 3. Synchronized HUD Overlay & Software WebGL Fallback Renderer
            renderSynchronizedHudOverlay(hudCanvas, {
                deckActive,
                posAlpha, posBravo, posCharlie, posGcs, posEw, posSat,
                trailAlpha, trailBravo, trailCharlie, tick
            });
        }

        updateSimulationFrame();
    }

    // Synchronized Tactical HUD Reticle & Fallback 3D Projection if VMware blocks WebGL2
    function renderSynchronizedHudOverlay(canvas, state) {
        if (!canvas) return;
        const w = canvas.clientWidth || 960;
        const h = canvas.clientHeight || 600;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);

        // If Deck.gl WebGL2 is active, draw tactical C2 compass rose & center reticle
        if (state.deckActive) {
            ctx.strokeStyle = "rgba(0, 229, 255, 0.22)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 18, 0, Math.PI * 2);
            ctx.moveTo(w / 2 - 28, h / 2); ctx.lineTo(w / 2 + 28, h / 2);
            ctx.moveTo(w / 2, h / 2 - 28); ctx.lineTo(w / 2, h / 2 + 28);
            ctx.stroke();
            return;
        }

        // Full 7-Layer 3D Perspective Renderer when running in WebGL-restricted VMware
        ctx.fillStyle = "#03060c";
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

            const fov = 750 * zoomScale;
            const depth = 1100 + z2;
            const s = fov / Math.max(80, depth);

            return { x: w / 2 + x1 * s, y: h / 2 - y2 * s, s };
        }

        // Layer 1: Coordinate Grid & Range Rings
        ctx.strokeStyle = "rgba(0, 229, 255, 0.14)";
        ctx.lineWidth = 1;
        for (let g = -800; g <= 800; g += 100) {
            const p1 = project3D(g, -800, 0), p2 = project3D(g, 800, 0);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            const p3 = project3D(-800, g, 0), p4 = project3D(800, g, 0);
            ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
        }

        [250, 500, 750].forEach(rad => {
            ctx.strokeStyle = "rgba(0, 255, 163, 0.22)";
            ctx.beginPath();
            for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.12) {
                const pt = project3D(Math.cos(a) * rad, Math.sin(a) * rad, 0);
                if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        });

        // Layer 2: 3D EW Jamming Dome
        if (layerVis.jamDome && isJammingActive) {
            ctx.fillStyle = "rgba(255, 51, 102, 0.12)";
            ctx.strokeStyle = "rgba(255, 51, 102, 0.65)";
            ctx.beginPath();
            for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
                const pt = project3D(state.posEw.x + Math.cos(a) * 240, state.posEw.y + Math.sin(a) * 240, 0);
                if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.fill();
            ctx.stroke();
        }

        // Layer 3: Parabolic 3D Arcs
        function drawArc3D(from, to, color, dashed = false) {
            if (!layerVis.arcs) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.8;
            if (dashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
            ctx.beginPath();
            for (let t = 0; t <= 1.02; t += 0.05) {
                const ix = from.x + (to.x - from.x) * t;
                const iy = from.y + (to.y - from.y) * t;
                const iz = from.z + (to.z - from.z) * t + Math.sin(t * Math.PI) * 90;
                const pt = project3D(ix, iy, iz);
                if (t === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        drawArc3D(state.posSat, state.posGcs, "#C084FC");
        drawArc3D(state.posGcs, state.posAlpha, "#00E5FF");
        drawArc3D(state.posAlpha, state.posBravo, "#00FFA3");
        drawArc3D(state.posAlpha, state.posCharlie, "#00FFA3");
        if (isJammingActive) {
            drawArc3D(state.posEw, state.posAlpha, "#FF3366", true);
            drawArc3D(state.posEw, state.posBravo, "#FF3366", true);
        }

        // Layer 4: Ghost Spoof Trajectory Vector
        if (layerVis.ghostPath && isJammingActive) {
            const pB = project3D(state.posBravo.x, state.posBravo.y, state.posBravo.z);
            const pGhost = project3D(state.posBravo.x + 260, state.posBravo.y + 200, state.posBravo.z + 80);
            ctx.strokeStyle = "#FF3366";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(pB.x, pB.y); ctx.lineTo(pGhost.x, pGhost.y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#FF3366";
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillText("[X] REJECTED GPS SPOOF (ΔV=420m/s)", pGhost.x + 8, pGhost.y);
        }

        // Layer 5, 6, 7: Airframes, Stalks & Callsigns
        function drawEntity(pos, color, callsign, subtext, isDrone = true) {
            const pAir = project3D(pos.x, pos.y, pos.z);
            const pGnd = project3D(pos.x, pos.y, 0);

            if (layerVis.stalks) {
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.35;
                ctx.beginPath(); ctx.moveTo(pAir.x, pAir.y); ctx.lineTo(pGnd.x, pGnd.y); ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            const sz = Math.max(7, 15 * pAir.s);
            ctx.fillStyle = color;
            ctx.beginPath();
            if (isDrone) {
                ctx.moveTo(pAir.x, pAir.y - sz);
                ctx.lineTo(pAir.x - sz * 1.15, pAir.y + sz * 0.85);
                ctx.lineTo(pAir.x, pAir.y + sz * 0.35);
                ctx.lineTo(pAir.x + sz * 1.15, pAir.y + sz * 0.85);
            } else {
                ctx.arc(pAir.x, pAir.y, sz * 0.65, 0, Math.PI * 2);
            }
            ctx.closePath();
            ctx.fill();

            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillStyle = color;
            ctx.fillText(callsign, pAir.x + sz + 6, pAir.y - 2);
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "#94A3B8";
            ctx.fillText(subtext, pAir.x + sz + 6, pAir.y + 10);
        }

        drawEntity(state.posGcs, "#00E5FF", "GCS-TACTICAL C2", "10.240.52.120 | STANAG TX", false);
        drawEntity(state.posEw, "#FF3366", "EW-SPOOFER [HOSTILE]", "10.240.52.122 | RF JAMMER", false);
        drawEntity(state.posSat, "#C084FC", "SAT-CCSDS-133 [LEO]", "SPI:0x0100 | KA-BAND", false);
        drawEntity(state.posAlpha, "#00FFA3", "UAV-ALPHA [LEADER]", `ALT: ${state.posAlpha.z.toFixed(0)}m | 23.77ns PASS`);
        drawEntity(state.posBravo, "#00E5FF", "UAV-BRAVO [WING-1]", `ALT: ${state.posBravo.z.toFixed(0)}m | ECHELON LOCK`);
        drawEntity(state.posCharlie, "#FFB800", "UAV-CHARLIE [RECON]", `ALT: ${state.posCharlie.z.toFixed(0)}m | FLIR + LIDAR`);
    }

    // Register Tab
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => initDeckGlSwarmC2(container)
    });

    console.log("[Aerospace Plugin] Initialized 7-Layer Deck.gl Tactical Swarm C2 Engine.");
})();
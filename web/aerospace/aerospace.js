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
    // 2. DECK.GL 7-LAYER 3D TACTICAL SWARM & SATCOM THEATRE C2
    // ========================================================================
    const ORIGIN_LON = 4.9000;
    const ORIGIN_LAT = 52.3700;

    let c2AnimId = null;
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

    // Procedural Topographic Elevation Function for Realistic 3D Terrain Ridges
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

        slPitch?.addEventListener("input", (e) => {
            viewState.pitch = Number(e.target.value);
            syncSlidersFromView();
        });
        slBearing?.addEventListener("input", (e) => {
            viewState.bearing = Number(e.target.value);
            syncSlidersFromView();
        });
        slZoom?.addEventListener("input", (e) => {
            viewState.zoom = Number(e.target.value);
            syncSlidersFromView();
        });

        // Formation Switchers -> Commands the Docker GCS Container via POST :18090/formation
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

                // Command the running matrix-uav-gcs Docker container to morph wire coordinates
                fetch(`http://${window.location.hostname}:18090/formation`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ formation: currentFormation })
                }).catch(() => { });
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
                    viewState = { longitude: ORIGIN_LON, latitude: ORIGIN_LAT, zoom: 14.3, pitch: 58, bearing: -24 };
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

        // Interactive Mouse Drag (Left-Drag: 3D Orbit/Pitch, Right-Drag: Pan, Scroll: Zoom)
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

        // Dynamic Swarm State
        let tick = 0;
        let posAlpha = { x: 0, y: 80, z: 120, heading: 0, roll: 0 };
        let posBravo = { x: -140, y: -40, z: 118, heading: 0, roll: 0 };
        let posCharlie = { x: 140, y: -40, z: 145, heading: 0, roll: 0 };
        const posGcs = { x: 0, y: -420, z: 18 };
        const posEw = { x: 420, y: 220, z: 42 };

        const trailAlpha = [];
        const trailBravo = [];
        const trailCharlie = [];

        // 3D Airspace Waypoint Corridor Gates
        const waypointGates = [
            { id: "WP-01 [ENTRY]", x: -160, y: -180, z: 115 },
            { id: "WP-02 [CORRIDOR]", x: -60, y: 0, z: 120 },
            { id: "WP-03 [TARGET]", x: 60, y: 140, z: 125 },
            { id: "WP-04 [EGRESS]", x: 180, y: 260, z: 130 }
        ];


        

    }

    // ========================================================================
    // 3. 7-LAYER 3D TACTICAL THEATRE RENDERING PIPELINE
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

        // Atmospheric Void Background Gradient
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

        // --------------------------------------------------------------------
        // LAYER 1: 3D TOPOGRAPHIC WIREFRAME TERRAIN & TACTICAL GRID
        // --------------------------------------------------------------------
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

        // Tactical Range Rings (250m, 500m, 750m)
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

        // --------------------------------------------------------------------
        // LAYER 2: 3D GEODESIC EW JAMMING DOME (HEMISPHERE + SWEEP)
        // --------------------------------------------------------------------
        if (layerVis.jamDome && isJammingActive) {
            const domeR = 230;
            // Latitude rings on the 3D hemisphere
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

            // Meridian ribs over the 3D EW dome
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

        // --------------------------------------------------------------------
        // LAYER 3: 3D AIRSPACE WAYPOINT CORRIDOR GATES
        // --------------------------------------------------------------------
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

        // --------------------------------------------------------------------
        // LAYER 4: 3D FLIGHT RIBBONS, CURTAINS & GHOST SPOOF VECTOR
        // --------------------------------------------------------------------
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

            // Vertical Altitude Curtain ticks
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

        // Rejected GPS Spoof Ghost Vector (Severed at CBF Barrier)
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

            // CBF Interception X-Marker
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

        // --------------------------------------------------------------------
        // LAYER 5: 3D PARABOLIC DATA-LINK ARCS & LIVE PACKET PULSES
        // --------------------------------------------------------------------
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

            // Animated Packet Pulse traveling along the 3D Arc
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

        // --------------------------------------------------------------------
        // LAYER 6 & 7: 3D STEALTH UAV AIRFRAMES, SATELLITE & MIL-STD CALLSIGNS
        // --------------------------------------------------------------------
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

                // Ground target ring
                ctx.beginPath();
                ctx.arc(pGround.x, pGround.y, 5 * pGround.s, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // 3D Swept-Wing Stealth Airframe Vertices in World Meters
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

            // Airframe Polygon Fill
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

            // Internal Structural Ridge Lines
            ctx.beginPath();
            ctx.moveTo(vNose.x, vNose.y); ctx.lineTo(vCanopy.x, vCanopy.y);
            ctx.lineTo(vTail.x, vTail.y);
            ctx.stroke();

            // Glowing Ion Thruster Plume
            ctx.fillStyle = hexColor;
            ctx.beginPath();
            ctx.arc(vTail.x, vTail.y, Math.max(3, 5 * pCenter.s), 0, Math.PI * 2);
            ctx.fill();

            // Active CBF Protection Shield Ring when under EW attack
            if (isJammingActive) {
                ctx.strokeStyle = "rgba(0, 255, 163, 0.35)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(pCenter.x, pCenter.y, Math.max(16, 28 * pCenter.s), 0, Math.PI * 2);
                ctx.stroke();
            }

            // MIL-STD Callsign Label Box
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
                // LEO Satellite with Solar Array Wings
                ctx.fillRect(pt.x - 6, pt.y - 6, 12, 12);
                ctx.strokeRect(pt.x - 6, pt.y - 6, 12, 12);
                ctx.fillStyle = "rgba(192, 132, 252, 0.45)";
                ctx.fillRect(pt.x - 26, pt.y - 4, 16, 8);
                ctx.fillRect(pt.x + 10, pt.y - 4, 16, 8);
                ctx.strokeRect(pt.x - 26, pt.y - 4, 16, 8);
                ctx.strokeRect(pt.x + 10, pt.y - 4, 16, 8);
            } else {
                // Ground C2 / EW Station Octagon
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

    // Register Tab
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => initDeckGlSwarmC2(container)
    });

    console.log("[Aerospace Plugin] Initialized 7-Layer 3D Tactical Swarm C2 Theatre.");
})();
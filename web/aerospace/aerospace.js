// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js

(function () {
    if (!window.SentinelUI) return;

    let radarTick = 0;

    // ========================================================================
    // 1. PANE 01: TACTICAL 360° RADAR SCOPE (2D Canvas)
    // ========================================================================
    function renderRadar(canvas, node, isAnomaly) {
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
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = b.color;
            ctx.fillText(b.label, b.x + 8, b.y + 3);
        });

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = isAnomaly ? "#FF3366" : "#00E5FF";
        ctx.fillText(isAnomaly ? "[!] GPS DRIFT DETECTED: AIR-GAP TRIPPED" : "[+] TACTICAL 360° SWARM RADAR: INVARIANTS LOCKED", 16, 22);
    }

    // Register Node Adapter for Master-Detail Cockpit
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

    // ========================================================================
    // 2. TACTICAL SWARM C2 (HYBRID 3D/2D FAIL-SAFE ENGINE)
    // ========================================================================
    let currentFormation = "v_formation";
    let isJammingActive = true;
    let animLoopId = null;

    function isWebGLAvailable() {
        try {
            const canvas = document.createElement("canvas");
            return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
        } catch (e) {
            return false;
        }
    }

    function init3DSwarmScene(container) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#0d111a; border:1px solid #1a2232; padding:10px 16px; border-radius:4px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">TACTICAL AIRSPACE &amp; SWARM FORMATION C2</span>
                        <span class="badge ${isWebGLAvailable() ? 'badge-green' : 'badge-cyan'}" style="font-size:9px;" id="render-mode-badge">
                            ${isWebGLAvailable() ? 'THREE.JS 3D WEBGL' : 'TACTICAL 2D RADAR'}
                        </span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="btn-form-v" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #00FFA3; color:#00FFA3; border-radius:3px; cursor:pointer;">V-FORMATION</button>
                        <button id="btn-form-echelon" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">ECHELON RIGHT</button>
                        <button id="btn-form-diamond" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">DIAMOND PATROL</button>
                        <button id="btn-toggle-jamming" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:rgba(239,68,68,0.2); border:1px solid #EF4444; color:#EF4444; border-radius:3px; cursor:pointer;">TOGGLE EW JAMMING</button>
                    </div>
                </div>

                <div id="three-canvas-wrap" style="width:100%; height:540px; background:#04070F; border:1px solid #1A2232; border-radius:4px; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:12px; left:12px; z-index:10; font-family:'JetBrains Mono', monospace; font-size:10px; color:#8A99AD; background:rgba(7,9,14,0.75); padding:6px 10px; border-radius:3px; border:1px solid #1A2232; pointer-events:none;">
                        [CONTROLS] Click &bull; Drag to Rotate &bull; Scroll to Zoom &bull; Formation Buttons Above
                    </div>
                    <div id="three-telemetry-overlay" style="position:absolute; bottom:12px; right:12px; z-index:10; font-family:'JetBrains Mono', monospace; font-size:10px; background:rgba(7,9,14,0.85); padding:10px 14px; border-radius:4px; border:1px solid #00FFA3; color:#F0F4F8; min-width:240px; pointer-events:none;">
                        <div style="color:#00FFA3; font-weight:800; margin-bottom:4px;">SWARM DEFENSE STATUS: NOMINAL</div>
                        <div>Leader Altitude: <b style="color:#00E5FF;">120.4 m</b></div>
                        <div>Airframe Speed: <b style="color:#00E5FF;">24.2 m/s</b> (&le; 80 m/s limit)</div>
                        <div>STANAG Monotonicity: <b style="color:#00FFA3;">PASS (23.77 ns)</b></div>
                        <div>Replay Rejections: <b style="color:#FF3366;" id="overlay-drops">42</b></div>
                    </div>
                </div>
            </div>
        `;

        const wrap = document.getElementById("three-canvas-wrap");

        // Bind Formation Buttons
        document.getElementById("btn-form-v")?.addEventListener("click", () => setFormation("v_formation"));
        document.getElementById("btn-form-echelon")?.addEventListener("click", () => setFormation("echelon"));
        document.getElementById("btn-form-diamond")?.addEventListener("click", () => setFormation("diamond"));
        document.getElementById("btn-toggle-jamming")?.addEventListener("click", () => {
            isJammingActive = !isJammingActive;
        });

        function setFormation(form) {
            currentFormation = form;
            document.querySelectorAll("#tab-swarm-c2 .btn-ctrl").forEach(b => {
                b.style.borderColor = "#334155";
                b.style.color = "#8A99AD";
            });
            if (form === "v_formation") {
                document.getElementById("btn-form-v").style.borderColor = "#00FFA3";
                document.getElementById("btn-form-v").style.color = "#00FFA3";
            } else if (form === "echelon") {
                document.getElementById("btn-form-echelon").style.borderColor = "#00E5FF";
                document.getElementById("btn-form-echelon").style.color = "#00E5FF";
            } else if (form === "diamond") {
                document.getElementById("btn-form-diamond").style.borderColor = "#FFB800";
                document.getElementById("btn-form-diamond").style.color = "#FFB800";
            }
        }

        // Check if WebGL context is actually available in the browser/VMware
        if (window.THREE && isWebGLAvailable()) {
            try {
                launchThreeJsWebGL(wrap);
                return;
            } catch (err) {
                console.warn("[Aerospace] Three.js WebGL init failed, switching to 2D Canvas engine:", err);
            }
        }

        // Fallback: 2D Tactical Swarm Radar Engine (Guaranteed 100% visible in any VM)
        launchTactical2DEngine(wrap);
    }

    // --- THREE.JS 3D WEBGL ENGINE ---
    function launchThreeJsWebGL(wrap) {
        const w = wrap.clientWidth || 960;
        const h = wrap.clientHeight || 540;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x04070f);

        const camera = new THREE.PerspectiveCamera(50, w / h, 1, 3000);
        camera.position.set(0, 160, 260);
        camera.lookAt(0, 20, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; z-index:1;";
        wrap.appendChild(renderer.domElement);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);

        // Ground Grid
        const grid = new THREE.GridHelper(500, 40, 0x00e5ff, 0x162234);
        grid.position.y = -60;
        scene.add(grid);

        // Swarm Group
        const swarm = new THREE.Group();
        scene.add(swarm);

        function createDrone(color) {
            const g = new THREE.Group();
            const b = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 4), new THREE.MeshStandardMaterial({ color: 0x1a2433 }));
            b.rotateX(Math.PI / 2);
            g.add(b);
            const w = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 6), new THREE.MeshBasicMaterial({ color: color }));
            g.add(w);
            return g;
        }

        const d1 = createDrone(0x00ffa3); d1.name = "d1"; swarm.add(d1);
        const d2 = createDrone(0x00e5ff); d2.name = "d2"; swarm.add(d2);
        const d3 = createDrone(0xffb800); d3.name = "d3"; swarm.add(d3);

        d1.position.set(0, 30, 30);
        d2.position.set(-50, 25, -20);
        d3.position.set(50, 25, -20);

        // Mouse drag orbit
        let isDragging = false;
        let px = 0, py = 0, theta = 0, phi = Math.PI / 4, rad = 300;
        renderer.domElement.addEventListener("mousedown", (e) => { isDragging = true; px = e.clientX; py = e.clientY; });
        window.addEventListener("mouseup", () => isDragging = false);
        renderer.domElement.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            theta -= (e.clientX - px) * 0.008;
            phi = Math.max(0.2, Math.min(Math.PI / 2.1, phi - (e.clientY - py) * 0.008));
            camera.position.set(rad * Math.sin(phi) * Math.sin(theta), rad * Math.cos(phi), rad * Math.sin(phi) * Math.cos(theta));
            camera.lookAt(0, 20, 0);
            px = e.clientX; py = e.clientY;
        });

        // Loop
        let tick = 0;
        function render3D() {
            animLoopId = requestAnimationFrame(render3D);
            tick += 0.03;
            d1.position.y = 30 + Math.sin(tick) * 2;
            d2.position.y = 25 + Math.sin(tick + 1) * 2;
            d3.position.y = 25 + Math.sin(tick + 2) * 2;
            renderer.render(scene, camera);
        }
        if (animLoopId) cancelAnimationFrame(animLoopId);
        render3D();
    }

    // --- TACTICAL 2D/ISOMETRIC ENGINE (FAIL-SAFE) ---
    function launchTactical2DEngine(wrap) {
        const canvas = document.createElement("canvas");
        canvas.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; z-index:1;";
        wrap.appendChild(canvas);
        const ctx = canvas.getContext("2d");

        function resize() {
            canvas.width = wrap.clientWidth || 960;
            canvas.height = wrap.clientHeight || 540;
        }
        resize();
        window.addEventListener("resize", resize);

        let tick = 0;
        function render2D() {
            animLoopId = requestAnimationFrame(render2D);
            tick += 0.02;

            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2 + 30;

            // Background
            ctx.fillStyle = "#04070F";
            ctx.fillRect(0, 0, w, h);

            // Isometric Perspective Grid
            ctx.strokeStyle = "rgba(0, 229, 255, 0.15)";
            ctx.lineWidth = 1;
            for (let x = -300; x <= 300; x += 50) {
                ctx.beginPath();
                ctx.moveTo(cx + x * 0.8, cy + 120);
                ctx.lineTo(cx + x * 1.5, h);
                ctx.stroke();
            }
            for (let y = cy - 60; y <= h; y += 35) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Concentric Airspace Rings
            [80, 160, 240].forEach(r => {
                ctx.strokeStyle = "rgba(0, 255, 163, 0.2)";
                ctx.beginPath();
                ctx.ellipse(cx, cy, r * 1.4, r * 0.6, 0, 0, Math.PI * 2);
                ctx.stroke();
            });

            // Formation Targets
            let p1 = { x: cx, y: cy - 70 };
            let p2 = { x: cx - 110, y: cy + 10 };
            let p3 = { x: cx + 110, y: cy + 10 };

            if (currentFormation === "echelon") {
                p2 = { x: cx + 70, y: cy - 20 };
                p3 = { x: cx + 140, y: cy + 30 };
            } else if (currentFormation === "diamond") {
                p2 = { x: cx - 100, y: cy };
                p3 = { x: cx, y: cy + 70 };
            }

            // Draw Formation Links
            ctx.strokeStyle = "rgba(0, 255, 163, 0.4)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p3.x, p3.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Drones
            function drawDrone(p, color, label, altitude) {
                // Altitude stalk
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y + 40);
                ctx.stroke();
                ctx.globalAlpha = 1.0;

                // Drone Body (Delta shape)
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - 10);
                ctx.lineTo(p.x - 12, p.y + 10);
                ctx.lineTo(p.x, p.y + 6);
                ctx.lineTo(p.x + 12, p.y + 10);
                ctx.closePath();
                ctx.fill();

                // Label
                ctx.font = "10px 'JetBrains Mono', monospace";
                ctx.fillStyle = color;
                ctx.fillText(label, p.x + 16, p.y);
                ctx.fillStyle = "#8A99AD";
                ctx.fillText(altitude, p.x + 16, p.y + 12);
            }

            drawDrone(p1, "#00FFA3", "UAV-ALPHA (LEADER)", "ALT: 120.4m");
            drawDrone(p2, "#00E5FF", "UAV-BRAVO (WINGMAN 1)", "ALT: 118.0m");
            drawDrone(p3, "#FFB800", "UAV-CHARLIE (WINGMAN 2)", "ALT: 119.2m");

            // Hostile EW Spoofer Node
            const ewX = cx + 240;
            const ewY = cy - 80;
            ctx.fillStyle = "#FF3366";
            ctx.fillRect(ewX - 8, ewY - 6, 16, 12);
            ctx.font = "10px 'JetBrains Mono', monospace";
            ctx.fillText("EW-SPOOFER (ADVERSARY)", ewX + 14, ewY);

            // Pulsing Jamming Wave
            if (isJammingActive) {
                const waveR = 25 + (Math.sin(tick * 4) + 1) * 20;
                ctx.strokeStyle = "rgba(255, 51, 102, 0.4)";
                ctx.beginPath();
                ctx.arc(ewX, ewY, waveR, 0, Math.PI * 2);
                ctx.stroke();

                // Line of sight attack beam
                ctx.strokeStyle = "rgba(255, 51, 102, 0.3)";
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(ewX, ewY);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (animLoopId) cancelAnimationFrame(animLoopId);
        render2D();
    }

    // 2. REGISTER DEDICATED SWARM TAB
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => init3DSwarmScene(container)
    });

    console.log("[Aerospace Plugin] Initialized Tactical Aerospace Micro-Frontend with Fail-Safe Radar.");
})();
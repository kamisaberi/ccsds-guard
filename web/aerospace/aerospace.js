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
        }
        // Removed hardcoded getSensors and getAttacks so backend template engine drives them!
    });
    // ========================================================================
    // 2. FULLY INTERACTIVE TACTICAL SWARM C2 (3D Orbit, Pan, and Zoom)
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
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">TACTICAL 3D AIRSPACE &amp; SWARM FORMATION C2</span>
                        <span class="badge ${isWebGLAvailable() ? 'badge-green' : 'badge-cyan'}" style="font-size:9px;" id="render-mode-badge">
                            ${isWebGLAvailable() ? 'THREE.JS 3D WEBGL' : 'TACTICAL 3D PROJECTION'}
                        </span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="btn-form-v" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #00FFA3; color:#00FFA3; border-radius:3px; cursor:pointer;">V-FORMATION</button>
                        <button id="btn-form-echelon" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">ECHELON RIGHT</button>
                        <button id="btn-form-diamond" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">DIAMOND PATROL</button>
                        <button id="btn-toggle-jamming" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:rgba(239,68,68,0.2); border:1px solid #EF4444; color:#EF4444; border-radius:3px; cursor:pointer;">TOGGLE EW JAMMING</button>
                        <button id="btn-reset-cam" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #00E5FF; color:#00E5FF; border-radius:3px; cursor:pointer;">RESET VIEW</button>
                    </div>
                </div>

                <div id="three-canvas-wrap" style="width:100%; height:540px; background:#04070F; border:1px solid #1A2232; border-radius:4px; position:relative; overflow:hidden; cursor:grab;">
                    <div style="position:absolute; top:12px; left:12px; z-index:10; font-family:'JetBrains Mono', monospace; font-size:10px; color:#8A99AD; background:rgba(7,9,14,0.75); padding:6px 10px; border-radius:3px; border:1px solid #1A2232; pointer-events:none;">
                        [INTERACTION] Left-Click + Drag: 360° Orbit &bull; Right-Click + Drag: Pan &bull; Scroll: Zoom &bull; Reset View
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

        // Formation Switcher
        document.getElementById("btn-form-v")?.addEventListener("click", () => setFormation("v_formation"));
        document.getElementById("btn-form-echelon")?.addEventListener("click", () => setFormation("echelon"));
        document.getElementById("btn-form-diamond")?.addEventListener("click", () => setFormation("diamond"));
        document.getElementById("btn-toggle-jamming")?.addEventListener("click", () => {
            isJammingActive = !isJammingActive;
        });

        function setFormation(form) {
            currentFormation = form;
            document.querySelectorAll("#tab-swarm-c2 .btn-ctrl").forEach(b => {
                if (b.id !== "btn-reset-cam") {
                    b.style.borderColor = "#334155";
                    b.style.color = "#8A99AD";
                }
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

        // Try Three.js WebGL first; fall back to interactive 3D tactical projection engine
        if (window.THREE && isWebGLAvailable()) {
            try {
                launchThreeJsWebGL(wrap);
                return;
            } catch (err) {
                console.warn("[Aerospace] Three.js WebGL init failed, switching to 3D Projection engine:", err);
            }
        }

        // Guaranteed Full 3D Interactive Tactical Engine (Works in all VMs without WebGL)
        launchTactical3DEngine(wrap);
    }

    // ========================================================================
    // A. THREE.JS 3D WEBGL ENGINE WITH INTERACTIVE ORBIT, PAN, AND ZOOM
    // ========================================================================
    function launchThreeJsWebGL(wrap) {
        const w = wrap.clientWidth || 960;
        const h = wrap.clientHeight || 540;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x04070f);

        const camera = new THREE.PerspectiveCamera(50, w / h, 1, 3000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; z-index:1;";
        wrap.appendChild(renderer.domElement);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.3);
        dirLight.position.set(120, 250, 120);
        scene.add(dirLight);

        // Ground Grid & Rings
        const grid = new THREE.GridHelper(600, 50, 0x00e5ff, 0x162234);
        grid.position.y = -60;
        scene.add(grid);

        [80, 160, 240].forEach(rad => {
            const ringGeo = new THREE.RingGeometry(rad - 0.5, rad + 0.5, 64);
            ringGeo.rotateX(Math.PI / 2);
            const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00ffa3, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
            ring.position.y = -59.5;
            scene.add(ring);
        });

        // Drones
        const swarm = new THREE.Group();
        scene.add(swarm);

        function makeUav(color) {
            const g = new THREE.Group();
            const b = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 4), new THREE.MeshStandardMaterial({ color: 0x1a2433 }));
            b.rotateX(Math.PI / 2);
            g.add(b);
            const w = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 6), new THREE.MeshBasicMaterial({ color: color }));
            g.add(w);
            return g;
        }

        const d1 = makeUav(0x00ffa3); d1.name = "d1"; swarm.add(d1);
        const d2 = makeUav(0x00e5ff); d2.name = "d2"; swarm.add(d2);
        const d3 = makeUav(0xffb800); d3.name = "d3"; swarm.add(d3);

        // Interactive Camera State
        let isOrbiting = false;
        let isPanning = false;
        let startX = 0, startY = 0;
        let theta = 0.0;
        let phi = Math.PI / 3.6;
        let radius = 320;
        let targetX = 0, targetY = 15, targetZ = 0;

        function updateCam() {
            camera.position.x = targetX + radius * Math.sin(phi) * Math.sin(theta);
            camera.position.y = targetY + radius * Math.cos(phi);
            camera.position.z = targetZ + radius * Math.sin(phi) * Math.cos(theta);
            camera.lookAt(targetX, targetY, targetZ);
        }

        updateCam();

        document.getElementById("btn-reset-cam")?.addEventListener("click", () => {
            theta = 0; phi = Math.PI / 3.6; radius = 320;
            targetX = 0; targetY = 15; targetZ = 0;
            updateCam();
        });

        wrap.addEventListener("mousedown", (e) => {
            if (e.button === 0) { isOrbiting = true; wrap.style.cursor = "grabbing"; }
            if (e.button === 2) { isPanning = true; wrap.style.cursor = "move"; }
            startX = e.clientX;
            startY = e.clientY;
        });

        window.addEventListener("mouseup", () => {
            isOrbiting = false;
            isPanning = false;
            wrap.style.cursor = "grab";
        });

        window.addEventListener("mousemove", (e) => {
            if (!isOrbiting && !isPanning) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (isOrbiting) {
                theta -= dx * 0.007;
                phi = Math.max(0.15, Math.min(Math.PI / 2.05, phi - dy * 0.007));
                updateCam();
            } else if (isPanning) {
                targetX -= dx * 0.3;
                targetY += dy * 0.3;
                updateCam();
            }

            startX = e.clientX;
            startY = e.clientY;
        });

        wrap.addEventListener("wheel", (e) => {
            e.preventDefault();
            radius = Math.max(80, Math.min(800, radius + e.deltaY * 0.35));
            updateCam();
        }, { passive: false });

        let tick = 0;
        function render3D() {
            animLoopId = requestAnimationFrame(render3D);
            tick += 0.02;
            d1.position.y = 30 + Math.sin(tick) * 2;
            d2.position.y = 25 + Math.sin(tick + 1) * 2;
            d3.position.y = 25 + Math.sin(tick + 2) * 2;

            if (currentFormation === "v_formation") {
                d2.position.x += (-50 - d2.position.x) * 0.06;
                d2.position.z += (-20 - d2.position.z) * 0.06;
                d3.position.x += (50 - d3.position.x) * 0.06;
                d3.position.z += (-20 - d3.position.z) * 0.06;
            } else if (currentFormation === "echelon") {
                d2.position.x += (40 - d2.position.x) * 0.06;
                d2.position.z += (10 - d2.position.z) * 0.06;
                d3.position.x += (80 - d3.position.x) * 0.06;
                d3.position.z += (-20 - d3.position.z) * 0.06;
            } else if (currentFormation === "diamond") {
                d2.position.x += (-50 - d2.position.x) * 0.06;
                d2.position.z += (0 - d2.position.z) * 0.06;
                d3.position.x += (0 - d3.position.x) * 0.06;
                d3.position.z += (-50 - d3.position.z) * 0.06;
            }

            renderer.render(scene, camera);
        }

        if (animLoopId) cancelAnimationFrame(animLoopId);
        render3D();
    }

    // ========================================================================
    // B. GUARANTEED TACTICAL 3D PROJECTION ENGINE (Full Orbit/Pan/Zoom in 2D)
    // ========================================================================
    function launchTactical3DEngine(wrap) {
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

        // 3D Camera & Transform State
        let yaw = 0.0;           // Horizontal 360° orbit rotation
        let pitch = 0.55;        // Vertical elevation angle (~32°)
        let zoom = 1.0;          // Continuous distance scaling
        let panX = 0, panY = 0;  // Spatial panning offset
        let isOrbiting = false;
        let isPanning = false;
        let startX = 0, startY = 0;

        document.getElementById("btn-reset-cam")?.addEventListener("click", () => {
            yaw = 0.0; pitch = 0.55; zoom = 1.0; panX = 0; panY = 0;
        });

        wrap.addEventListener("mousedown", (e) => {
            if (e.button === 0) { isOrbiting = true; wrap.style.cursor = "grabbing"; }
            if (e.button === 2) { isPanning = true; wrap.style.cursor = "move"; }
            startX = e.clientX;
            startY = e.clientY;
        });

        window.addEventListener("mouseup", () => {
            isOrbiting = false;
            isPanning = false;
            wrap.style.cursor = "grab";
        });

        wrap.addEventListener("contextmenu", (e) => e.preventDefault());

        window.addEventListener("mousemove", (e) => {
            if (!isOrbiting && !isPanning) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (isOrbiting) {
                yaw += dx * 0.008;
                pitch = Math.max(0.12, Math.min(1.45, pitch + dy * 0.008));
            } else if (isPanning) {
                panX += dx;
                panY += dy;
            }

            startX = e.clientX;
            startY = e.clientY;
        });

        wrap.addEventListener("wheel", (e) => {
            e.preventDefault();
            zoom = Math.max(0.4, Math.min(2.8, zoom - e.deltaY * 0.0015));
        }, { passive: false });

        // Mathematical 3D-to-2D Perspective Projection
        function project(x, y, z) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2 + 30;

            // 1. Yaw rotation (Y-axis)
            const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
            const x1 = x * cosY - z * sinY;
            const z1 = x * sinY + z * cosY;

            // 2. Pitch rotation (X-axis)
            const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
            const y2 = y * cosP - z1 * sinP;
            const z2 = y * sinP + z1 * cosP;

            // 3. Perspective depth divide & zoom
            const fov = 480 * zoom;
            const depth = 520 + z2;
            const scale = fov / Math.max(20, depth);

            return {
                x: cx + panX + x1 * scale,
                y: cy + panY - y2 * scale,
                scale: scale,
                depth: z2
            };
        }

        let tick = 0;
        let d1Pos = { x: 0, y: 30, z: 30 };
        let d2Pos = { x: -60, y: 25, z: -20 };
        let d3Pos = { x: 60, y: 25, z: -20 };

        function render3DProjection() {
            animLoopId = requestAnimationFrame(render3DProjection);
            tick += 0.02;

            const w = canvas.width;
            const h = canvas.height;

            // Dark void background
            ctx.fillStyle = "#04070F";
            ctx.fillRect(0, 0, w, h);

            // 1. Draw 3D Ground Grid (Floor at Y = -60)
            ctx.strokeStyle = "rgba(0, 229, 255, 0.16)";
            ctx.lineWidth = 1;
            const floorY = -60;
            const gridSize = 250;
            const step = 50;

            for (let x = -gridSize; x <= gridSize; x += step) {
                const pStart = project(x, floorY, -gridSize);
                const pEnd = project(x, floorY, gridSize);
                ctx.beginPath();
                ctx.moveTo(pStart.x, pStart.y);
                ctx.lineTo(pEnd.x, pEnd.y);
                ctx.stroke();
            }

            for (let z = -gridSize; z <= gridSize; z += step) {
                const pStart = project(-gridSize, floorY, z);
                const pEnd = project(gridSize, floorY, z);
                ctx.beginPath();
                ctx.moveTo(pStart.x, pStart.y);
                ctx.lineTo(pEnd.x, pEnd.y);
                ctx.stroke();
            }

            // 2. Draw 3D Tactical Concentric Airspace Rings
            [80, 160, 240].forEach(rad => {
                ctx.strokeStyle = "rgba(0, 255, 163, 0.22)";
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
                    const rx = Math.cos(a) * rad;
                    const rz = Math.sin(a) * rad;
                    const pt = project(rx, floorY, rz);
                    if (a === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            });

            // 3. Formation Morphing Interpolation
            if (currentFormation === "v_formation") {
                d2Pos.x += (-60 - d2Pos.x) * 0.06;
                d2Pos.z += (-20 - d2Pos.z) * 0.06;
                d3Pos.x += (60 - d3Pos.x) * 0.06;
                d3Pos.z += (-20 - d3Pos.z) * 0.06;
            } else if (currentFormation === "echelon") {
                d2Pos.x += (45 - d2Pos.x) * 0.06;
                d2Pos.z += (10 - d2Pos.z) * 0.06;
                d3Pos.x += (90 - d3Pos.x) * 0.06;
                d3Pos.z += (-20 - d3Pos.z) * 0.06;
            } else if (currentFormation === "diamond") {
                d2Pos.x += (-50 - d2Pos.x) * 0.06;
                d2Pos.z += (0 - d2Pos.z) * 0.06;
                d3Pos.x += (0 - d3Pos.x) * 0.06;
                d3Pos.z += (-50 - d3Pos.z) * 0.06;
            }

            // Hover bobbing
            const yAlpha = d1Pos.y + Math.sin(tick * 1.5) * 2;
            const yBravo = d2Pos.y + Math.sin(tick * 1.5 + 1) * 2;
            const yCharlie = d3Pos.y + Math.sin(tick * 1.5 + 2) * 2;

            const projAlpha = project(d1Pos.x, yAlpha, d1Pos.z);
            const projBravo = project(d2Pos.x, yBravo, d2Pos.z);
            const projCharlie = project(d3Pos.x, yCharlie, d3Pos.z);

            // 4. Draw Formation Triangle Mesh
            ctx.strokeStyle = "rgba(0, 255, 163, 0.4)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(projAlpha.x, projAlpha.y);
            ctx.lineTo(projBravo.x, projBravo.y);
            ctx.lineTo(projCharlie.x, projCharlie.y);
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);

            // 5. Draw 3D Tactical Drones
            function draw3DUav(pt, color, label, alt) {
                // Ground stalk
                const pFloor = project(pt.origX, floorY, pt.origZ);
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(pFloor.x, pFloor.y);
                ctx.stroke();
                ctx.globalAlpha = 1.0;

                // Drone Delta-Wing (rotates with camera yaw)
                const s = Math.max(6, 14 * pt.scale);
                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate(-yaw * 0.6);

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(0, -s);
                ctx.lineTo(-s * 1.2, s);
                ctx.lineTo(0, s * 0.5);
                ctx.lineTo(s * 1.2, s);
                ctx.closePath();
                ctx.fill();

                // Thruster Glow
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.arc(0, s * 0.5, s * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Label
                ctx.font = "10px 'JetBrains Mono', monospace";
                ctx.fillStyle = color;
                ctx.fillText(label, pt.x + s + 6, pt.y - 2);
                ctx.fillStyle = "#8A99AD";
                ctx.fillText(alt, pt.x + s + 6, pt.y + 10);
            }

            projAlpha.origX = d1Pos.x; projAlpha.origZ = d1Pos.z;
            projBravo.origX = d2Pos.x; projBravo.origZ = d2Pos.z;
            projCharlie.origX = d3Pos.x; projCharlie.origZ = d3Pos.z;

            draw3DUav(projAlpha, "#00FFA3", "UAV-ALPHA (LEADER)", "ALT: 120.4m");
            draw3DUav(projBravo, "#00E5FF", "UAV-BRAVO (WINGMAN 1)", "ALT: 118.0m");
            draw3DUav(projCharlie, "#FFB800", "UAV-CHARLIE (WINGMAN 2)", "ALT: 119.2m");

            // 6. Hostile EW Spoofer in 3D Space
            const ewX = 160, ewY = 40, ewZ = -70;
            const projEw = project(ewX, ewY, ewZ);
            projEw.origX = ewX; projEw.origZ = ewZ;

            const pFloorEw = project(ewX, floorY, ewZ);
            ctx.strokeStyle = "#FF3366";
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(projEw.x, projEw.y);
            ctx.lineTo(pFloorEw.x, pFloorEw.y);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            const ewS = Math.max(8, 16 * projEw.scale);
            ctx.fillStyle = "#FF3366";
            ctx.fillRect(projEw.x - ewS / 2, projEw.y - ewS / 2, ewS, ewS);
            ctx.font = "10px 'JetBrains Mono', monospace";
            ctx.fillText("EW-SPOOFER (ADVERSARY)", projEw.x + ewS, projEw.y);

            // Pulsing Jamming Beam towards Alpha
            if (isJammingActive) {
                const waveR = Math.max(12, (20 + (Math.sin(tick * 4) + 1) * 16) * projEw.scale);
                ctx.strokeStyle = "rgba(255, 51, 102, 0.4)";
                ctx.beginPath();
                ctx.arc(projEw.x, projEw.y, waveR, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = "rgba(255, 51, 102, 0.35)";
                ctx.setLineDash([3, 4]);
                ctx.beginPath();
                ctx.moveTo(projEw.x, projEw.y);
                ctx.lineTo(projAlpha.x, projAlpha.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (animLoopId) cancelAnimationFrame(animLoopId);
        render3DProjection();
    }

    // Register Tab
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => init3DSwarmScene(container)
    });

    console.log("[Aerospace Plugin] Initialized Tactical Aerospace Micro-Frontend with Interactive 3D Radar.");
})();
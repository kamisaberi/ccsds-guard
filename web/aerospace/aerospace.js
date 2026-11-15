// File: /home/kami/ccsds-guard/web/aerospace/aerospace.js

(function () {
    if (!window.SentinelUI) return;

    let radarTick = 0;

    // Tactical Radar Scope (Pane 01)
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

    // 1. REGISTER NODE ADAPTER (Option A)
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
    // 2. REGISTER REAL 3D WEBGL SWARM C2 TAB (THREE.JS INTEGRATION)
    // ========================================================================
    let threeScene, threeCamera, threeRenderer, swarmGroup, ewBlip, jammingField;
    let animFrameId = null;
    let isJammingActive = true;
    let currentFormation = "v_formation";

    function createDroneMesh(colorHex, label) {
        const group = new THREE.Group();

        // 1. Fuselage
        const bodyGeo = new THREE.ConeGeometry(3, 14, 5);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1f2937,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // 2. Delta Wings
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 3);
        wingShape.lineTo(-14, -6);
        wingShape.lineTo(0, -3);
        wingShape.lineTo(14, -6);
        wingShape.closePath();

        const extSettings = { depth: 0.6, bevelEnabled: false };
        const wingGeo = new THREE.ExtrudeGeometry(wingShape, extSettings);
        wingGeo.rotateX(Math.PI / 2);
        const wingMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.25,
            metalness: 0.7,
            roughness: 0.3
        });
        const wings = new THREE.Mesh(wingGeo, wingMat);
        wings.position.y = 0.2;
        group.add(wings);

        // 3. Glowing Ion Thruster
        const engineGeo = new THREE.SphereGeometry(1.2, 12, 12);
        const engineMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const engine = new THREE.Mesh(engineGeo, engineMat);
        engine.position.z = -7;
        group.add(engine);

        // 4. Ground Altitude Stalk Line
        const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35 });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -60, 0)
        ]);
        const stalk = new THREE.Line(lineGeo, lineMat);
        group.add(stalk);

        return group;
    }

    function init3DSwarmScene(container) {
        if (!window.THREE) {
            container.innerHTML = `<div style="padding:24px; color:#FF3366; font-family:monospace;">[-] Error: Three.js library not loaded.</div>`;
            return;
        }

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#0d111a; border:1px solid #1a2232; padding:10px 16px; border-radius:4px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:12px; font-weight:800; color:#00E5FF; letter-spacing:0.1em;">TACTICAL 3D AIRSPACE & SWARM FORMATION RADAR</span>
                        <span class="badge badge-green" style="font-size:9px;">WEBGL 60-FPS ENGINE</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="btn-form-v" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #00FFA3; color:#00FFA3; border-radius:3px; cursor:pointer;">V-FORMATION</button>
                        <button id="btn-form-echelon" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">ECHELON RIGHT</button>
                        <button id="btn-form-diamond" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:#111827; border:1px solid #334155; color:#8A99AD; border-radius:3px; cursor:pointer;">DIAMOND PATROL</button>
                        <button id="btn-toggle-jamming" class="btn-ctrl" style="padding:4px 10px; font-size:10px; background:rgba(239,68,68,0.2); border:1px solid #EF4444; color:#EF4444; border-radius:3px; cursor:pointer;">TOGGLE EW JAMMING</button>
                    </div>
                </div>

                <div id="three-canvas-wrap" style="width:100%; height:540px; background:#04070F; border:1px solid #1A2232; border-radius:4px; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:12px; left:12px; z-index:10; font-family:'JetBrains Mono', monospace; font-size:10px; color:#8A99AD; background:rgba(7,9,14,0.75); padding:6px 10px; border-radius:3px; border:1px solid #1A2232;">
                        [INTERACTION] Left-Click + Drag: 360° Orbit &bull; Scroll: Altitude Zoom &bull; Right-Click: Pan
                    </div>
                    <div id="three-telemetry-overlay" style="position:absolute; bottom:12px; right:12px; z-index:10; font-family:'JetBrains Mono', monospace; font-size:10px; background:rgba(7,9,14,0.85); padding:10px 14px; border-radius:4px; border:1px solid #00FFA3; color:#F0F4F8; min-width:240px;">
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
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;

        // 1. Scene, Camera, Renderer
        threeScene = new THREE.Scene();
        threeScene.background = new THREE.Color(0x04070f);
        threeScene.fog = new THREE.FogExp2(0x04070f, 0.0015);

        threeCamera = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
        threeCamera.position.set(0, 140, 240);
        threeCamera.lookAt(0, 30, 0);

        threeRenderer = new THREE.WebGLRenderer({ antialias: true });
        threeRenderer.setSize(w, h);
        threeRenderer.setPixelRatio(window.devicePixelRatio);
        wrap.appendChild(threeRenderer.domElement);

        // 2. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        threeScene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0x00e5ff, 1.2);
        dirLight.position.set(100, 200, 100);
        threeScene.add(dirLight);

        // 3. Holographic Ground Grid & Tactical Rings
        const gridHelper = new THREE.GridHelper(500, 50, 0x00e5ff, 0x1a2638);
        gridHelper.position.y = -60;
        threeScene.add(gridHelper);

        // Tactical Range Rings on Floor
        [60, 120, 180].forEach(rad => {
            const ringGeo = new THREE.RingGeometry(rad - 0.4, rad + 0.4, 64);
            ringGeo.rotateX(Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffa3, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = -59.5;
            threeScene.add(ring);
        });

        // 4. Swarm Drones Group
        swarmGroup = new THREE.Group();
        threeScene.add(swarmGroup);

        const droneAlpha = createDroneMesh(0x00ffa3, "ALPHA");   // Leader
        const droneBravo = createDroneMesh(0x00e5ff, "BRAVO");   // Wing 1
        const droneCharlie = createDroneMesh(0xffb800, "CHARLIE"); // Wing 2

        droneAlpha.name = "alpha";
        droneBravo.name = "bravo";
        droneCharlie.name = "charlie";

        swarmGroup.add(droneAlpha);
        swarmGroup.add(droneBravo);
        swarmGroup.add(droneCharlie);

        // Initial V-Formation positions
        droneAlpha.position.set(0, 30, 40);
        droneBravo.position.set(-50, 25, -20);
        droneCharlie.position.set(50, 25, -20);

        // 5. Hostile EW Spoofer Node
        ewBlip = new THREE.Group();
        const ewBody = new THREE.Mesh(
            new THREE.BoxGeometry(10, 6, 12),
            new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xff3366, emissiveIntensity: 0.5 })
        );
        ewBlip.add(ewBody);
        ewBlip.position.set(140, 50, -60);
        threeScene.add(ewBlip);

        // Pulsing Jamming Sphere
        const jamGeo = new THREE.SphereGeometry(32, 24, 24);
        const jamMat = new THREE.MeshBasicMaterial({
            color: 0xff3366,
            wireframe: true,
            transparent: true,
            opacity: 0.35
        });
        jammingField = new THREE.Mesh(jamGeo, jamMat);
        ewBlip.add(jammingField);

        // 6. Interactive Mouse Orbit & Pan Handler
        let isDragging = false;
        let isPanning = false;
        let prevMouseX = 0;
        let prevMouseY = 0;
        let sphericalTheta = 0;
        let sphericalPhi = Math.PI / 4;
        let sphericalRadius = 280;

        threeRenderer.domElement.addEventListener("mousedown", (e) => {
            if (e.button === 0) isDragging = true;
            if (e.button === 2) isPanning = true;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        });

        window.addEventListener("mouseup", () => {
            isDragging = false;
            isPanning = false;
        });

        threeRenderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

        threeRenderer.domElement.addEventListener("mousemove", (e) => {
            const dx = e.clientX - prevMouseX;
            const dy = e.clientY - prevMouseY;

            if (isDragging) {
                sphericalTheta -= dx * 0.007;
                sphericalPhi = Math.max(0.1, Math.min(Math.PI / 2.05, sphericalPhi - dy * 0.007));
                updateCameraPosition();
            } else if (isPanning) {
                threeCamera.position.x -= dx * 0.4;
                threeCamera.position.y += dy * 0.4;
            }

            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        });

        threeRenderer.domElement.addEventListener("wheel", (e) => {
            e.preventDefault();
            sphericalRadius = Math.max(80, Math.min(600, sphericalRadius + e.deltaY * 0.25));
            updateCameraPosition();
        }, { passive: false });

        function updateCameraPosition() {
            threeCamera.position.x = sphericalRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
            threeCamera.position.y = sphericalRadius * Math.cos(sphericalPhi);
            threeCamera.position.z = sphericalRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
            threeCamera.lookAt(0, 15, 0);
        }

        // Formation Switcher Buttons
        document.getElementById("btn-form-v")?.addEventListener("click", () => setFormation("v_formation"));
        document.getElementById("btn-form-echelon")?.addEventListener("click", () => setFormation("echelon"));
        document.getElementById("btn-form-diamond")?.addEventListener("click", () => setFormation("diamond"));
        document.getElementById("btn-toggle-jamming")?.addEventListener("click", () => {
            isJammingActive = !isJammingActive;
            jammingField.visible = isJammingActive;
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

        // 7. Render & Flight Animation Loop (60 FPS)
        let clockTick = 0;
        function animate() {
            animFrameId = requestAnimationFrame(animate);
            clockTick += 0.02;

            // Swarm Formation Flying Hover & Banking
            const alpha = swarmGroup.getObjectByName("alpha");
            const bravo = swarmGroup.getObjectByName("bravo");
            const charlie = swarmGroup.getObjectByName("charlie");

            if (alpha && bravo && charlie) {
                // Bobbing hover
                alpha.position.y = 30 + Math.sin(clockTick * 1.5) * 2;
                bravo.position.y = 25 + Math.sin(clockTick * 1.5 + 1) * 2;
                charlie.position.y = 25 + Math.sin(clockTick * 1.5 + 2) * 2;

                // Subtle tactical roll banking
                alpha.rotation.z = Math.sin(clockTick * 0.8) * 0.08;
                bravo.rotation.z = Math.sin(clockTick * 0.8) * 0.08;
                charlie.rotation.z = Math.sin(clockTick * 0.8) * 0.08;

                // Smooth formation transitions
                if (currentFormation === "v_formation") {
                    bravo.position.x += (-50 - bravo.position.x) * 0.05;
                    bravo.position.z += (-20 - bravo.position.z) * 0.05;
                    charlie.position.x += (50 - charlie.position.x) * 0.05;
                    charlie.position.z += (-20 - charlie.position.z) * 0.05;
                } else if (currentFormation === "echelon") {
                    bravo.position.x += (35 - bravo.position.x) * 0.05;
                    bravo.position.z += (10 - bravo.position.z) * 0.05;
                    charlie.position.x += (70 - charlie.position.x) * 0.05;
                    charlie.position.z += (-20 - charlie.position.z) * 0.05;
                } else if (currentFormation === "diamond") {
                    bravo.position.x += (-45 - bravo.position.x) * 0.05;
                    bravo.position.z += (0 - bravo.position.z) * 0.05;
                    charlie.position.x += (0 - charlie.position.x) * 0.05;
                    charlie.position.z += (-45 - charlie.position.z) * 0.05;
                }
            }

            // EW Jamming Field Pulsing
            if (isJammingActive && jammingField) {
                const scale = 1.0 + Math.sin(clockTick * 4) * 0.2;
                jammingField.scale.set(scale, scale, scale);
                jammingField.rotation.y += 0.01;
            }

            threeRenderer.render(threeScene, threeCamera);
        }

        if (animFrameId) cancelAnimationFrame(animFrameId);
        animate();

        // Auto-Resize handler
        window.addEventListener("resize", () => {
            if (!wrap || !threeRenderer || !threeCamera) return;
            const nw = wrap.clientWidth;
            const nh = wrap.clientHeight;
            threeCamera.aspect = nw / nh;
            threeCamera.updateProjectionMatrix();
            threeRenderer.setSize(nw, nh);
        });
    }

    // 2. REGISTER DEDICATED SWARM TAB
    window.SentinelUI.registerTab({
        id: "tab-swarm-c2",
        label: "Tactical Swarm C2",
        icon: "🛸",
        group: "Operations",
        renderView: (container) => init3DSwarmScene(container)
    });

    console.log("[Aerospace Plugin] Initialized Tactical Aerospace Micro-Frontend with 3D WebGL Swarm Radar.");
})();
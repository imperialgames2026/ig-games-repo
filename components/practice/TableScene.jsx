import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { pockets, reds } from "./outcomes.mjs";
export default function TableScene({
  game,
  outcome,
  busy,
  reduced,
  cameraView,
}) {
  const [error, setError] = useState("");
  const host = useRef(null),
    state = useRef({ game, outcome, busy, reduced, cameraView });
  state.current = { game, outcome, busy, reduced, cameraView };
  useEffect(() => {
    const root = host.current,
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#101b20");
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    camera.position.set(0, 7.8, 8.8);
    camera.lookAt(0, 0, 0);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setError(
        "3D rendering is unavailable on this device. Try reopening the game.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#101b20");
    root.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffeed6, 0x233b39, 2));
    const light = new THREE.DirectionalLight(0xffe6bc, 3);
    light.position.set(3, 9, 4);
    scene.add(light);
    const materials = [];
    const material = (color, metalness = 0) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: metalness ? 0.3 : 0.8,
        metalness,
      });
      materials.push(m);
      return m;
    };
    const wood = material("#4a2717"),
      felt = material("#075d43"),
      gold = material("#bd9452", 0.65),
      black = material("#151c21"),
      red = material("#991e2e"),
      ivory = material("#f3eee1");
    const mesh = (geo, mat, parent, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    mesh(new THREE.BoxGeometry(9, 0.6, 5.4), wood, scene, 0, -0.5, 0);
    mesh(new THREE.BoxGeometry(8.55, 0.12, 4.95), felt, scene, 0, -0.13, 0);
    for (const z of [-2.65, 2.65])
      mesh(new THREE.BoxGeometry(9, 0.45, 0.3), black, scene, 0, -0.05, z);
    for (const x of [-4.4, 4.4])
      mesh(new THREE.BoxGeometry(0.3, 0.45, 5.4), black, scene, x, -0.05, 0);
    const roulette = new THREE.Group();
    scene.add(roulette);
    roulette.position.x = -1.8;
    mesh(
      new THREE.CylinderGeometry(2.15, 2.25, 0.3, 80),
      wood,
      roulette,
      0,
      0.12,
      0,
    );
    const wheel = new THREE.Group();
    roulette.add(wheel);
    for (let i = 0; i < 37; i++) {
      const a = (i * Math.PI * 2) / 37,
        sector = mesh(
          new THREE.CylinderGeometry(
            1.9,
            1.9,
            0.05,
            4,
            1,
            false,
            a,
            (Math.PI * 2) / 37,
          ),
          pockets[i] === 0 ? felt : reds.has(pockets[i]) ? red : black,
          wheel,
          0,
          0.31,
          0,
        );
      sector.rotation.y = 0;
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const c = canvas.getContext("2d");
      c.fillStyle = "white";
      c.font = "bold 38px sans-serif";
      c.textAlign = "center";
      c.fillText(String(pockets[i]), 32, 44);
      const texture = new THREE.CanvasTexture(canvas),
        m = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
      materials.push(m);
      const label = mesh(
        new THREE.PlaneGeometry(0.22, 0.22),
        m,
        wheel,
        Math.sin(a + 0.085) * 1.65,
        0.35,
        Math.cos(a + 0.085) * 1.65,
      );
      label.rotation.x = -Math.PI / 2;
    }
    mesh(
      new THREE.CylinderGeometry(1.25, 1.6, 0.22, 64),
      wood,
      wheel,
      0,
      0.44,
      0,
    );
    mesh(
      new THREE.CylinderGeometry(0.23, 0.35, 0.65, 24),
      gold,
      wheel,
      0,
      0.8,
      0,
    );
    const ball = mesh(
      new THREE.SphereGeometry(0.075, 12, 12),
      ivory,
      roulette,
      0,
      0.42,
      1.8,
    );
    const board = new THREE.Group();
    roulette.add(board);
    board.position.set(3.5, 0, 0);
    for (let i = 1; i <= 36; i++) {
      const x = (i - 1) % 3,
        z = Math.floor((i - 1) / 3);
      mesh(
        new THREE.BoxGeometry(0.35, 0.03, 0.32),
        reds.has(i) ? red : black,
        board,
        x * 0.38 - 0.38,
        0.02,
        z * 0.36 - 2,
      );
    }
    const craps = new THREE.Group();
    scene.add(craps);
    const cloth = document.createElement("canvas");
    cloth.width = 1600;
    cloth.height = 800;
    const ctx = cloth.getContext("2d");
    ctx.fillStyle = "#07583e";
    ctx.fillRect(0, 0, 1600, 800);
    ctx.strokeStyle = "#ddcd98";
    ctx.lineWidth = 4;
    ctx.fillStyle = "#eee0b6";
    ctx.textAlign = "center";
    ctx.strokeRect(35, 35, 1530, 730);
    ctx.font = "bold 42px Georgia";
    ctx.fillText("IMPERIAL GAMING", 800, 95);
    for (const side of [-1, 1]) {
      const cx = 800 + side * 365;
      ctx.strokeRect(cx - 300, 130, 600, 140);
      ctx.font = "bold 32px Georgia";
      [4, 5, 6, 8, 9, 10].forEach((n, i) => {
        ctx.strokeRect(cx - 300 + i * 100, 130, 100, 140);
        ctx.fillText(
          n === 6 ? "SIX" : n === 9 ? "NINE" : String(n),
          cx - 250 + i * 100,
          210,
        );
      });
      ctx.fillStyle = "#e55a58";
      ctx.font = "bold 66px Georgia";
      ctx.fillText("COME", cx, 365);
      ctx.fillStyle = "#eee0b6";
      ctx.font = "bold 40px Georgia";
      ctx.fillText("FIELD", cx, 475);
      ctx.font = "30px Georgia";
      ctx.fillText("2   3   4   9   10   11   12", cx, 530);
      ctx.strokeRect(cx - 300, 580, 600, 125);
      ctx.font = "bold 40px Georgia";
      ctx.fillText("PASS LINE", cx, 660);
    }
    const clothTexture = new THREE.CanvasTexture(cloth);
    clothTexture.colorSpace = THREE.SRGBColorSpace;
    const clothMaterial = new THREE.MeshStandardMaterial({
      map: clothTexture,
      roughness: 1,
    });
    materials.push(clothMaterial);
    const clothMesh = mesh(
      new THREE.PlaneGeometry(8.5, 4.9),
      clothMaterial,
      craps,
      0,
      -0.055,
      0,
    );
    clothMesh.rotation.x = -Math.PI / 2;
    // Raised rail and full-width landing zone; dice are real meshes with inset pips.
    const dice = [];
    const pipFaces = [
      [0, 1, 0],
      [0, -1, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (let d = 0; d < 2; d++) {
      const group = new THREE.Group();
      craps.add(group);
      const body = new THREE.BoxGeometry(0.6, 0.6, 0.6, 6, 6, 6);
      const pos = body.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, j),
          core = v.clone().clampScalar(-0.25, 0.25);
        v.sub(core).normalize().multiplyScalar(0.05).add(core);
        pos.setXYZ(j, v.x, v.y, v.z);
      }
      body.computeVertexNormals();
      mesh(body, ivory, group, 0, 0, 0);
      const patterns = [
        [[0, 0]],
        [
          [-1, -1],
          [1, 1],
        ],
        [
          [-1, -1],
          [0, 0],
          [1, 1],
        ],
        [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ],
        [
          [-1, -1],
          [-1, 1],
          [0, 0],
          [1, -1],
          [1, 1],
        ],
        [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ],
      ];
      pipFaces.forEach((normal, f) =>
        patterns[[0, 5, 1, 4, 2, 3][f]].forEach(([u, v]) => {
          const p = mesh(
            new THREE.SphereGeometry(0.045, 8, 8),
            black,
            group,
            0,
            0,
            0,
          );
          const n = new THREE.Vector3(...normal),
            t = new THREE.Vector3(normal[0] ? 0 : 1, 0, normal[0] ? 1 : 0),
            b = new THREE.Vector3().crossVectors(n, t);
          p.position
            .copy(n.multiplyScalar(0.298))
            .addScaledVector(t, u * 0.16)
            .addScaledVector(b, v * 0.16);
        }),
      );
      dice.push(group);
    }
    let frame,
      last = 0,
      elapsed = 0,
      round = "",
      start = 0,
      wheelFrom = 0,
      wheelTarget = 0;
    const clock = new THREE.Clock();
    let visible = true;
    const visibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", visibility);
    const observer = new ResizeObserver(() => {
      const w = root.clientWidth,
        h = root.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(root);
    function render(now) {
      frame = requestAnimationFrame(render);
      if (!visible || now - last < 32) return;
      last = now;
      elapsed = clock.getElapsedTime();
      const s = state.current;
      roulette.visible = s.game === "roulette";
      craps.visible = !roulette.visible;
      if (s.outcome?.roundId !== round) {
        round = s.outcome?.roundId;
        start = elapsed;
        wheelFrom = wheel.rotation.y;
        const n =
          s.outcome?.game === "roulette"
            ? pockets.indexOf(s.outcome.values[0])
            : 0;
        const target = (-n * Math.PI * 2) / 37;
        wheelTarget =
          wheelFrom +
          Math.PI * 10 +
          ((((target - wheelFrom) % (Math.PI * 2)) + Math.PI * 2) %
            (Math.PI * 2));
      }
      const t =
          !s.outcome || s.reduced ? 1 : Math.min(1, (elapsed - start) / 2.6),
        ease = 1 - Math.pow(1 - t, 3);
      const overhead = s.cameraView === "overhead";
      const distance =
        Math.max(
          9.8 / (2 * Math.tan((43 * Math.PI) / 360) * camera.aspect),
          (overhead ? 5.8 : 4.5) / (2 * Math.tan((43 * Math.PI) / 360)),
        ) * 1.08;
      camera.position.copy(
        new THREE.Vector3(0, 1, overhead ? 0.001 : 0.85)
          .normalize()
          .multiplyScalar(distance),
      );
      camera.lookAt(0, 0, 0);
      if (s.game === "roulette" && s.outcome) {
        wheel.rotation.y = wheelFrom + (wheelTarget - wheelFrom) * ease;
        const a = (1 - ease) * Math.PI * 14 + 0.085;
        ball.position.set(Math.sin(a) * 1.8, 0.42, Math.cos(a) * 1.8);
      }
      const rotations = [
        [0, 0, 0],
        [0, 0, Math.PI / 2],
        [-Math.PI / 2, 0, 0],
        [Math.PI / 2, 0, 0],
        [0, 0, -Math.PI / 2],
        [Math.PI, 0, 0],
      ];
      dice.forEach((die, i) => {
        const r =
          rotations[
            (s.outcome?.game === "craps" ? s.outcome.values[i] : 1) - 1
          ];
        die.position.set(
          (i ? 1 : -1) * (0.65 + (1 - ease) * 2),
          0.36 + Math.abs(Math.sin(t * Math.PI * 5)) * (1 - t) * 1.6,
          Math.sin(t * 7 + i) * (1 - t),
        );
        die.rotation.set(
          r[0] + (1 - ease) * Math.PI * 8,
          r[1],
          r[2] + (1 - ease) * Math.PI * 6,
        );
      });
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      scene.traverse((o) => {
        o.geometry?.dispose();
      });
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      root.replaceChildren();
    };
  }, []);
  return (
    <div
      ref={host}
      className="table-scene"
      role="img"
      aria-label={`3D ${game} table with ${game === "craps" ? "animated dice" : "wheel and ball"}`}
    >
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

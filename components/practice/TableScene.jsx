import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { betFromPixel, betPosition } from "./bet-layout.mjs";
import rouletteCloth from "../../unity/PracticeBridge/Assets/RouletteCloth.png";
import crapsCloth from "../../unity/PracticeBridge/Assets/CrapsCloth.png";
import { pockets, reds } from "./outcomes.mjs";
export default function TableScene({
  game,
  outcome,
  busy,
  reduced,
  cameraView,
  zoom = 1.12,
  bet,
  onBet
}) {
  const [error, setError] = useState("");
  const host = useRef(null),
    state = useRef({
      game,
      outcome,
      busy,
      reduced,
      cameraView,
      zoom,
      bet,
      onBet
    });
  state.current = {
    game,
    outcome,
    busy,
    reduced,
    cameraView,
    zoom,
    bet,
    onBet
  };
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
        powerPreference: "low-power"
      });
    } catch {
      setError("3D rendering is unavailable on this device. Try reopening the game.");
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
        metalness
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
    mesh(new THREE.BoxGeometry(10.4, 0.6, 5.4), wood, scene, 0, -0.5, 0);
    mesh(new THREE.BoxGeometry(10, 0.12, 4.95), felt, scene, 0, -0.13, 0);
    for (const z of [-2.65, 2.65]) mesh(new THREE.BoxGeometry(10.4, 0.45, 0.3), black, scene, 0, -0.05, z);
    for (const x of [-5.1, 5.1]) mesh(new THREE.BoxGeometry(0.3, 0.45, 5.4), black, scene, x, -0.05, 0);
    const roulette = new THREE.Group();
    scene.add(roulette);
    roulette.position.x = -2.5;
    mesh(new THREE.CylinderGeometry(2.15, 2.25, 0.3, 80), wood, roulette, 0, 0.12, 0);
    const wheel = new THREE.Group();
    roulette.add(wheel);
    for (let i = 0; i < 37; i++) {
      const a = i * Math.PI * 2 / 37,
        sector = mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.05, 4, 1, false, a, Math.PI * 2 / 37), pockets[i] === 0 ? felt : reds.has(pockets[i]) ? red : black, wheel, 0, 0.31, 0);
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
        m = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true
        });
      materials.push(m);
      const label = mesh(new THREE.PlaneGeometry(0.22, 0.22), m, wheel, Math.sin(a + 0.085) * 1.65, 0.35, Math.cos(a + 0.085) * 1.65);
      label.rotation.x = -Math.PI / 2;
    }
    mesh(new THREE.CylinderGeometry(1.25, 1.6, 0.22, 64), wood, wheel, 0, 0.44, 0);
    mesh(new THREE.CylinderGeometry(0.23, 0.35, 0.65, 24), gold, wheel, 0, 0.8, 0);
    const ball = mesh(new THREE.SphereGeometry(0.075, 12, 12), ivory, roulette, 0, 0.42, 1.8);
    const craps = new THREE.Group();
    scene.add(craps);
    const loader = new THREE.TextureLoader();
    function surface(url, parent, w, h, x) {
      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 1
      });
      materials.push(mat);
      const m = mesh(new THREE.PlaneGeometry(w, h), mat, parent, x, .01, 0);
      m.rotation.x = -Math.PI / 2;
      return m;
    }
    const rouletteFelt = surface(rouletteCloth, scene, 4.7, 3.4, 2.1),
      crapsFelt = surface(crapsCloth, craps, 9.6, 4.25, 0);
    const markers = new Map();
    function disposeGroup(group) {
      group.traverse(o => {
        o.geometry?.dispose();
        if (o.userData.ownedMaterial) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      scene.remove(group);
    }
    function chipStack(parent, x, z, color, count = 5, amount) {
      const g = new THREE.Group();
      parent.add(g);
      g.position.set(x, .03, z);
      for (let i = 0; i < count; i++) {
        mesh(new THREE.CylinderGeometry(.12, .12, .035, 20), color, g, 0, i * .038, 0);
      }
      if (amount !== undefined) {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff5d7';
        ctx.textAlign = 'center';
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText(String(amount), 128, 75);
        const tex = new THREE.CanvasTexture(c),
          mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthTest: false
          });
        const label = mesh(new THREE.PlaneGeometry(.7, .35), mat, g, 0, .24, 0);
        label.rotation.x = -Math.PI / 2;
        label.userData.ownedMaterial = true;
      }
      return g;
    }
    for (const [x, z] of [[-4.3, -2], [3.5, -2], [-4.3, 2], [3.5, 2]]) for (let i = 0; i < 3; i++) chipStack(scene, x + i * .33, z, [red, gold, black][i], 7 + i * 2);
    const ray = new THREE.Raycaster();
    let down;
    const pointerDown = e => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = e => {
      const s = state.current;
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 14 || s.bet.locked) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), camera);
      const hit = ray.intersectObject(s.game === 'roulette' ? rouletteFelt : crapsFelt)[0];
      if (hit) {
        const selection = betFromPixel(s.game, hit.uv.x * 2048, (1 - hit.uv.y) * 1024);
        if (selection !== null) s.onBet(selection);
      }
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    // Raised rail and full-width landing zone; dice are real meshes with inset pips.
    const dice = [];
    const pipFaces = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
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
      const patterns = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [-1, 1], [1, -1], [1, 1]], [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]], [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]];
      pipFaces.forEach((normal, f) => patterns[[0, 5, 1, 4, 2, 3][f]].forEach(([u, v]) => {
        const p = mesh(new THREE.SphereGeometry(0.045, 8, 8), black, group, 0, 0, 0);
        const n = new THREE.Vector3(...normal),
          t = new THREE.Vector3(normal[0] ? 0 : 1, 0, normal[0] ? 1 : 0),
          b = new THREE.Vector3().crossVectors(n, t);
        p.position.copy(n.multiplyScalar(0.298)).addScaledVector(t, u * 0.16).addScaledVector(b, v * 0.16);
      }));
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
    let layoutKey = "";
    function render(now) {
      frame = requestAnimationFrame(render);
      if (!visible || now - last < 32) return;
      last = now;
      elapsed = clock.getElapsedTime();
      const s = state.current;
      roulette.visible = s.game === "roulette";
      craps.visible = !roulette.visible;
      rouletteFelt.visible = roulette.visible;
      const keep = new Set();
      for (const b of s.bet.placements) {
        const key = s.game + ':' + b.selection;
        keep.add(key);
        if (markers.get(key)?.userData.amount !== b.amount) {
          if (markers.has(key)) disposeGroup(markers.get(key));
          const p = betPosition(s.game, b.selection),
            g = chipStack(scene, p.x, -p.z, red, 4, b.amount);
          g.userData.amount = b.amount;
          g.userData.placed = elapsed;
          markers.set(key, g);
        }
      }
      for (const [key, g] of markers) {
        if (!keep.has(key)) {
          disposeGroup(g);
          markers.delete(key);
        } else if (!s.reduced) {
          const t = Math.min(1, (elapsed - g.userData.placed) / .45);
          g.position.y = .03 + Math.sin(t * Math.PI) * .6;
        }
      }
      if (s.outcome?.roundId !== round) {
        round = s.outcome?.roundId;
        start = elapsed;
        wheelFrom = wheel.rotation.y;
        const n = s.outcome?.game === "roulette" ? pockets.indexOf(s.outcome.values[0]) : 0;
        const target = -n * Math.PI * 2 / 37;
        wheelTarget = wheelFrom + Math.PI * 10 + ((target - wheelFrom) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      }
      const t = !s.outcome || s.reduced ? 1 : Math.min(1, Math.max(0, elapsed - start - .45) / 4.6),
        ease = 1 - Math.pow(1 - t, 3);
      const overhead = s.cameraView === "overhead";
      const distance = Math.max(10.8 / (2 * Math.tan(43 * Math.PI / 360) * camera.aspect), (overhead ? 5.8 : 4.5) / (2 * Math.tan(43 * Math.PI / 360))) * 1.02 / s.zoom;
      camera.position.copy(new THREE.Vector3(0, 1, overhead ? 0.001 : 0.85).normalize().multiplyScalar(distance));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const key = [s.game, s.cameraView, s.zoom, camera.aspect].join(':');
      if (key !== layoutKey) {
        layoutKey = key;
        const names = s.game === 'craps' ? ['pass'] : [...Array.from({
          length: 37
        }, (_, n) => String(n)), 'red', 'black', 'even', 'odd'];
        window.postMessage({
          channel: 'imperial-practice-event',
          type: 'layout',
          game: s.game,
          spots: names.map(selection => {
            const p = betPosition(s.game, selection),
              v = new THREE.Vector3(p.x, .01, -p.z).project(camera);
            return {
              selection,
              x: (v.x + 1) / 2,
              y: (v.y + 1) / 2
            };
          })
        }, location.origin);
      }
      if (s.game === "roulette" && s.outcome) {
        wheel.rotation.y = wheelFrom + (wheelTarget - wheelFrom) * ease;
        const a = (1 - ease) * Math.PI * 14 + 0.085;
        ball.position.set(Math.sin(a) * 1.8, 0.42, Math.cos(a) * 1.8);
      }
      const rotations = [[0, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]];
      dice.forEach((die, i) => {
        const r = rotations[(s.outcome?.game === "craps" ? s.outcome.values[i] : 1) - 1];
        die.position.set((i ? 1 : -1) * (0.65 + (1 - ease) * 2), 0.36 + Math.abs(Math.sin(t * Math.PI * 5)) * (1 - t) * 1.6, Math.sin(t * 7 + i) * (1 - t));
        die.rotation.set(r[0] + (1 - ease) * Math.PI * 8, r[1], r[2] + (1 - ease) * Math.PI * 6);
      });
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      document.removeEventListener("visibilitychange", visibility);
      scene.traverse(o => {
        o.geometry?.dispose();
      });
      materials.forEach(m => {
        m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
      root.replaceChildren();
    };
  }, []);
  return <div ref={host} className="table-scene" role="img" aria-label={`3D ${game} table with ${game === "craps" ? "animated dice" : "wheel and ball"}`}>
      {error && <p role="alert">{error}</p>}
    </div>;
}

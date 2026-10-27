import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CAPACITIES = new Set([2, 4, 6, 8, 9]);
function disposeModel(model) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  model?.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  geometries.forEach(value => value.dispose());
}

// onAnchors receives [{name, seatIndex, x, y}], x/y in normalized 0..100
// container percentages. Fallback emits []: PNG seat coordinates are not invented.
export default function ApprovedPokerTableScene({ capacity, onAnchors, className = '' }) {
  const hostRef = useRef(null), callbackRef = useRef(onAnchors);
  const [state, setState] = useState({ capacity, value: 'loading' });
  callbackRef.current = onAnchors;
  const supported = CAPACITIES.has(capacity);
  const renderState = !supported ? 'unsupported' : state.capacity === capacity ? state.value : 'loading';
  useEffect(() => {
    const host = hostRef.current;
    callbackRef.current?.([]);
    if (!supported || !host) return undefined;
    let stopped = false, failed = false, renderer, model, observer;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    const anchors = [];
    const fail = () => {
      if (stopped || failed) return;
      failed = true;
      setState({ capacity, value: 'fallback' });
      callbackRef.current?.([]);
    };
    const contextLost = event => { event.preventDefault(); fail(); };
    const draw = () => {
      if (stopped || failed || !model) return;
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      try {
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) throw new Error('Empty approved model');
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const aspect = width / height;
        const halfHeight = Math.max(size.z / 2, size.x / (2 * aspect), 0.01) * 1.12;
        camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
        camera.top = halfHeight; camera.bottom = -halfHeight;
        camera.up.set(0, 0, -1);
        camera.position.set(center.x, box.max.y + Math.max(size.length(), 1) * 2, center.z);
        camera.lookAt(center); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
        const projected = anchors.map((node, seatIndex) => {
          const point = node.getWorldPosition(new THREE.Vector3()).project(camera);
          return { name: node.name, seatIndex, x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
        });
        if (projected.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid anchor projection');
        setState({ capacity, value: 'ready' });
        callbackRef.current?.(projected);
      } catch { fail(); }
    };
    setState({ capacity, value: 'loading' });
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      host.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2));
      const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(2, 6, 3); scene.add(light);
      observer = new ResizeObserver(draw); observer.observe(host);
      new GLTFLoader().load(`/poker-tables/NLHE_${capacity}.glb`, gltf => {
        if (stopped || failed) { disposeModel(gltf.scene); return; }
        model = gltf.scene;
        for (let i = 0; i < capacity; i++) {
          const node = model.getObjectByName(`Seat_${String(i).padStart(2, '0')}`);
          if (!node) { disposeModel(model); model = null; fail(); return; }
          anchors.push(node);
        }
        scene.add(model); model.updateMatrixWorld(true); draw();
      }, undefined, fail);
    } catch { fail(); }
    return () => {
      stopped = true; observer?.disconnect();
      renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
      disposeModel(model); scene.clear();
      renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    };
  }, [capacity, supported]);
  return <div className={className} data-renderstate={renderState} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
    {supported && renderState !== 'ready' && <img src={`/poker-tables/NLHE_${capacity}.png`} alt={`Approved ${capacity}-seat poker table`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, visibility: renderState === 'ready' ? 'visible' : 'hidden' }} />
  </div>;
}

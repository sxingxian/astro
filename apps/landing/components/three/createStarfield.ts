import { BufferGeometry, Float32BufferAttribute, PerspectiveCamera, Points, PointsMaterial, Scene, WebGLRenderer } from "three";

export interface Starfield {
  start(): void;
  stop(): void;
  resize(): void;
  dispose(): void;
}

const ROTATION_PER_SECOND = 0.02;
const PARALLAX = 0.05;
const MAX_DPR = 1.5;

export function createStarfield(canvas: HTMLCanvasElement, opts: { count: number; reducedMotion: boolean }): Starfield {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 5;

  const positions = new Float32Array(opts.count * 3);
  for (let i = 0; i < opts.count; i++) {
    // Points on a thick shell so the field has depth.
    const r = 6 + Math.random() * 14;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: 0xede6d6, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  const points = new Points(geometry, material);
  scene.add(points);

  let frame = 0;
  let last = 0;
  let pointerX = 0;
  let pointerY = 0;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const onPointer = (e: PointerEvent) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (finePointer && !opts.reducedMotion) window.addEventListener("pointermove", onPointer, { passive: true });

  const render = (now: number) => {
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (!opts.reducedMotion) {
      points.rotation.y += ROTATION_PER_SECOND * dt;
      points.rotation.x += (pointerY * PARALLAX - points.rotation.x) * 0.05;
      scene.rotation.y += (pointerX * PARALLAX - scene.rotation.y) * 0.05;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };

  return {
    start() {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(render);
      }
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
    resize() {
      const { clientWidth: w, clientHeight: h } = canvas;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("pointermove", onPointer);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    }
  };
}

"use client";

import { useEffect, useRef } from "react";

interface Layer {
  geo: import("three").BufferGeometry;
  pts: import("three").Points;
  pos: Float32Array;
  count: number;
  speed: number;
}

const DEPTH  = 600;
const NEAR   =  12;
const SPREAD = { x: 800, y: 1000 };

export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf: number;
    let cleanup: (() => void) | undefined;

    import("three").then((THREE) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, DEPTH + 50);
      camera.position.set(0, 0, 0);

      function makeLayer(count: number, size: number, opacity: number, speed: number): Layer {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          pos[i * 3]     = (Math.random() - 0.5) * SPREAD.x;
          pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
          pos[i * 3 + 2] = -Math.random() * DEPTH;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          size, color: new THREE.Color(0xfff6e8),
          transparent: true, opacity, sizeAttenuation: true, depthWrite: false,
        });
        const pts = new THREE.Points(geo, mat);
        scene.add(pts);
        return { geo, pts, pos, count, speed };
      }

      const mobile = innerWidth < 600;
      const layers: Layer[] = [
        makeLayer(mobile ? 500 : 2200, 0.45, 0.50, 0.08),
        makeLayer(mobile ? 160 : 700,  1.00, 0.72, 0.20),
        makeLayer(mobile ? 45  : 180,  2.20, 0.92, 0.42),
      ];

      let tx = 0, ty = 0, cx = 0, cy = 0;

      const onMouse = (e: MouseEvent) => {
        tx = (e.clientX / innerWidth  - 0.5) * 2;
        ty = (e.clientY / innerHeight - 0.5) * 2;
      };
      const onTouch = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        tx = (t.clientX / innerWidth  - 0.5) * 2;
        ty = (t.clientY / innerHeight - 0.5) * 2;
      };
      const onScroll = (e: Event) => {
        const el = e.target as HTMLElement;
        if (typeof el?.scrollTop === "number") {
          ty += el.scrollTop * 0.0005;
          ty = Math.max(-1, Math.min(1, ty));
        }
      };
      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };

      window.addEventListener("mousemove", onMouse,  { passive: true });
      window.addEventListener("touchmove", onTouch,  { passive: true });
      window.addEventListener("scroll",    onScroll, { passive: true, capture: true });
      window.addEventListener("resize",    onResize);

      const animate = () => {
        raf = requestAnimationFrame(animate);
        cx += (tx - cx) * 0.035;
        cy += (ty - cy) * 0.035;
        camera.position.x =  cx * 10;
        camera.position.y = -cy *  6;
        for (const layer of layers) {
          const p = layer.pos;
          for (let i = 0; i < layer.count; i++) {
            p[i * 3 + 2] += layer.speed;
            if (p[i * 3 + 2] > NEAR) {
              p[i * 3]     = (Math.random() - 0.5) * SPREAD.x;
              p[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
              p[i * 3 + 2] = -DEPTH;
            }
          }
          layer.geo.attributes.position.needsUpdate = true;
        }
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("mousemove", onMouse);
        window.removeEventListener("touchmove", onTouch);
        window.removeEventListener("scroll",    onScroll, true);
        window.removeEventListener("resize",    onResize);
        for (const l of layers) {
          l.geo.dispose();
          (l.pts.material as { dispose(): void }).dispose();
        }
        renderer.dispose();
      };
    });

    return () => cleanup?.();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        display: "block",
      }}
    />
  );
}

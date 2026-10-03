"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type RiskSystem = "circulatory" | "gastrointestinal" | "neurological" | "renal";
type AtlasSystem = "skeletal" | "muscular" | "arterial" | "venous" | "nervous" | "digestive" | "respiratory" | "urinary" | "reproductive" | "lymphatic" | "endocrine" | "integumentary" | "connective" | "sensory" | "cardiac";

interface AtlasPart {
  id: string; name: string; system: AtlasSystem; chunk: number;
  positions: number; normals: number; indices: number; vertexCount: number; indexCount: number;
}
interface AtlasManifest {
  version: string; parts: AtlasPart[]; chunks: { bytes: number; gzip?: string }[]; triangles: number;
}

const ATLAS_COLORS: Record<AtlasSystem, string> = {
  skeletal: "#e2d9ba", muscular: "#a85b50", cardiac: "#b96760", sensory: "#b0c8ce",
  arterial: "#c05245", venous: "#527c9f", nervous: "#d8b565", respiratory: "#b98991",
  digestive: "#b8916b", urinary: "#b47961", lymphatic: "#879f7c", endocrine: "#c5a09a",
  reproductive: "#bda098", integumentary: "#ba9b7d", connective: "#aec3bb",
};
const RISK_SYSTEMS: { id: RiskSystem; label: string; detail: string; atlas: AtlasSystem[]; color: string }[] = [
  { id: "circulatory", label: "Circulatory", detail: "heart, arteries and veins", atlas: ["cardiac", "arterial", "venous"], color: "#ef6b66" },
  { id: "gastrointestinal", label: "GI", detail: "digestive structures", atlas: ["digestive"], color: "#d7a066" },
  { id: "neurological", label: "Neurological", detail: "brain, spinal cord and nerves", atlas: ["nervous"], color: "#d8b565" },
  { id: "renal", label: "Renal", detail: "kidneys and urinary tract", atlas: ["urinary"], color: "#6eb5d4" },
];

async function decodeChunk(response: Response, expectedBytes: number): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error("An anatomy file could not be loaded.");
  const payload = await response.arrayBuffer();
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const isGzip = signature[0] === 0x1f && signature[1] === 0x8b;
  const buffer = isGzip
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : payload;
  if (buffer.byteLength !== expectedBytes) throw new Error("An anatomy file was incomplete. Please reload the viewer.");
  return buffer;
}

export function ClinicalBodyAtlas3D({ findingTitle, compact = false, embedded = false }: { findingTitle?: string; compact?: boolean; embedded?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const systemRef = useRef<RiskSystem>("circulatory");
  const pausedRef = useRef(false);
  const [system, setSystem] = useState<RiskSystem>("circulatory");
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [structureCount, setStructureCount] = useState(2234);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { systemRef.current = system; }, [system]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let frame = 0;
    const abort = new AbortController();
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
    catch { queueMicrotask(() => setError("WebGL is unavailable in this browser.")); return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x07111e);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Interactive adult reference anatomy. Drag to orbit and scroll to zoom.");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07111e, 0.05);
    const camera = new THREE.PerspectiveCamera(33, 1, 0.005, 100);
    camera.position.set(0, 0, 3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.075; controls.minDistance = 1.4; controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.96; controls.autoRotateSpeed = 0.65;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xc8fff7, 0x111827, 1.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(-2, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x67e8f9, 1.2); rim.position.set(2, 2, -3); scene.add(rim);


    const materials = new Map<AtlasSystem, THREE.MeshStandardMaterial>();
    const meshes: THREE.Mesh[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const anatomy = new THREE.Group();
    scene.add(anatomy);
    let atlasReady = false;
    Object.keys(ATLAS_COLORS).forEach((value) => {
      const name = value as AtlasSystem;
      materials.set(name, new THREE.MeshStandardMaterial({ color: ATLAS_COLORS[name], metalness: 0.05, roughness: 0.5, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    });

    let lastRiskSystem: RiskSystem | null = null;
    function updateMaterials() {
      const active = new Set(RISK_SYSTEMS.find((item) => item.id === systemRef.current)?.atlas ?? []);
      for (const [name, material] of materials) {
        const selected = active.has(name);
        material.opacity = selected ? 1 : name === "skeletal" || name === "muscular" ? 0.16 : 0.11;
        material.emissive.set(selected ? ATLAS_COLORS[name] : "#000000");
        material.emissiveIntensity = selected ? 0.22 : 0;
        material.depthWrite = selected;
        material.needsUpdate = true;
      }
      lastRiskSystem = systemRef.current;
    }

    function fitAnatomy() {
      if (!atlasReady || !meshes.length) return;
      const bounds = new THREE.Box3().setFromObject(anatomy);
      const center = bounds.getCenter(new THREE.Vector3());
      anatomy.position.set(-center.x, -center.y, -center.z);
      const fitted = new THREE.Box3().setFromObject(anatomy);
      const size = fitted.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.1);
      const width = Math.max(size.x, 0.1);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.01));
      const verticalDistance = (height / 2) / Math.tan(verticalFov / 2);
      const horizontalDistance = (width / 2) / Math.tan(horizontalFov / 2);
      const distance = Math.max(verticalDistance, horizontalDistance, size.z / 2) * 1.1;
      camera.position.set(0, 0, Math.max(1.4, distance));
      controls.target.set(0, 0, 0);
      controls.update();
    }

    (async () => {
      try {
        const atlasResponse = await fetch("/anatomy/atlas.json", { signal: abort.signal });
        if (!atlasResponse.ok) throw new Error("The anatomical manifest could not be loaded.");
        const atlas = await atlasResponse.json() as AtlasManifest;
        if (disposed) return;
        setStructureCount(atlas.parts.length);
        let cursor = 0;
        let loaded = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (cursor < atlas.chunks.length) {
            const chunkIndex = cursor++;
            const chunk = atlas.chunks[chunkIndex];
            const response = await fetch(`/anatomy/body-${chunkIndex}.bin.gz`, { signal: abort.signal });
            const buffer = await decodeChunk(response, chunk.bytes);
            if (disposed) return;
            const grouped = new Map<AtlasSystem, THREE.BufferGeometry[]>();
            atlas.parts.forEach((part) => {
              if (part.chunk !== chunkIndex) return;
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3));
              geometry.setAttribute("normal", new THREE.BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true));
              geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1));
              grouped.set(part.system, [...(grouped.get(part.system) ?? []), geometry]);
            });
            grouped.forEach((parts, atlasSystem) => {
              const merged = mergeGeometries(parts, false);
              parts.forEach((part) => part.dispose());
              if (!merged) return;
              geometries.push(merged);
              const mesh = new THREE.Mesh(merged, materials.get(atlasSystem));
              mesh.userData.atlasSystem = atlasSystem; mesh.frustumCulled = false; meshes.push(mesh); anatomy.add(mesh);
            });
            loaded++; setProgress(Math.round((loaded / atlas.chunks.length) * 100));
          }
        }));
        atlasReady = true;
        setProgress(100);
        fitAnatomy(); updateMaterials();
      } catch (reason) {
        if (!disposed && !(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "The anatomy could not be loaded.");
      }
    })();

    const sourceToRisk = (atlasSystem: AtlasSystem): RiskSystem | undefined => RISK_SYSTEMS.find((item) => item.atlas.includes(atlasSystem))?.id;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const onUp = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object as THREE.Mesh | undefined;
      const risk = hit ? sourceToRisk(hit.userData.atlasSystem as AtlasSystem) : undefined;
      if (risk) setSystem(risk);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const width = Math.max(1, el.clientWidth);
      const height = Math.max(1, el.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitAnatomy();
    };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (lastRiskSystem !== systemRef.current) updateMaterials();
      controls.autoRotate = !pausedRef.current;
      controls.update(); renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
      environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const selected = RISK_SYSTEMS.find((item) => item.id === system)!;
  return <div className={`overflow-hidden bg-[#07111e] text-white ${embedded ? "" : "border border-slate-800 shadow-[0_24px_80px_rgba(2,8,23,.22)]"}`}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-teal-300">Anatomy</p><h2 className="mt-1 text-base font-semibold">Anatomy</h2></div><div className="text-right"><span className="block text-[9px] uppercase tracking-[.12em] text-emerald-300">{progress < 100 ? `${progress}% loading` : `${structureCount.toLocaleString()} structures`}</span><button type="button" onClick={() => setPaused((value) => !value)} className="mt-1 text-[9px] text-slate-400 hover:text-white">{paused ? "Resume rotation" : "Pause rotation"}</button></div></div>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-800 p-2">{RISK_SYSTEMS.map((item) => <button type="button" key={item.id} onClick={() => setSystem(item.id)} className={`shrink-0 border-b-2 px-2 py-2 text-[10px] font-medium transition ${system === item.id ? "border-teal-300 bg-white/10 text-white" : "border-transparent text-slate-400 hover:bg-white/5"}`}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</button>)}</div>
    <div className={`relative ${compact ? "min-h-[520px]" : "min-h-[600px]"}`}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      {progress < 100 && !error && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#07111e]/80"><div className="text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-300"/><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Loading reference anatomy</p></div></div>}
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center"><div><p className="text-sm font-semibold text-red-300">Anatomy unavailable</p><p className="mt-2 text-xs leading-5 text-slate-400">{error}</p></div></div>}
    </div>
    <div className="flex min-w-0 items-center justify-between gap-3 border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500"><span className="min-w-0 truncate text-left">Drag to orbit · scroll to zoom · select a highlighted system</span><a href="/about#credits" className="shrink-0 text-teal-300 underline-offset-2 hover:underline">Anatomy credits</a></div>
    <div className="border-t border-slate-800 p-4"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: selected.color }}/><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">{selected.label} context</p></div><p className="mt-2 text-xs leading-5 text-slate-300">{findingTitle ?? selected.detail}</p><div className="mt-3 border-l-2 border-amber-400 bg-amber-400/10 p-3 text-[10px] leading-4 text-amber-100">Associated medication-warning context only. This is reference anatomy, not a patient-specific model or diagnosis.</div></div>
  </div>;
}

import * as THREE from "three";
import type { TimeOfDayDef } from "../config/timeofday";

export type Box = { x: number; z: number; halfX: number; halfZ: number };
export type Ramp = {
  x: number;
  z: number;
  /** unit direction the ramp rises toward */
  dx: number;
  dz: number;
  length: number;
  halfW: number;
  height: number;
};

/** A straight road strip running along one axis. */
export type RoadLine = { axis: "x" | "z"; pos: number; half: number };

export type WorldRefs = {
  buildings: Box[];
  ramps: Ramp[];
  sand: Box[];
  /** Straight roads (traffic lanes + player surface query). */
  roads: RoadLine[];
  /** Outer circular ring road. */
  ring: { radius: number; half: number };
  /** Island radius — everything is clamped inside this circle. */
  radius: number;
  /** Dedicated stunt park (ramps / barriers live only here). */
  stuntZone: { x: number; z: number; radius: number };
  applyTimeOfDay: (t: TimeOfDayDef) => void;
};

/** Island radius. */
export const WORLD_RADIUS = 380;
/** Ring road (outer loop). */
export const RING_RADIUS = 300;
export const RING_HALF = 14;
/** Stunt park centre. */
export const STUNT = { x: -160, z: 150, radius: 92 };
/** Secondary island and bridge for the expanded open world. */
const SECOND_ISLAND = { x: 285, z: 240, radius: 86 };
const BRIDGE = { x: 160, z: 205, length: 150, width: 16, angle: -0.55 };

/** Straight roads. The two centre ones are the wide high-speed highways. */
export const ROADS: RoadLine[] = [
  { axis: "z", pos: 0, half: 22 }, // main speedway (runs along X)
  { axis: "x", pos: 0, half: 18 }, // cross speedway (runs along Z)
  { axis: "z", pos: 90, half: 12 },
  { axis: "z", pos: -90, half: 12 },
  { axis: "z", pos: 175, half: 12 },
  { axis: "z", pos: -175, half: 12 },
  { axis: "x", pos: 90, half: 12 },
  { axis: "x", pos: -90, half: 12 },
  { axis: "x", pos: 175, half: 12 },
  { axis: "x", pos: -175, half: 12 },
  { axis: "z", pos: 140, half: 18 },
  { axis: "x", pos: 145, half: 18 },
];

/** Half-length of a straight road inside the island circle. */
export function roadExtent(pos: number, radius = WORLD_RADIUS - 6): number {
  const v = radius * radius - pos * pos;
  return v > 0 ? Math.sqrt(v) : 0;
}

export function isOnRoadAt(x: number, z: number): boolean {
  for (const r of ROADS) {
    if (r.axis === "z") {
      if (Math.abs(z - r.pos) <= r.half && Math.abs(x) <= roadExtent(r.pos)) return true;
    } else if (Math.abs(x - r.pos) <= r.half && Math.abs(z) <= roadExtent(r.pos)) return true;
  }
  const d = Math.hypot(x, z);
  if (Math.abs(d - RING_RADIUS) <= RING_HALF) return true;
  // stunt park is a big paved pad
  if (Math.hypot(x - STUNT.x, z - STUNT.z) <= STUNT.radius) return true;
  const dx = x - BRIDGE.x;
  const dz = z - BRIDGE.z;
  const cos = Math.cos(BRIDGE.angle);
  const sin = Math.sin(BRIDGE.angle);
  const lx = cos * dx + sin * dz;
  const lz = -sin * dx + cos * dz;
  if (Math.abs(lx) <= BRIDGE.length / 2 && Math.abs(lz) <= BRIDGE.width / 2) return true;
  if (Math.hypot(x - SECOND_ISLAND.x, z - SECOND_ISLAND.z) <= SECOND_ISLAND.radius) return true;
  return false;
}

/**
 * Builds a fixed circular low-poly island: grass ground, wide high-speed
 * highways, an outer ring road, city blocks, a dedicated stunt park (the only
 * place with ramps and barriers), roadside trees and a beach rim.
 */
export function buildWorld(scene: THREE.Scene, t: TimeOfDayDef): WorldRefs {
  const buildings: Box[] = [];
  const ramps: Ramp[] = [];
  const sand: Box[] = [];

  // ---- Ground (circular island) ----
  const groundMat = new THREE.MeshToonMaterial({ color: t.ground });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD_RADIUS, 96), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Beach rim + surrounding water
  const sandMat = new THREE.MeshToonMaterial({ color: 0xf2d493 });
  const beach = new THREE.Mesh(new THREE.RingGeometry(WORLD_RADIUS - 16, WORLD_RADIUS + 6, 96), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.y = 0.006;
  scene.add(beach);
  const waterMat = new THREE.MeshToonMaterial({ color: 0x4aa8d8 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(WORLD_RADIUS + 220, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.4;
  scene.add(water);

  const extraIsland = new THREE.Mesh(new THREE.CircleGeometry(SECOND_ISLAND.radius, 96), groundMat);
  extraIsland.rotation.x = -Math.PI / 2;
  extraIsland.position.set(SECOND_ISLAND.x, 0.01, SECOND_ISLAND.z);
  scene.add(extraIsland);
  const extraBeach = new THREE.Mesh(new THREE.RingGeometry(SECOND_ISLAND.radius - 12, SECOND_ISLAND.radius + 6, 96), sandMat);
  extraBeach.rotation.x = -Math.PI / 2;
  extraBeach.position.set(SECOND_ISLAND.x, 0.012, SECOND_ISLAND.z);
  scene.add(extraBeach);

  const bridgeMat = new THREE.MeshToonMaterial({ color: 0x6a7282 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.length, 0.28, BRIDGE.width), bridgeMat);
  bridge.position.set(BRIDGE.x, 0.16, BRIDGE.z);
  bridge.rotation.y = BRIDGE.angle;
  scene.add(bridge);
  const bridgeRail = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.length, 0.14, 0.7), new THREE.MeshToonMaterial({ color: 0xf4f4f5 }));
  bridgeRail.position.set(BRIDGE.x, 0.34, BRIDGE.z);
  bridgeRail.rotation.y = BRIDGE.angle;
  scene.add(bridgeRail);

  // ---- Roads ----
  const roadMat = new THREE.MeshToonMaterial({ color: t.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });

  for (const r of ROADS) {
    const ext = roadExtent(r.pos);
    if (ext <= 0) continue;
    const geo = new THREE.PlaneGeometry(
      r.axis === "z" ? ext * 2 : r.half * 2,
      r.axis === "z" ? r.half * 2 : ext * 2,
    );
    const mesh = new THREE.Mesh(geo, roadMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(r.axis === "z" ? 0 : r.pos, 0.01, r.axis === "z" ? r.pos : 0);
    scene.add(mesh);
    // dashed centre line
    for (let d = -ext + 5; d < ext; d += 10) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(r.axis === "z" ? 4 : 0.35, r.axis === "z" ? 0.35 : 4),
        lineMat,
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(r.axis === "z" ? d : r.pos, 0.02, r.axis === "z" ? r.pos : d);
      scene.add(dash);
    }
  }

  // Outer ring road
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(RING_RADIUS - RING_HALF, RING_RADIUS + RING_HALF, 96),
    roadMat,
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.011;
  scene.add(ringMesh);

  // ---- Stunt park pad (only ramps + barriers area) ----
  const padMat = new THREE.MeshToonMaterial({ color: t.road });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(STUNT.radius, 48), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(STUNT.x, 0.012, STUNT.z);
  scene.add(pad);
  const padRim = new THREE.Mesh(
    new THREE.RingGeometry(STUNT.radius - 2, STUNT.radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffcf3f }),
  );
  padRim.rotation.x = -Math.PI / 2;
  padRim.position.set(STUNT.x, 0.03, STUNT.z);
  scene.add(padRim);

  // Ramps — all inside the stunt park
  const rampMat = new THREE.MeshToonMaterial({ color: 0xff9f45 });
  const rampDefs: Ramp[] = [
    { x: STUNT.x - 34, z: STUNT.z, dx: 1, dz: 0, length: 14, halfW: 6, height: 4.2 },
    { x: STUNT.x + 34, z: STUNT.z, dx: -1, dz: 0, length: 14, halfW: 6, height: 4.2 },
    { x: STUNT.x, z: STUNT.z - 34, dx: 0, dz: 1, length: 13, halfW: 5.5, height: 3.6 },
    { x: STUNT.x, z: STUNT.z + 34, dx: 0, dz: -1, length: 13, halfW: 5.5, height: 3.6 },
  ];
  for (const r of rampDefs) {
    ramps.push(r);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(r.length, 0);
    shape.lineTo(r.length, r.height);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: r.halfW * 2, bevelEnabled: false });
    geo.translate(0, 0, -r.halfW);
    const mesh = new THREE.Mesh(geo, rampMat);
    mesh.rotation.y = Math.atan2(r.dx, r.dz) - Math.PI / 2;
    mesh.position.set(r.x, 0, r.z);
    scene.add(mesh);
  }

  // Stunt barriers (decorative blocks) — only inside the park, off the driving lines
  const barrierMat = new THREE.MeshToonMaterial({ color: 0xff5a5f });
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.31;
    const rad = STUNT.radius - 12;
    const bx = STUNT.x + Math.cos(ang) * rad;
    const bz = STUNT.z + Math.sin(ang) * rad;
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 1.2), barrierMat);
    b.position.set(bx, 0.6, bz);
    b.rotation.y = -ang;
    scene.add(b);
  }

  // ---- Buildings in city blocks (never on roads, never in the stunt park) ----
  const buildingMats = [
    new THREE.MeshToonMaterial({ color: t.building }),
    new THREE.MeshToonMaterial({ color: t.buildingAlt }),
  ];
  const winMat = new THREE.MeshBasicMaterial({ color: t.night ? 0xffe08a : 0x2b3550 });

  const blocked = (x: number, z: number, pad2 = 12) => {
    for (const r of ROADS) {
      const v = r.axis === "z" ? Math.abs(z - r.pos) : Math.abs(x - r.pos);
      if (v <= r.half + pad2) return true;
    }
    const d = Math.hypot(x, z);
    if (Math.abs(d - RING_RADIUS) <= RING_HALF + pad2) return true;
    if (d > RING_RADIUS - 10) return true;
    if (Math.hypot(x - STUNT.x, z - STUNT.z) < STUNT.radius + 16) return true;
    return false;
  };

  let placed = 0;
  for (let i = 0; i < 900 && placed < 90; i++) {
    const x = (Math.random() * 2 - 1) * (RING_RADIUS - 20);
    const z = (Math.random() * 2 - 1) * (RING_RADIUS - 20);
    if (blocked(x, z)) continue;
    const w = 9 + Math.random() * 12;
    const d = 9 + Math.random() * 12;
    if (blocked(x, z, Math.max(w, d) / 2 + 6)) continue;
    const h = 10 + Math.random() * 36;
    const mat = buildingMats[Math.floor(Math.random() * buildingMats.length)];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    for (const [fw, fd, oxx, ozz] of [
      [w * 0.7, 0.4, 0, d / 2 + 0.05],
      [0.4, d * 0.7, w / 2 + 0.05, 0],
    ] as const) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(fw, h * 0.7, fd), winMat);
      win.position.set(x + oxx, h / 2, z + ozz);
      scene.add(win);
    }
    buildings.push({ x, z, halfX: w / 2, halfZ: d / 2 });
    placed++;
  }

  // ---- Off-road sand patches (never on a road) ----
  const patches: Box[] = [
    { x: 140, z: -150, halfX: 40, halfZ: 30 },
    { x: -160, z: -120, halfX: 34, halfZ: 34 },
  ];
  for (const p of patches) {
    sand.push(p);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.halfX * 2, p.halfZ * 2), sandMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.005, p.z);
    scene.add(m);
  }

  // ---- Roadside trees (always beside a road, never on the driving surface) ----
  const trunkMat = new THREE.MeshToonMaterial({ color: 0x6b4a2b });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x3f9e57 });
  const addTree = (x: number, z: number) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2, 6), trunkMat);
    trunk.position.y = 1;
    g.add(trunk);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(2, 4.4, 7), leafMat);
    leaf.position.y = 4.2;
    g.add(leaf);
    g.position.set(x, 0, z);
    scene.add(g);
  };
  for (const r of ROADS) {
    const ext = roadExtent(r.pos) - 12;
    const offset = r.half + 5;
    for (let d = -ext; d <= ext; d += 26) {
      for (const s of [-1, 1] as const) {
        const x = r.axis === "z" ? d : r.pos + s * offset;
        const z = r.axis === "z" ? r.pos + s * offset : d;
        if (isOnRoadAt(x, z)) continue;
        if (Math.hypot(x - STUNT.x, z - STUNT.z) < STUNT.radius + 6) continue;
        if (Math.hypot(x, z) > WORLD_RADIUS - 22) continue;
        addTree(x, z);
      }
    }
  }

  const applyTimeOfDay = (nt: TimeOfDayDef) => {
    groundMat.color.set(nt.ground);
    roadMat.color.set(nt.road);
    padMat.color.set(nt.road);
    buildingMats[0].color.set(nt.building);
    buildingMats[1].color.set(nt.buildingAlt);
    winMat.color.set(nt.night ? 0xffe08a : 0x2b3550);
  };

  return {
    buildings,
    ramps,
    sand,
    roads: ROADS,
    ring: { radius: RING_RADIUS, half: RING_HALF },
    radius: WORLD_RADIUS,
    stuntZone: STUNT,
    applyTimeOfDay,
  };
}

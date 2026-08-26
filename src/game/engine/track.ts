import * as THREE from "three";
import type { TimeOfDayDef } from "../config/timeofday";
import type { WorldRefs, Box } from "./world";

/** NASCAR-style oval: long straights along X, banked turns at each end. */
export const TRACK = { ax: 215, az: 130, half: 22 };
/** Everything (car + rivals) is clamped inside this circle. */
export const TRACK_RADIUS = 340;

/** Maximum rise of the outside edge in the middle of a corner (metres). */
export const BANK_MAX = 7.5;

const SEGS = 240;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * How "corner-like" a given angle is. 0 on the straights, 1 in the middle of a
 * turn, with a long smooth transition so entry/exit never steps.
 */
export function cornerFactor(theta: number) {
  return smoothstep(0.28, 0.82, Math.abs(Math.cos(theta)));
}

/**
 * Surface height for a point on the track: flat on the straights, rising
 * toward the outside edge through the corners (real superspeedway banking).
 */
export function bankHeight(theta: number, lat: number) {
  const u = Math.max(0, Math.min(1, (lat + TRACK.half) / (TRACK.half * 2)));
  return cornerFactor(theta) * BANK_MAX * Math.pow(u, 1.4);
}

/** Centre-line point + outward normal for a given angle. */
export function ovalPoint(theta: number, lat = 0) {
  const cx = Math.cos(theta) * TRACK.ax;
  const cz = Math.sin(theta) * TRACK.az;
  let nx = Math.cos(theta) / TRACK.ax;
  let nz = Math.sin(theta) / TRACK.az;
  const n = Math.hypot(nx, nz) || 1;
  nx /= n;
  nz /= n;
  // tangent (direction of travel: anti-clockwise as seen from above)
  let tx = Math.sin(theta) * TRACK.ax;
  let tz = -Math.cos(theta) * TRACK.az;
  const tl = Math.hypot(tx, tz) || 1;
  tx /= tl;
  tz /= tl;
  return {
    x: cx + nx * lat,
    z: cz + nz * lat,
    y: bankHeight(theta, lat),
    nx,
    nz,
    tx,
    tz,
  };
}

/** Nearest centre-line sample: angle, distance and frame at that point. */
export function nearestOval(x: number, z: number) {
  let best = Infinity;
  let bestTheta = 0;
  const N = 360;
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    const p = ovalPoint(theta);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) {
      best = d;
      bestTheta = theta;
    }
  }
  const p = ovalPoint(bestTheta);
  // signed lateral offset: positive = outside the oval
  const lat = (x - p.x) * p.nx + (z - p.z) * p.nz;
  return { theta: bestTheta, dist: best, lat, ...p };
}

/** Signed-ish distance from the track centre line (approximate, sampled). */
export function distanceToTrack(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < 120; i++) {
    const p = ovalPoint((i / 120) * Math.PI * 2);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) best = d;
  }
  return best;
}

export function isOnTrackAt(x: number, z: number): boolean {
  return distanceToTrack(x, z) <= TRACK.half;
}

// ---------------------------------------------------------------- pit lane

/** Pit lane runs along the inside of the front straight (theta ≈ PI/2). */
export const PIT = {
  /** Angular sector of the pit lane. Cars enter at thetaStart, exit at thetaEnd. */
  thetaStart: Math.PI / 2 + 0.82,
  thetaEnd: Math.PI / 2 - 0.82,
  /** Lateral band, measured from the track centre line (negative = inside). */
  latInner: -(TRACK.half + 19),
  latOuter: -(TRACK.half + 3),
  /** Automatic speed limit inside the lane (engine units). */
  speedLimit: 13,
  boxes: 6,
  /** Seconds a full service takes. */
  serviceTime: 3,
  /** Angular length of the curved pit entry / exit merge wedges. */
  mergeZone: 0.5,
  /** Lateral offset of the concrete pit wall (between the lane and the track). */
  wallLat: -(TRACK.half + 1.2),
};

export const PIT_LAT_CENTRE = (PIT.latInner + PIT.latOuter) / 2;

/** Inside the core pit sector (boxes, wall, speed limit)? */
export function inPitCore(theta: number) {
  return theta <= PIT.thetaStart && theta >= PIT.thetaEnd;
}

/** Inside the pit zone including the curved entry / exit merges? */
export function inPitZone(theta: number) {
  return theta <= PIT.thetaStart + PIT.mergeZone && theta >= PIT.thetaEnd - PIT.mergeZone;
}

/** Pit-lane query for a world position. */
export function pitLaneAt(x: number, z: number) {
  const near = nearestOval(x, z);
  const inside =
    inPitZone(near.theta) && near.lat <= PIT.latOuter && near.lat >= PIT.latInner;
  if (!inside) return { inLane: false, box: -1, theta: near.theta };
  // Which pit box are we alongside? (boxes only exist in the core sector)
  const span = PIT.thetaStart - PIT.thetaEnd;
  const t = (PIT.thetaStart - near.theta) / span;
  const core = inPitCore(near.theta);
  const box = core
    ? Math.max(0, Math.min(PIT.boxes - 1, Math.floor(t * PIT.boxes)))
    : -1;
  const centred = Math.abs(near.lat - PIT_LAT_CENTRE) < 5;
  return { inLane: true, box: core && centred ? box : -1, theta: near.theta };
}

/** Centre of a pit box (for stopping the car / placing crew). */
export function pitBoxPoint(i: number) {
  const span = PIT.thetaStart - PIT.thetaEnd;
  const theta = PIT.thetaStart - ((i + 0.5) / PIT.boxes) * span;
  return ovalPoint(theta, PIT_LAT_CENTRE);
}

// ---------------------------------------------------------------- geometry

/** Banked strip between two lateral offsets. */
function stripGeometry(latInner: number, latOuter: number, yOff = 0, flat = false) {
  const pos: number[] = [];
  const push = (p: { x: number; z: number; y: number }) =>
    pos.push(p.x, (flat ? 0 : p.y) + yOff, p.z);
  for (let i = 0; i < SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2;
    const b = ((i + 1) / SEGS) * Math.PI * 2;
    const a1 = ovalPoint(a, latInner);
    const a2 = ovalPoint(a, latOuter);
    const b1 = ovalPoint(b, latInner);
    const b2 = ovalPoint(b, latOuter);
    push(a1);
    push(b1);
    push(a2);
    push(b1);
    push(b2);
    push(a2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A vertical band (wall / fence) that follows the banked surface. */
function wallGeometry(lat: number, height: number, yOff = 0) {
  const pos: number[] = [];
  for (let i = 0; i < SEGS; i++) {
    const a = (i / SEGS) * Math.PI * 2;
    const b = ((i + 1) / SEGS) * Math.PI * 2;
    const pa = ovalPoint(a, lat);
    const pb = ovalPoint(b, lat);
    const ay = pa.y + yOff;
    const by = pb.y + yOff;
    pos.push(pa.x, ay, pa.z, pb.x, by, pb.z, pa.x, ay + height, pa.z);
    pos.push(pb.x, by, pb.z, pb.x, by + height, pb.z, pa.x, ay + height, pa.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Places a flat mesh on the banked surface with the correct tilt. */
function layOnTrack(mesh: THREE.Mesh, theta: number, lat: number, lift = 0.02) {
  const p = ovalPoint(theta, lat);
  const dl = 0.5;
  const hUp = bankHeight(theta, lat + dl);
  const hDn = bankHeight(theta, lat - dl);
  const bank = Math.atan2(hUp - hDn, dl * 2);
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.rotation.z = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
  mesh.position.set(p.x, p.y + lift, p.z);
  // tilt with the banking around the direction of travel
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(p.tx, 0, p.tz).normalize(),
    bank,
  );
  mesh.quaternion.premultiply(q);
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

/** Flat strip between two lateral-offset curves over a theta range (pit road + merges). */
function sectorStrip(
  thetaFrom: number,
  thetaTo: number,
  latA: (u: number) => number,
  latB: (u: number) => number,
  y: number,
  segs = 48,
) {
  const pos: number[] = [];
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs;
    const u1 = (i + 1) / segs;
    const ta = thetaFrom + (thetaTo - thetaFrom) * u0;
    const tb = thetaFrom + (thetaTo - thetaFrom) * u1;
    const a1 = ovalPoint(ta, latA(u0));
    const a2 = ovalPoint(ta, latB(u0));
    const b1 = ovalPoint(tb, latA(u1));
    const b2 = ovalPoint(tb, latB(u1));
    pos.push(a1.x, y, a1.z, b1.x, y, b1.z, a2.x, y, a2.z);
    pos.push(b1.x, y, b1.z, b2.x, y, b2.z, a2.x, y, a2.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Vertical band (fence) following an oval offset over a theta range. */
function sectorWall(
  thetaFrom: number,
  thetaTo: number,
  lat: number,
  y0: number,
  y1: number,
  segs = 48,
) {
  const pos: number[] = [];
  for (let i = 0; i < segs; i++) {
    const ta = thetaFrom + (thetaTo - thetaFrom) * (i / segs);
    const tb = thetaFrom + (thetaTo - thetaFrom) * ((i + 1) / segs);
    const pa = ovalPoint(ta, lat);
    const pb = ovalPoint(tb, lat);
    pos.push(pa.x, y0, pa.z, pb.x, y0, pb.z, pa.x, y1, pa.z);
    pos.push(pb.x, y0, pb.z, pb.x, y1, pb.z, pa.x, y1, pa.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Offline canvas texture for trackside signage. */
function signTexture(
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 512,
  h = 256,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- builder

/** Builds the banked NASCAR speedway with full stadium environment + pit lane. */
export function buildTrack(scene: THREE.Scene, t: TimeOfDayDef): WorldRefs {
  const add = (m: THREE.Object3D) => scene.add(m);

  // ---- Ground / infield grass ----
  const groundMat = new THREE.MeshToonMaterial({ color: 0x63b96f });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(TRACK_RADIUS, 96), groundMat);
  ground.rotation.x = -Math.PI / 2;
  add(ground);

  const outerMat = new THREE.MeshToonMaterial({ color: 0x57ab63 });
  const outer = new THREE.Mesh(new THREE.CircleGeometry(TRACK_RADIUS + 900, 64), outerMat);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.5;
  add(outer);

  // Distant hills + haze
  const hillMat = new THREE.MeshToonMaterial({ color: t.night ? 0x2c3a4d : 0x7fa88a });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.11;
    const r = 900 + Math.random() * 240;
    const h = 90 + Math.random() * 130;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(160 + Math.random() * 110, h, 6), hillMat);
    hill.position.set(Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r);
    add(hill);
  }

  // ---- Asphalt (banked) ----
  const roadMat = new THREE.MeshToonMaterial({ color: t.road });
  const asphalt = new THREE.Mesh(stripGeometry(-TRACK.half, TRACK.half, 0.02), roadMat);
  add(asphalt);

  // Grey apron on the inside of the corners
  const apronMat = new THREE.MeshToonMaterial({ color: 0x565c68 });
  add(new THREE.Mesh(stripGeometry(-TRACK.half - 8, -TRACK.half, 0.01), apronMat));

  // Painted lane markings
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });
  add(new THREE.Mesh(stripGeometry(-TRACK.half, -TRACK.half + 0.5, 0.06), lineMat));
  add(new THREE.Mesh(stripGeometry(TRACK.half - 0.5, TRACK.half, 0.06), lineMat));
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
  add(new THREE.Mesh(stripGeometry(-TRACK.half - 0.35, -TRACK.half - 0.05, 0.06), yellowMat));

  // Red/white rumble strip on the inside of the turns
  const rumbleMat = new THREE.MeshBasicMaterial({ color: 0xff5a5f });
  add(new THREE.Mesh(stripGeometry(-TRACK.half - 2.6, -TRACK.half - 0.4, 0.05), rumbleMat));

  // Dashed lane dividers (two racing lanes)
  const dashGeo = new THREE.PlaneGeometry(0.4, 6);
  for (const lat of [-7, 7]) {
    for (let i = 0; i < SEGS; i += 5) {
      const dash = new THREE.Mesh(dashGeo, lineMat);
      layOnTrack(dash, (i / SEGS) * Math.PI * 2, lat, 0.07);
      add(dash);
    }
  }

  // Rubber skid marks worn into the racing groove
  const rubberMat = new THREE.MeshBasicMaterial({
    color: 0x14151a,
    transparent: true,
    opacity: 0.32,
  });
  add(new THREE.Mesh(stripGeometry(1.5, 7.5, 0.05), rubberMat));
  add(new THREE.Mesh(stripGeometry(-9.5, -3.5, 0.05), rubberMat));

  // ---- Start / finish checkered line ----
  const startTheta = Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const lat = -TRACK.half + (i + 0.5) * ((TRACK.half * 2) / 16);
    const sq = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 2.7),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0x22252e }),
    );
    layOnTrack(sq, startTheta, lat, 0.08);
    add(sq);
  }

  // ---- Safety barrier + catch fencing on the outside ----
  const wallMat = new THREE.MeshToonMaterial({ color: 0xf8f9fa });
  const barrier = new THREE.Mesh(wallGeometry(TRACK.half + 1.2, 2.6, 0.02), wallMat);
  add(barrier);
  const sponsorMat = new THREE.MeshToonMaterial({ color: 0x4d7cff });
  add(new THREE.Mesh(wallGeometry(TRACK.half + 1.15, 0.9, 0.4), sponsorMat));
  const fenceMat = new THREE.MeshBasicMaterial({
    color: 0xbcc4d0,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  add(new THREE.Mesh(wallGeometry(TRACK.half + 1.3, 7, 2.6), fenceMat));

  // Fence posts
  const postMat = new THREE.MeshToonMaterial({ color: 0x9aa3b2 });
  for (let i = 0; i < 90; i++) {
    const p = ovalPoint((i / 90) * Math.PI * 2, TRACK.half + 1.3);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 9.6, 0.24), postMat);
    post.position.set(p.x, p.y + 4.8, p.z);
    add(post);
  }

  // ---- Grandstands (tiered bowl) with spectator speckle ----
  const standMats = [
    new THREE.MeshToonMaterial({ color: 0xdfe4ec }),
    new THREE.MeshToonMaterial({ color: 0x4d7cff }),
    new THREE.MeshToonMaterial({ color: 0xff5a5f }),
  ];
  const crowdMats = [
    new THREE.MeshBasicMaterial({ color: 0xffd8a8 }),
    new THREE.MeshBasicMaterial({ color: 0x8ecbff }),
    new THREE.MeshBasicMaterial({ color: 0xffe8a3 }),
    new THREE.MeshBasicMaterial({ color: 0xff9f9f }),
  ];
  const crowdGeo = new THREE.BoxGeometry(0.9, 1.2, 0.9);
  const STANDS = 72;
  for (let i = 0; i < STANDS; i++) {
    const a = (i / STANDS) * Math.PI * 2;
    for (let tier = 0; tier < 4; tier++) {
      const lat = TRACK.half + 14 + tier * 7;
      const p = ovalPoint(a, lat);
      const h = 7 + tier * 6;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(17, h, 7),
        standMats[(i + tier) % standMats.length],
      );
      seg.position.set(p.x, h / 2, p.z);
      seg.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
      add(seg);
      // Spectators as instanced-ish coloured blocks on the top row
      const crowd = new THREE.InstancedMesh(crowdGeo, crowdMats[i % crowdMats.length], 10);
      const m = new THREE.Matrix4();
      for (let c = 0; c < 10; c++) {
        m.makeTranslation((c - 4.5) * 2.6, 0, 0);
        crowd.setMatrixAt(c, m);
      }
      crowd.position.set(p.x, h + 0.6, p.z);
      crowd.rotation.y = seg.rotation.y;
      add(crowd);
    }
  }

  // Sponsor banners around the outside of the stands
  const bannerCols = [0xffcf3f, 0xff5a5f, 0x4d7cff, 0x6bcb77, 0xffffff];
  for (let i = 0; i < 40; i++) {
    const p = ovalPoint((i / 40) * Math.PI * 2, TRACK.half + 11);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.2, 0.3),
      new THREE.MeshToonMaterial({ color: bannerCols[i % bannerCols.length] }),
    );
    b.position.set(p.x, 3.4, p.z);
    b.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    add(b);
  }

  // ---- Floodlight towers ----
  const poleMat = new THREE.MeshToonMaterial({ color: 0x8a93a6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: t.night ? 0xfff3c4 : 0xdfe4ec });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const p = ovalPoint(a, TRACK.half + 52);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 50, 8), poleMat);
    pole.position.set(p.x, 25, p.z);
    add(pole);
    const rig = new THREE.Mesh(new THREE.BoxGeometry(15, 4, 2.5), lampMat);
    rig.position.set(p.x, 51, p.z);
    rig.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    add(rig);
  }

  // Scoreboards
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const p = ovalPoint(a, TRACK.half + 46);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(38, 16, 2), poleMat);
    frame.position.set(p.x, 26, p.z);
    frame.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    add(frame);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(34, 12, 0.6),
      new THREE.MeshBasicMaterial({ color: t.night ? 0x1b2b5a : 0x24304a }),
    );
    screen.position.copy(frame.position);
    screen.position.y = 26;
    screen.rotation.y = frame.rotation.y;
    screen.translateZ(1.4);
    add(screen);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 18, 2), poleMat);
      leg.position.set(p.x + sx * 12, 9, p.z);
      add(leg);
    }
  }

  // ---- Infield ----
  const infieldMat = new THREE.MeshToonMaterial({ color: 0x6bcb77 });
  const infield = new THREE.Mesh(new THREE.CircleGeometry(1, 48), infieldMat);
  infield.rotation.x = -Math.PI / 2;
  infield.position.y = 0.015;
  infield.scale.set(TRACK.ax - TRACK.half - 4, TRACK.az - TRACK.half - 4, 1);
  add(infield);

  // ---- Pit lane: realistic NASCAR pit road on the inside of the front straight ----
  const crewGroups: Array<{ figs: THREE.Mesh[]; bases: number[] }> = [];
  const flags: Array<{ m: THREE.Mesh; phase: number }> = [];
  let pitT = 0;
  const colliders: Box[] = [];
  const pitMat = new THREE.MeshToonMaterial({ color: 0x4a4f5a });
  const pitSpan = PIT.thetaStart - PIT.thetaEnd;
  const mergeEdgeIn = -24.5; // garage-side end of the merge wedges at the track edge
  const mergeEdgeOut = -22.3; // wall-side end of the merge wedges at the track edge

  // Core lane + curved pit entry / pit exit merge wedges
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd, PIT.thetaStart, () => PIT.latInner, () => PIT.latOuter, 0.03, 60),
    pitMat,
  ));
  const entryLatA = (u: number) => lerp(PIT.latInner, mergeEdgeIn, u);
  const entryLatB = (u: number) => lerp(PIT.latOuter, mergeEdgeOut, u);
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaStart, PIT.thetaStart + PIT.mergeZone, entryLatA, entryLatB, 0.03, 24),
    pitMat,
  ));
  const exitLatA = (u: number) => lerp(mergeEdgeIn, PIT.latInner, u);
  const exitLatB = (u: number) => lerp(mergeEdgeOut, PIT.latOuter, u);
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd - PIT.mergeZone, PIT.thetaEnd, exitLatA, exitLatB, 0.03, 24),
    pitMat,
  ));

  // Continuous yellow line on the right (pit wall) side + white line on the left
  const pitYellow = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
  const pitWhite = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd, PIT.thetaStart, () => PIT.latOuter - 0.6, () => PIT.latOuter - 0.15, 0.045, 60),
    pitYellow,
  ));
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd, PIT.thetaStart, () => PIT.latInner + 0.15, () => PIT.latInner + 0.6, 0.045, 60),
    pitWhite,
  ));
  // Painted guide lines through both merges
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaStart, PIT.thetaStart + PIT.mergeZone, (u) => entryLatB(u) - 0.7, (u) => entryLatB(u) - 0.25, 0.045, 24),
    pitWhite,
  ));
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd - PIT.mergeZone, PIT.thetaEnd, (u) => exitLatB(u) - 0.7, (u) => exitLatB(u) - 0.25, 0.045, 24),
    pitWhite,
  ));

  // Rubber wear + oil stains on the pit lane
  const pitRubber = new THREE.MeshBasicMaterial({ color: 0x14151a, transparent: true, opacity: 0.22 });
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd - 0.3, PIT.thetaStart + 0.3, () => -34.6, () => -33.1, 0.038, 60),
    pitRubber,
  ));
  add(new THREE.Mesh(
    sectorStrip(PIT.thetaEnd - 0.3, PIT.thetaStart + 0.3, () => -30.9, () => -29.4, 0.038, 60),
    pitRubber,
  ));
  const stainMat = new THREE.MeshBasicMaterial({ color: 0x0c0d10, transparent: true, opacity: 0.2 });
  for (let i = 0; i < 12; i++) {
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 1.6, 14), stainMat);
    const sp = ovalPoint(PIT.thetaEnd + Math.random() * pitSpan, -27 - Math.random() * 12);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(sp.x, 0.038, sp.z);
    add(stain);
  }

  // Continuous concrete pit wall separating the lane from the track
  const pitWallMat = new THREE.MeshToonMaterial({ color: 0xeef1f5 });
  const WALL_SEGS = 64;
  for (let i = 0; i < WALL_SEGS; i++) {
    const theta = PIT.thetaStart - (i / WALL_SEGS) * pitSpan;
    const p = ovalPoint(theta, PIT.wallLat);
    const yaw = Math.atan2(-p.tz, p.tx); // long axis along the lane
    const seg = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.1, 0.5), pitWallMat);
    seg.position.set(p.x, 0.55, p.z);
    seg.rotation.y = yaw;
    add(seg);
    // Solid collision for the wall — axis-aligned boxes overlapping the visual
    // segments so there are no gaps even at high speed (every segment, extra
    // length to bridge the gaps between visual wall pieces).
    {
      const halfAlong = 4.2;
      const halfAcross = 1.1;
      const ax = Math.abs(p.tx) * halfAlong + Math.abs(p.nx) * halfAcross;
      const az = Math.abs(p.tz) * halfAlong + Math.abs(p.nz) * halfAcross;
      colliders.push({ x: p.x, z: p.z, halfX: Math.max(1.8, ax), halfZ: Math.max(1.8, az) });
    }
    // sponsor panels on the lane side of the wall
    if (i % 8 === 4) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 0.6),
        new THREE.MeshBasicMaterial({ color: bannerCols[(i / 8 | 0) % bannerCols.length] }),
      );
      panel.position.set(p.x - p.nx * 0.28, 0.55, p.z - p.nz * 0.28);
      panel.rotation.y = Math.atan2(-p.nx, -p.nz);
      add(panel);
    }
  }
  // Catch fencing above the pit wall (protects the crews like a real speedway)
  add(new THREE.Mesh(sectorWall(PIT.thetaEnd, PIT.thetaStart, PIT.wallLat, 1.1, 5.1, 60), fenceMat));
  for (let i = 0; i < WALL_SEGS; i += 4) {
    const p = ovalPoint(PIT.thetaStart - (i / WALL_SEGS) * pitSpan, PIT.wallLat);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), postMat);
    post.position.set(p.x, 3.1, p.z);
    post.rotation.y = Math.atan2(-p.tx, -p.tz);
    add(post);
  }

  // Safety barriers + cones guiding the entry / exit merges
  const cheekMat = new THREE.MeshToonMaterial({ color: 0xf8f9fa });
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
  const coneBaseMat = new THREE.MeshBasicMaterial({ color: 0x22252e });
  const placeCone = (theta: number, lat: number) => {
    const p = ovalPoint(theta, lat);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.68, 8), coneMat);
    cone.position.set(p.x, 0.37, p.z);
    add(cone);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), coneBaseMat);
    base.position.set(p.x, 0.05, p.z);
    add(base);
  };
  for (let s = 0; s < 4; s++) {
    const u = 0.2 + s * 0.2;
    // entry: cheek barriers on the track side + cones on the lane side
    const tE = PIT.thetaStart + u * PIT.mergeZone;
    const pE = ovalPoint(tE, entryLatB(u) + 0.35);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 0.5), cheekMat);
    bar.position.set(pE.x, 0.38, pE.z);
    bar.rotation.y = Math.atan2(-pE.tz, pE.tx);
    add(bar);
    placeCone(tE, entryLatB(u) - 1.15);
    // exit: cones marking the merge back onto the track
    placeCone(PIT.thetaEnd - PIT.mergeZone + u * PIT.mergeZone, exitLatB(u) - 1.15);
  }

  // Trackside signage: PIT ENTRY / PIT EXIT / speed limit boards
  const entryTex = signTexture((g, w, h) => {
    g.fillStyle = "#15803d";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 12;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#ffffff";
    g.font = "bold 88px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("PIT ENTRY", w / 2, h / 2);
  });
  const exitTex = signTexture((g, w, h) => {
    g.fillStyle = "#b91c1c";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 12;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#ffffff";
    g.font = "bold 88px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("PIT EXIT", w / 2, h / 2);
  });
  const limitTex = signTexture(
    (g) => {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(128, 128, 124, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#dc2626";
      g.lineWidth = 26;
      g.beginPath();
      g.arc(128, 128, 104, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#111827";
      g.font = "bold 108px Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("50", 128, 132);
    },
    256,
    256,
  );
  const postSign = (
    tex: THREE.Texture,
    w: number,
    h: number,
    theta: number,
    lat: number,
    y: number,
  ) => {
    const p = ovalPoint(theta, lat);
    const g = new THREE.Group();
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    panel.position.y = y;
    g.add(panel);
    const postH = y - h / 2 + 0.1;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, postH, 0.18), postMat);
      post.position.set(sx * (w / 2 - 0.7), postH / 2, 0);
      g.add(post);
    }
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(-p.tx, -p.tz); // face the oncoming cars
    add(g);
  };
  postSign(entryTex, 8, 2.4, PIT.thetaStart + 0.68, -23.6, 3.2);
  postSign(limitTex, 1.9, 1.9, PIT.thetaStart + 0.48, -23.6, 2.5);
  postSign(limitTex, 1.9, 1.9, PIT.thetaStart + 0.22, -24.2, 2.5);
  postSign(exitTex, 8, 2.4, PIT.thetaEnd - 0.42, -23.6, 3.2);

  // ---- Pit boxes, garages, crews, equipment ----
  const boxLineMat = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
  const teamCols = [0xff5a5f, 0x4d7cff, 0x6bcb77, 0xffcf3f, 0xc56bff, 0x00c2d1];
  const garageOpeningMat = new THREE.MeshToonMaterial({ color: 0x17181d });
  const garageRoofMat = new THREE.MeshToonMaterial({ color: 0x2a2d34 });
  const tyreMat = new THREE.MeshToonMaterial({ color: 0x1c1d22 });
  const crateMat = new THREE.MeshToonMaterial({ color: 0x8a6d3b });
  for (let i = 0; i < PIT.boxes; i++) {
    const boxTheta = PIT.thetaStart - ((i + 0.5) / PIT.boxes) * pitSpan;
    const p = pitBoxPoint(i);
    const yaw = Math.atan2(-p.tx, -p.tz);
    const rot = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    const teamMat = new THREE.MeshToonMaterial({ color: teamCols[i % teamCols.length] });

    // box marking on the lane
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.5), boxLineMat);
    mark.rotation.set(-Math.PI / 2, 0, 0);
    mark.rotation.z = rot;
    mark.position.set(p.x, 0.05, p.z);
    add(mark);
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x3c414b }),
    );
    inner.rotation.copy(mark.rotation);
    inner.position.set(p.x, 0.06, p.z);
    add(inner);

    // garage building behind the box (opening + team band facing the lane)
    const gp = ovalPoint(boxTheta, PIT.latInner - 9);
    const garage = new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 14), teamMat);
    garage.position.set(gp.x, 3.25, gp.z);
    garage.rotation.y = yaw;
    add(garage);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 15), garageRoofMat);
    roof.position.set(gp.x, 6.75, gp.z);
    roof.rotation.y = yaw;
    add(roof);
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.6), garageOpeningMat);
    const op = ovalPoint(boxTheta, PIT.latInner - 9 + 6.06);
    opening.position.set(op.x, 2.4, op.z);
    opening.rotation.y = Math.atan2(-op.nx, -op.nz);
    add(opening);
    const bandTex = signTexture(
      (g, w, h) => {
        g.fillStyle = `#${new THREE.Color(teamCols[i % teamCols.length]).getHexString()}`;
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#ffffff";
        g.font = "bold 72px Arial, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`P${i + 1}`, w / 2, h / 2 + 4);
        g.font = "bold 34px Arial, sans-serif";
        g.fillText("ROAD RUSH RACING", w / 2 + 190, h / 2 + 4);
      },
      512,
      96,
    );
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.5),
      new THREE.MeshBasicMaterial({ map: bandTex }),
    );
    band.position.set(op.x, 5.55, op.z);
    band.rotation.y = opening.rotation.y;
    add(band);
    // canopy over the crew walk + support poles
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 14), garageRoofMat);
    const cp = ovalPoint(boxTheta, PIT.latInner - 4);
    canopy.position.set(cp.x, 5.3, cp.z);
    canopy.rotation.y = yaw;
    add(canopy);
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.2, 8), postMat);
      const pp = ovalPoint(boxTheta, PIT.latInner - 0.8);
      pole.position.set(pp.x + p.tx * side * 6, 2.6, pp.z + p.tz * side * 6);
      add(pole);
    }
    colliders.push({ x: gp.x, z: gp.z, halfX: 7, halfZ: 6.2 });

    // equipment on the crew walk: tyre stacks, fuel rig, tool cart, crates
    const eq = (lat: number, along: number) => {
      const q = ovalPoint(boxTheta, lat);
      return { x: q.x + p.tx * along, z: q.z + p.tz * along };
    };
    for (let s = 0; s < 4; s++) {
      const q = eq(-45.5, -4.5 + (s % 2) * 1.3);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10), tyreMat);
      tyre.position.set(q.x, 0.2 + Math.floor(s / 2) * 0.4, q.z);
      add(tyre);
    }
    const fr = eq(-45.5, 4.6);
    const rig = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), new THREE.MeshToonMaterial({ color: 0xff9f45 }));
    rig.position.set(fr.x, 1.1, fr.z);
    add(rig);
    const tc = eq(-44.6, 2.3);
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 1.1), new THREE.MeshToonMaterial({ color: 0xdfe4ec }));
    cart.position.set(tc.x, 0.55, tc.z);
    cart.rotation.y = yaw;
    add(cart);
    for (const side of [-1, 1]) {
      const cr = eq(-44.2, side * 6.2);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1), crateMat);
      crate.position.set(cr.x, 0.4, cr.z);
      crate.rotation.y = yaw;
      add(crate);
    }

    // pit crew (animated while servicing this box)
    const crew = new THREE.Group();
    crew.position.set(p.x, 0, p.z);
    crew.rotation.y = yaw;
    const figs: THREE.Mesh[] = [];
    const bases: number[] = [];
    const spots: Array<[number, number]> = [
      [-1.9, -1.5],
      [-1.9, 0],
      [-1.9, 1.5],
      [-0.7, -2.7],
    ];
    for (let c = 0; c < spots.length; c++) {
      const fig = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.85, 4, 8), teamMat);
      fig.position.set(spots[c][0], 1, spots[c][1]);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshToonMaterial({ color: 0xf8f9fa }),
      );
      helmet.position.y = 0.62;
      fig.add(helmet);
      crew.add(fig);
      figs.push(fig);
      bases.push(1);
    }
    add(crew);
    crewGroups.push({ figs, bases });
  }

  // ---- Timing & scoring tower behind the garages ----
  const towerTex = signTexture((g, w, h) => {
    g.fillStyle = "#101623";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffcf3f";
    g.font = "bold 84px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("ROAD RUSH", w / 2, 62);
    g.fillStyle = "#ffffff";
    g.font = "bold 60px Arial, sans-serif";
    g.fillText("SPEEDWAY", w / 2, 146);
    for (let cx = 0; cx < 16; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        g.fillStyle = (cx + cy) % 2 ? "#ffffff" : "#101623";
        g.fillRect(cx * 32, h - 64 + cy * 32, 32, 32);
      }
    }
  }, 512, 256);
  const towerP = ovalPoint(Math.PI / 2, -64);
  const towerShell = new THREE.MeshToonMaterial({ color: 0xb9c1cf });
  const towerCabinMat = new THREE.MeshToonMaterial({ color: 0x39404e });
  const podium = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 12), new THREE.MeshToonMaterial({ color: 0xcfd6e0 }));
  podium.position.set(towerP.x, 1.5, towerP.z);
  add(podium);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, 30, 5), towerShell);
  shaft.position.set(towerP.x, 18, towerP.z);
  add(shaft);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(13, 8, 11), towerCabinMat);
  cabin.position.set(towerP.x, 37, towerP.z);
  add(cabin);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), towerShell);
  spire.position.set(towerP.x, 44.5, towerP.z);
  add(spire);
  for (const sz of [-1, 1]) {
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 5.5),
      new THREE.MeshBasicMaterial({ map: towerTex }),
    );
    screen.position.set(towerP.x, 37, towerP.z + sz * 5.6);
    screen.rotation.y = sz > 0 ? 0 : Math.PI;
    add(screen);
  }
  colliders.push({ x: towerP.x, z: towerP.z, halfX: 6.5, halfZ: 6.5 });

  // ---- Starter / flag stand above the pit wall at start-finish ----
  const fs = ovalPoint(Math.PI / 2, PIT.wallLat);
  const standMat = new THREE.MeshToonMaterial({ color: 0xdfe4ec });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 3), standMat);
  platform.position.set(fs.x, 2.35, fs.z);
  add(platform);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.35, 0.22), postMat);
    leg.position.set(fs.x + sx * 1.8, 1.18, fs.z);
    add(leg);
  }
  const checkerTex = signTexture(
    (g) => {
      for (let cx = 0; cx < 8; cx++) {
        for (let cy = 0; cy < 4; cy++) {
          g.fillStyle = (cx + cy) % 2 ? "#111827" : "#f8f9fa";
          g.fillRect(cx * 16, cy * 16, 16, 16);
        }
      }
    },
    128,
    64,
  );
  const flagCols: Array<{ c?: number; tex?: THREE.Texture }> = [
    { c: 0x6bcb77 },
    { c: 0xffcf3f },
    { tex: checkerTex },
  ];
  flagCols.forEach((f, i) => {
    const fx = fs.x + (i - 1) * 1.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), postMat);
    pole.position.set(fx, 3.8, fs.z);
    add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.62),
      f.tex
        ? new THREE.MeshBasicMaterial({ map: f.tex, side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ color: f.c, side: THREE.DoubleSide }),
    );
    flag.position.set(fx + 0.55, 4.85, fs.z);
    add(flag);
    flags.push({ m: flag, phase: i * 2.1 });
  });
  colliders.push({ x: fs.x, z: fs.z, halfX: 2.4, halfZ: 1.8 });

  // Pit buildings / team hospitality in the infield
  const buildMat = new THREE.MeshToonMaterial({ color: 0xe6ebf2 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 14), buildMat);
    b.position.set(-90 + i * 34, 5, TRACK.az - TRACK.half - 62);
    add(b);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(23, 0.8, 15),
      new THREE.MeshToonMaterial({ color: teamCols[i % teamCols.length] }),
    );
    roof.position.set(b.position.x, 10.4, b.position.z);
    add(roof);
  }

  // Pit-scene animation: crew works the active box, flags flutter
  const updatePitScene = (dt: number, activeBox: number) => {
    pitT += dt;
    for (const f of flags) {
      f.m.rotation.y = Math.sin(pitT * 2.6 + f.phase) * 0.38;
    }
    crewGroups.forEach((cg, i) => {
      const active = i === activeBox;
      for (let k = 0; k < cg.figs.length; k++) {
        const fig = cg.figs[k];
        if (active) {
          fig.position.y = cg.bases[k] + Math.abs(Math.sin(pitT * 9 + k * 1.9)) * 0.24;
          fig.rotation.y = Math.sin(pitT * 5.2 + k * 1.3) * 0.55;
        } else {
          fig.position.y = cg.bases[k] + Math.sin(pitT * 1.3 + k * 2.2) * 0.035;
          fig.rotation.y *= 0.96;
        }
      }
    });
  };

  const applyTimeOfDay = (nt: TimeOfDayDef) => {
    roadMat.color.set(nt.road);
    lampMat.color.set(nt.night ? 0xfff3c4 : 0xdfe4ec);
    hillMat.color.set(nt.night ? 0x2c3a4d : 0x7fa88a);
  };

  return {
    buildings: colliders,
    ramps: [],
    sand: [],
    roads: [],
    ring: { radius: (TRACK.ax + TRACK.az) / 2, half: TRACK.half },
    radius: TRACK_RADIUS,
    stuntZone: { x: 0, z: 0, radius: 0 },
    applyTimeOfDay,
    updatePitScene,
  };
}

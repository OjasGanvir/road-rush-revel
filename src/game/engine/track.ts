import * as THREE from "three";
import type { TimeOfDayDef } from "../config/timeofday";
import type { WorldRefs } from "./world";

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
  /** Angular sector of the pit lane (entry -> exit), along the front straight. */
  thetaStart: Math.PI / 2 + 0.82,
  thetaEnd: Math.PI / 2 - 0.82,
  /** Lateral band, measured from the track centre line (negative = inside). */
  latInner: -(TRACK.half + 24),
  latOuter: -(TRACK.half + 8),
  /** Automatic speed limit inside the lane (engine units). */
  speedLimit: 13,
  boxes: 6,
  /** Seconds a full service takes. */
  serviceTime: 3,
};

export const PIT_LAT_CENTRE = (PIT.latInner + PIT.latOuter) / 2;

/** Is theta inside the pit-lane sector (which straddles theta = PI/2)? */
function inPitSector(theta: number) {
  return theta <= PIT.thetaStart && theta >= PIT.thetaEnd;
}

/** Pit-lane query for a world position. */
export function pitLaneAt(x: number, z: number) {
  const near = nearestOval(x, z);
  const inside =
    inPitSector(near.theta) && near.lat <= PIT.latOuter && near.lat >= PIT.latInner;
  if (!inside) return { inLane: false, box: -1, theta: near.theta };
  // Which pit box are we alongside?
  const span = PIT.thetaStart - PIT.thetaEnd;
  const t = (PIT.thetaStart - near.theta) / span;
  const box = Math.floor(t * PIT.boxes);
  const centred = Math.abs(near.lat - PIT_LAT_CENTRE) < 5;
  return { inLane: true, box: centred ? Math.max(0, Math.min(PIT.boxes - 1, box)) : -1, theta: near.theta };
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
      const crowd = new THREE.InstancedMesh(crowdGeo, crowdMats[i % crowdMats.length], 6);
      const m = new THREE.Matrix4();
      for (let c = 0; c < 6; c++) {
        m.makeTranslation((c - 2.5) * 2.6, 0, 0);
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

  // ---- Pit lane ----
  const pitMat = new THREE.MeshToonMaterial({ color: 0x4a4f5a });
  const pitPos: number[] = [];
  const PSEG = 60;
  for (let i = 0; i < PSEG; i++) {
    const a = PIT.thetaStart - (i / PSEG) * (PIT.thetaStart - PIT.thetaEnd);
    const b = PIT.thetaStart - ((i + 1) / PSEG) * (PIT.thetaStart - PIT.thetaEnd);
    const a1 = ovalPoint(a, PIT.latInner);
    const a2 = ovalPoint(a, PIT.latOuter);
    const b1 = ovalPoint(b, PIT.latInner);
    const b2 = ovalPoint(b, PIT.latOuter);
    pitPos.push(a1.x, 0.03, a1.z, b1.x, 0.03, b1.z, a2.x, 0.03, a2.z);
    pitPos.push(b1.x, 0.03, b1.z, b2.x, 0.03, b2.z, a2.x, 0.03, a2.z);
  }
  const pitGeo = new THREE.BufferGeometry();
  pitGeo.setAttribute("position", new THREE.Float32BufferAttribute(pitPos, 3));
  pitGeo.computeVertexNormals();
  add(new THREE.Mesh(pitGeo, pitMat));

  // Pit wall (between lane and track) + pit boxes, garages, crew, equipment
  const pitWallMat = new THREE.MeshToonMaterial({ color: 0xeef1f5 });
  const boxLineMat = new THREE.MeshBasicMaterial({ color: 0xffcf3f });
  const teamCols = [0xff5a5f, 0x4d7cff, 0x6bcb77, 0xffcf3f, 0xc56bff, 0x00c2d1, 0xff9f45, 0xffffff];
  for (let i = 0; i < PSEG; i += 2) {
    const a = PIT.thetaStart - (i / PSEG) * (PIT.thetaStart - PIT.thetaEnd);
    const p = ovalPoint(a, PIT.latOuter + 1.5);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(8, 1.3, 0.5), pitWallMat);
    seg.position.set(p.x, 0.65, p.z);
    seg.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    add(seg);
  }
  for (let i = 0; i < PIT.boxes; i++) {
    const p = pitBoxPoint(i);
    const rot = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
    // box marking
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

    const teamMat = new THREE.MeshToonMaterial({ color: teamCols[i % teamCols.length] });
    // garage behind the box
    const gp = ovalPoint(
      PIT.thetaStart - ((i + 0.5) / PIT.boxes) * (PIT.thetaStart - PIT.thetaEnd),
      PIT.latInner - 9,
    );
    const garage = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 12), teamMat);
    garage.position.set(gp.x, 3.5, gp.z);
    garage.rotation.y = rot;
    add(garage);

    // tyre rack, fuel rig, crew figures
    const rackMat = new THREE.MeshToonMaterial({ color: 0x1c1d22 });
    for (let s = 0; s < 4; s++) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 10), rackMat);
      tyre.position.set(gp.x + (s % 2) * 1.2 - 3, 0.2 + Math.floor(s / 2) * 0.4, gp.z + 4);
      tyre.rotation.x = Math.PI / 2;
      add(tyre);
    }
    const rig = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), new THREE.MeshToonMaterial({ color: 0xff9f45 }));
    rig.position.set(gp.x + 4, 1.1, gp.z + 4);
    add(rig);
    for (let c = 0; c < 3; c++) {
      const crew = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 8), teamMat);
      crew.position.set(p.x - 3 + c * 3, 1, p.z - 4.4);
      add(crew);
    }
  }

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

  const applyTimeOfDay = (nt: TimeOfDayDef) => {
    roadMat.color.set(nt.road);
    lampMat.color.set(nt.night ? 0xfff3c4 : 0xdfe4ec);
    hillMat.color.set(nt.night ? 0x2c3a4d : 0x7fa88a);
  };

  return {
    buildings: [],
    ramps: [],
    sand: [],
    roads: [],
    ring: { radius: (TRACK.ax + TRACK.az) / 2, half: TRACK.half },
    radius: TRACK_RADIUS,
    stuntZone: { x: 0, z: 0, radius: 0 },
    applyTimeOfDay,
  };
}

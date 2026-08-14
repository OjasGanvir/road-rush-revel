import * as THREE from "three";

export type ObstacleType =
  | "traffic"
  | "truck"
  | "barrier"
  | "oil"
  | "cone"
  | "construction";

export type ObstacleMeta = {
  type: ObstacleType;
  halfW: number;
  halfL: number;
  /** Oil spills don't crash you — they cause a skid. */
  skid: boolean;
};

const toon = (hex: string) =>
  new THREE.MeshToonMaterial({ color: new THREE.Color(hex) });
const basic = (hex: string) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });

function trafficCar(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3), toon(color));
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 1.5), toon("#22252e"));
  cabin.position.y = 1.2;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wmesh = new THREE.Mesh(wheelGeo, toon("#18181b"));
      wmesh.position.set(sx * 0.82, 0.32, sz * 0.95);
      g.add(wmesh);
    }
  g.userData.meta = { type: "traffic", halfW: 0.9, halfL: 1.6, skid: false } as ObstacleMeta;
  return g;
}

function truck(): THREE.Group {
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.8), toon("#4d7cff"));
  cab.position.set(0, 1.1, -1.9);
  cab.castShadow = true;
  g.add(cab);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 3.6), toon("#e9ecef"));
  trailer.position.set(0, 1.4, 0.8);
  trailer.castShadow = true;
  g.add(trailer);
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1])
    for (const sz of [-1.6, 0, 1.6]) {
      const wmesh = new THREE.Mesh(wheelGeo, toon("#18181b"));
      wmesh.position.set(sx * 1.05, 0.4, sz);
      g.add(wmesh);
    }
  g.userData.meta = { type: "truck", halfW: 1.1, halfL: 2.9, skid: false } as ObstacleMeta;
  return g;
}

function barrier(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.6), toon("#ff5a5f"));
  base.position.y = 0.55;
  base.castShadow = true;
  g.add(base);
  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.86, 0.62), toon("#f8f9fa"));
    stripe.position.set(i * 0.9, 0.55, 0);
    g.add(stripe);
  }
  g.userData.meta = { type: "barrier", halfW: 1.5, halfL: 0.4, skid: false } as ObstacleMeta;
  return g;
}

function oil(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CircleGeometry(1.1, 18);
  geo.rotateX(-Math.PI / 2);
  const spill = new THREE.Mesh(geo, basic("#141416"));
  spill.position.y = 0.02;
  g.add(spill);
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), basic("#3a2d55"));
  sheen.position.y = 0.03;
  g.add(sheen);
  g.userData.meta = { type: "oil", halfW: 1, halfL: 1, skid: true } as ObstacleMeta;
  return g;
}

function cone(): THREE.Group {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), toon("#ff9f45"));
  c.position.y = 0.45;
  c.castShadow = true;
  g.add(c);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.16, 8), toon("#f8f9fa"));
  band.position.y = 0.5;
  g.add(band);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), toon("#33251a"));
  base.position.y = 0.05;
  g.add(base);
  g.userData.meta = { type: "cone", halfW: 0.4, halfL: 0.4, skid: false } as ObstacleMeta;
  return g;
}

function construction(): THREE.Group {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.4), toon("#ffcf3f"));
  block.position.y = 0.7;
  block.castShadow = true;
  g.add(block);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 1.5), toon("#22252e"));
  top.position.y = 1.35;
  g.add(top);
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), toon("#ff9f45"));
    c.position.set(sx * 1.4, 0.4, 0.9);
    g.add(c);
  }
  g.userData.meta = { type: "construction", halfW: 1.15, halfL: 0.8, skid: false } as ObstacleMeta;
  return g;
}

const TRAFFIC_COLORS = ["#6bcb77", "#c56bff", "#00c2d1", "#ff6fa5", "#f8f9fa", "#ff9f45"];

export function buildObstacle(type: ObstacleType): THREE.Group {
  switch (type) {
    case "traffic":
      return trafficCar(TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)]);
    case "truck":
      return truck();
    case "barrier":
      return barrier();
    case "oil":
      return oil();
    case "cone":
      return cone();
    case "construction":
      return construction();
  }
}

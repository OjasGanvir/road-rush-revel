import * as THREE from "three";
import type { CarDef } from "../config/cars";
import { getWheel } from "../config/cosmetics";

export type CarVisualOptions = {
  car: CarDef;
  paintColor: string;
  wheelId: string;
};

/**
 * Builds a chunky low-poly car as a THREE.Group centered at origin,
 * facing -Z (forward). Shape varies by car class.
 * Wheels are stored on group.userData.wheels for spin.
 */
export function buildCar(opts: CarVisualOptions): THREE.Group {
  const { car, paintColor } = opts;
  const wheel = getWheel(opts.wheelId);
  const group = new THREE.Group();
  const [w, h, l] = car.size;
  const ride = car.rideHeight;

  const paintMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(paintColor),
    roughness: 0.28,
    metalness: 0.4,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(car.cabin),
    roughness: 0.15,
    metalness: 0.85,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#15161c"),
    roughness: 0.4,
    metalness: 0.5,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wheel.wheelColor),
    roughness: 0.2,
    metalness: 0.8,
  });
  const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff6c2") });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5a5f") });

  const wheelR = 0.34 + ride * 0.5;
  const baseY = wheelR + 0.02 + ride;

  // Lower body
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), paintMat);
  body.position.y = baseY + h / 2;
  body.castShadow = true;
  group.add(body);

  // Cabin — proportions vary by class
  const cabinLen =
    car.class === "muscle" || car.class === "hyper" ? l * 0.42 : l * 0.5;
  const cabinH = car.class === "suv" || car.class === "offroad" ? h * 1.05 : h * 0.85;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.82, cabinH, cabinLen),
    cabinMat,
  );
  cabin.position.set(0, baseY + h + cabinH / 2 - 0.02, l * 0.02);
  cabin.castShadow = true;
  group.add(cabin);

  // Windshield accent
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, cabinH * 0.7, 0.08),
    darkMat,
  );
  glass.position.set(0, baseY + h + cabinH / 2, l * 0.02 - cabinLen / 2 - 0.02);
  group.add(glass);

  // Headlights (front is -Z)
  for (const sx of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.08), lightMat);
    light.position.set(sx * w * 0.32, baseY + h * 0.4, -l / 2 + 0.02);
    group.add(light);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.06), tailMat);
    tail.position.set(sx * w * 0.32, baseY + h * 0.5, l / 2 - 0.01);
    group.add(tail);
  }

  // Class-specific extras
  if (car.class === "sports" || car.class === "muscle" || car.class === "hyper") {
    // Rear spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.08, 0.4), darkMat);
    wing.position.set(0, baseY + h + 0.28, l / 2 - 0.1);
    group.add(wing);
    for (const sx of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.1), darkMat);
      stalk.position.set(sx * w * 0.32, baseY + h + 0.14, l / 2 - 0.1);
      group.add(stalk);
    }
  }
  if (car.class === "suv" || car.class === "offroad") {
    // Roof rack
    const rack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, cabinLen * 0.8), darkMat);
    rack.position.set(0, baseY + h + cabinH + 0.06, l * 0.02);
    group.add(rack);
  }
  if (car.class === "offroad") {
    // Light bar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.12, 0.12), lightMat);
    bar.position.set(0, baseY + h + cabinH + 0.16, l * 0.02 - cabinLen / 2);
    group.add(bar);
  }

  // Wheels — each sits in its own pivot so steering (pivot.rotation.y) and
  // rolling (wheel.rotation.x) animate independently.
  const wheelW = car.class === "offroad" || car.class === "muscle" ? 0.32 : 0.26;
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const steerPivots: THREE.Group[] = [];
  const wx = w / 2 + 0.02;
  const wz = l * 0.32;
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * wx, wheelR, sz * wz);
      const m = new THREE.Mesh(wheelGeo, wheelMat);
      m.castShadow = true;
      pivot.add(m);
      group.add(pivot);
      wheels.push(m);
      // Front of the car is -Z, so those are the steering wheels.
      if (sz === -1) steerPivots.push(pivot);
    }
  }

  group.userData.wheels = wheels;
  group.userData.steerPivots = steerPivots;
  group.userData.wheelRadius = wheelR;
  group.userData.paintMat = paintMat;
  return group;
}


export function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

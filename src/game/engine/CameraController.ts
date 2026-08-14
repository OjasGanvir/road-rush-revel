import * as THREE from "three";
import {
  getCameraMode,
  type CameraModeDef,
  type CameraModeId,
  type CameraSettings,
} from "../config/camera";

/** Per-frame car state the camera reacts to. */
export type CameraState = {
  px: number;
  pz: number;
  py: number;
  heading: number;
  /** Forward speed (engine units). */
  vf: number;
  /** Lateral slip (signed). */
  vl: number;
  /** Car cabin height. */
  carHeight: number;
  /** Car length. */
  carLength: number;
  airborne: boolean;
  drifting: boolean;
  driftMult: number;
  nitro: boolean;
  /** One-shot shake impulse added by the engine (0..1). */
  shakeImpulse: number;
};

/** Axis-aligned obstacle footprint used for camera collision. */
export type CameraBox = { x: number; z: number; halfX: number; halfZ: number };

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _anchor = new THREE.Vector3();

/**
 * Modern chase-camera controller: smooth spring follow, dynamic FOV, drift
 * lean/pull-back, jump pull-back, shake, and obstacle collision pull-in.
 * Fully decoupled from the engine so camera behaviour stays modular.
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private buildings: CameraBox[];
  private settings: CameraSettings;
  private mode: CameraModeDef;

  // Smoothed rig state (creates the "slight delay" feel).
  private followHeading = 0;
  private driftYaw = 0;
  private extraDist = 0;
  private extraHeight = 0;
  private camRoll = 0;
  private fov: number;
  private shake = 0;
  private cineAngle = 0;
  private clock = 0;
  private curLook = new THREE.Vector3();
  private initialized = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    buildings: CameraBox[],
    settings: CameraSettings,
    modeId: CameraModeId,
  ) {
    this.camera = camera;
    this.buildings = buildings;
    this.settings = { ...settings };
    this.mode = getCameraMode(modeId);
    this.fov = this.mode.baseFov;
  }

  setMode(id: CameraModeId) {
    this.mode = getCameraMode(id);
  }
  getMode(): CameraModeId {
    return this.mode.id;
  }
  updateSettings(patch: Partial<CameraSettings>) {
    this.settings = { ...this.settings, ...patch };
  }

  /** Main per-frame update: positions and orients the camera. */
  update(dt: number, s: CameraState) {
    this.clock += dt;
    const m = this.mode;
    const set = this.settings;
    const speed = Math.abs(s.vf);

    // --- Smoothed follow heading (lag behind rapid steering) ---
    const followLerp = Math.min(1, dt * m.stiffness * (0.6 + set.sensitivity * 0.6));
    this.followHeading = lerpAngle(this.followHeading, s.heading, followLerp);

    // --- Drift look-into: rotate rig toward the slide ---
    const driftTarget = s.drifting ? clamp(-s.vl * 0.018, -0.5, 0.5) : 0;
    this.driftYaw += (driftTarget - this.driftYaw) * Math.min(1, dt * 3);

    // --- Extra distance/height from drift length + jumps ---
    let distTarget = 0;
    let heightTarget = 0;
    if (s.drifting) {
      distTarget += Math.min(3, (s.driftMult - 1) * 1.1);
      heightTarget += Math.min(1, (s.driftMult - 1) * 0.35);
    }
    if (s.airborne) {
      distTarget += 3.2;
      heightTarget += 1.8;
    }
    this.extraDist += (distTarget - this.extraDist) * Math.min(1, dt * 3.5);
    this.extraHeight += (heightTarget - this.extraHeight) * Math.min(1, dt * 3.5);

    // --- Speed-scaled distance & height (further/higher when fast) ---
    const speedN = Math.min(1, speed / 60);
    const dist = (m.distance + speedN * 2.4 + this.extraDist) * set.distance;
    const height = (m.height + speedN * 1.1 + this.extraHeight) * set.height + s.py;

    // Rig yaw (cinematic slowly orbits for a dramatic angle).
    let yaw = this.followHeading + this.driftYaw;
    if (m.id === "cinematic") {
      this.cineAngle += dt * 0.25;
      yaw += Math.sin(this.cineAngle) * 0.35;
    }
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);

    // Car forward (actual heading) for look target and attached views.
    const hfx = -Math.sin(s.heading);
    const hfz = -Math.cos(s.heading);

    // --- Desired camera position ---
    if (m.attached) {
      // Hood / cockpit: ride on the car, minimal lag.
      const fwd = m.distance; // negative = on hood front, positive = cabin
      _desired.set(
        s.px - hfx * fwd,
        s.py + m.height + s.carHeight * 0.2,
        s.pz - hfz * fwd,
      );
    } else {
      // Sit BEHIND the car (opposite its forward direction) so the road ahead
      // stays in view.
      _desired.set(s.px - fx * dist, height, s.pz - fz * dist);
    }

    // --- Collision: pull the camera in if a building blocks it ---
    if (!m.attached) {
      _anchor.set(s.px - hfx * 1.5, s.py + 1.6, s.pz - hfz * 1.5);
      const frac = this.clampToObstacles(_anchor.x, _anchor.z, _desired.x, _desired.z);
      if (frac < 1) {
        _desired.x = _anchor.x + (_desired.x - _anchor.x) * frac;
        _desired.z = _anchor.z + (_desired.z - _anchor.z) * frac;
      }
    }

    // Never dip below the ground / road surface.
    const minY = 1.4 + s.py * 0.4;
    if (_desired.y < minY) _desired.y = minY;

    // --- Smooth position transition (no sudden jumps) ---
    if (!this.initialized) {
      this.camera.position.copy(_desired);
      this.initialized = true;
    } else {
      const posLerp = Math.min(
        1,
        dt * (m.attached ? 14 : 6) * (0.6 + set.sensitivity * 0.6),
      );
      this.camera.position.lerp(_desired, posLerp);
    }

    // --- Shake (continuous at speed + impulses like hard landings) ---
    this.shake = Math.max(this.shake, s.shakeImpulse);
    if (set.shake) {
      const speedShake = Math.max(0, speedN - 0.55) * 0.5;
      const amp = this.shake * 1.1 + speedShake;
      if (amp > 0.001) {
        const t = this.clock * 40;
        this.camera.position.x += Math.sin(t * 1.3) * amp * 0.35;
        this.camera.position.y += Math.sin(t * 1.7 + 1.3) * amp * 0.35;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);

    // --- Look target: keep the car centred, look ahead down the road ---
    _look.set(
      s.px + hfx * m.lookAhead,
      s.py + m.lookHeight,
      s.pz + hfz * m.lookAhead,
    );
    if (!this.initialized) this.curLook.copy(_look);
    this.curLook.lerp(_look, Math.min(1, dt * (m.attached ? 16 : 8)));
    this.camera.lookAt(this.curLook);

    // --- Camera tilt (roll) into drift ---
    const rollTarget = -s.vl * 0.008 - this.driftYaw * 0.25;
    this.camRoll += (rollTarget - this.camRoll) * Math.min(1, dt * 4);
    this.camera.rotation.z += this.camRoll;

    // --- Dynamic FOV ---
    let targetFov = m.baseFov;
    if (set.dynamicFov) {
      targetFov += Math.min(16, speed * 0.22) + (s.nitro ? 8 : 0);
    }
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Returns the fraction (0..1) of the anchor→camera segment that is clear of
   * buildings; <1 means an obstacle sits between the car and the camera.
   */
  private clampToObstacles(ax: number, az: number, cx: number, cz: number): number {
    const dx = cx - ax;
    const dz = cz - az;
    let minT = 1;
    const margin = 0.8;
    for (const b of this.buildings) {
      const minx = b.x - b.halfX - margin;
      const maxx = b.x + b.halfX + margin;
      const minz = b.z - b.halfZ - margin;
      const maxz = b.z + b.halfZ + margin;
      let tmin = 0;
      let tmax = 1;
      // X slab
      if (Math.abs(dx) < 1e-6) {
        if (ax < minx || ax > maxx) continue;
      } else {
        let t1 = (minx - ax) / dx;
        let t2 = (maxx - ax) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Z slab
      if (Math.abs(dz) < 1e-6) {
        if (az < minz || az > maxz) continue;
      } else {
        let t1 = (minz - az) / dz;
        let t2 = (maxz - az) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (tmin >= 0 && tmin < minT) minT = tmin;
    }
    // Keep a minimum distance so the camera never enters the car.
    return Math.max(0.22, minT);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function lerpAngle(a: number, b: number, t: number) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

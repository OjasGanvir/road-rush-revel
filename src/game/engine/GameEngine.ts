import * as THREE from "three";
import type { CarDef } from "../config/cars";
import { buildCar } from "../entities/car";
import { getTimeOfDay, type TimeOfDayDef, type TimeOfDayId } from "../config/timeofday";
import { GameAudio } from "../audio/GameAudio";
import {
  buildWorld,
  isOnRoadAt,
  roadExtent,
  ROADS,
  WORLD_RADIUS,
  type WorldRefs,
  type Ramp,
  type Box,
} from "./world";
import {
  bankHeight,
  buildTrack,
  isOnTrackAt,
  nearestOval,
  ovalPoint,
  PIT,
  PIT_LAT_CENTRE,
  pitBoxPoint,
  pitLaneAt,
  TRACK,
} from "./track";
import { CameraController } from "./CameraController";
import {
  DEFAULT_CAMERA_MODE,
  DEFAULT_CAMERA_SETTINGS,
  type CameraModeId,
  type CameraSettings,
} from "../config/camera";

export type EngineConfig = {
  car: CarDef;
  paintColor: string;
  wheelId: string;
  nitroColor: string | null;
  upgrades: { handling: number; speed: number; grip: number; magnet: number; extraLife: number; nitro: number };
  timeOfDay: TimeOfDayId;
  muted: boolean;
  cameraMode?: CameraModeId;
  cameraSettings?: CameraSettings;
  /** "city" = open world, "track" = NASCAR oval speedway. */
  mode?: GameMode;
};

export type GameMode = "city" | "track";

export type Stats = {
  /** km/h display. */
  speed: number;
  /** Player world position, used by HUD elements such as the minimap. */
  x: number;
  z: number;
  /** Player yaw in radians, where 0 faces world -Z. */
  heading: number;
  /** Coins earned this session. */
  coins: number;
  /** Nitro charge 0..1. */
  nitro: number;
  /** True while sliding sideways. */
  drifting: boolean;
  /** Live (un-banked) drift score. */
  driftScore: number;
  /** Live drift multiplier. */
  driftMult: number;
  /** True while airborne. */
  airborne: boolean;
  /** Fuel level 0..1. */
  fuel: number;
  /** Overall tyre condition 0..1. */
  tyres: number;
};

export type ControlAction = "left" | "right" | "accel" | "reverse" | "handbrake" | "nitro";
export type PopupKind = "coin" | "drift" | "stunt";

export type EngineCallbacks = {
  onStats?: (s: Stats) => void;
  onPopup?: (text: string, kind: PopupKind) => void;
  onBankCoins?: (amount: number) => void;
  onDriftBanked?: (score: number) => void;
  onEvent?: (e: "coin" | "bump" | "nitro" | "stunt" | "drift") => void;
};

const WORLD_HALF = WORLD_RADIUS;
const GRAVITY = 30;
const MAX_PARTICLES = 220;
const MAX_SKIDS = 140;
const KMH = 3.0;
/** Maximum front-wheel steering angle (35°), shared by player and AI cars. */
const MAX_STEER = (35 * Math.PI) / 180;

/** THREE.js local -Z transformed by a root object's Y rotation. */
function forwardFromHeading(heading: number) {
  return { x: -Math.sin(heading), z: -Math.cos(heading) };
}

/** Heading for a root whose visual front is local -Z. */
function headingFromForward(x: number, z: number) {
  return Math.atan2(-x, -z);
}


type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  active: boolean;
  spin: number;
};

type Coin = { mesh: THREE.Mesh; active: boolean; respawn: number };
type Traffic = {
  group: THREE.Group;
  dir: THREE.Vector2;
  speed: number;
  cool: number;
  axis: "x" | "z";
  limit: number;
  /** Track mode: angle around the oval. */
  theta?: number;
  /** Track mode: lateral lane offset. */
  lane?: number;
  /** Fixed lateral coordinate of its lane (city roads). */
  laneCoord?: number;
  /** Smoothed body yaw (radians). */
  heading: number;
  /** Smoothed yaw velocity. */
  yawVel: number;
  /** Front-wheel steering angle (radians). */
  steer: number;
  /** Rolling animation accumulator. */
  spin: number;
  wheels: THREE.Mesh[];
  steerPivots: THREE.Group[];
  /** Track mode: seconds until this rival makes a pit stop. */
  pitIn?: number;
  /** Track mode: currently running through the pit lane. */
  pitting?: boolean;
  /** Cruising speed to return to after a pit stop. */
  baseSpeed?: number;
};

type Ped = { mesh: THREE.Mesh; vel: THREE.Vector2; t: number };

export class GameEngine {
  private container: HTMLElement;
  private cb: EngineCallbacks;
  private config: EngineConfig;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private ambient: THREE.AmbientLight;
  private dir: THREE.DirectionalLight;
  private clock = new THREE.Clock();
  private raf = 0;
  private audio: GameAudio;

  private player!: THREE.Group;
  private playerWheels: THREE.Mesh[] = [];
  private playerSteerPivots: THREE.Group[] = [];
  private playerWheelR = 0.34;
  private wheelSpin = 0;
  private yawVel = 0;
  private routeGroup = new THREE.Group();
  private routeGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00bfff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  private routeCoreMat = new THREE.MeshBasicMaterial({
    color: 0x63edff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  private blobShadow!: THREE.Mesh;
  private world!: WorldRefs;
  private buildings: Box[] = [];
  private ramps: Ramp[] = [];
  private sand: Box[] = [];

  private particles: Particle[] = [];
  private skids: THREE.Mesh[] = [];
  private skidIdx = 0;
  private coins: Coin[] = [];
  private traffic: Traffic[] = [];
  private peds: Ped[] = [];
  private tod: TimeOfDayDef;

  // ---- Car physics state (world space) ----
  private px = 0;
  private pz = 0;
  private py = 0; // height above ground
  private heading = 0; // yaw, 0 = facing -z
  private vf = 0; // forward speed
  private vl = 0; // lateral slip
  private vy = 0; // vertical velocity
  private steerInput = 0;
  private steerAngle = 0; // actual front-wheel angle (radians)
  private latAccel = 0; // cornering force proxy (for body roll)
  private steerAxis = 0; // analog steering wheel (-1..1)
  private airborne = false;
  private airRoll = 0; // visual roll while airborne
  private airSpin = 0; // accumulated |heading change| while airborne
  private airTime = 0;
  private jumpArmed = true;

  // ---- Vehicle body dynamics (visual weight transfer / suspension) ----
  private bodyRoll = 0; // smoothed lean into corners (radians)
  private bodyPitch = 0; // smoothed nose dip/squat (radians)
  private susp = 0; // suspension vertical offset (metres, <0 = compressed)
  private suspVel = 0; // suspension spring velocity
  private surfaceGrip = 1; // current surface grip multiplier (1 = asphalt)
  private lastVf = 0; // previous forward speed (for longitudinal g)
  private bankRollVis = 0; // smoothed banking roll
  private bankPitchVis = 0; // smoothed banking pitch

  // Drift scoring
  private driftScore = 0;
  private driftMult = 1;
  private driftActive = false;
  private driftGrace = 0;

  // Runtime
  private running = false;
  private paused = false;
  private nitroCharge = 1;
  private shake = 0;
  private fov = 62;
  private slowmo = 1;
  private statsTimer = 0;
  private skidTimer = 0;
  private smokeTimer = 0;
  private camCtl!: CameraController;
  private nearMissCool = 0;

  private ctl = {
    left: false, right: false, accel: false, reverse: false, handbrake: false, nitro: false,
  };
  private keyState = {
    left: false, right: false, accel: false, reverse: false, handbrake: false, nitro: false,
  };

  constructor(container: HTMLElement, config: EngineConfig, cb: EngineCallbacks) {
    this.container = container;
    this.config = config;
    this.cb = cb;
    this.tod = getTimeOfDay(config.timeOfDay);
    this.audio = new GameAudio(config.muted);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.routeGroup.renderOrder = 5;
    this.scene.add(this.routeGroup);
    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      1400,
    );

    this.ambient = new THREE.AmbientLight(0xffffff, this.tod.ambient);
    this.scene.add(this.ambient);
    this.dir = new THREE.DirectionalLight(0xffffff, this.tod.lightIntensity);
    this.dir.position.set(-40, 80, 30);
    this.scene.add(this.dir);

    this.buildPlayer();
    this.world =
      config.mode === "track" ? buildTrack(this.scene, this.tod) : buildWorld(this.scene, this.tod);
    this.buildings = this.world.buildings;
    this.ramps = this.world.ramps;
    this.sand = this.world.sand;
    this.initPools();
    this.buildCoins();
    this.buildTraffic();
    this.buildPeds();
    this.applyTimeOfDay(this.tod);

    this.camCtl = new CameraController(
      this.camera,
      this.buildings,
      config.cameraSettings ?? DEFAULT_CAMERA_SETTINGS,
      config.cameraMode ?? DEFAULT_CAMERA_MODE,
    );
    this.fov = this.camera.fov;

    const spawn = this.spawnPoint();
    this.px = spawn.x;
    this.pz = spawn.z;
    this.heading = spawn.heading;
    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.y = this.heading;

    this.attachInput();
    window.addEventListener("resize", this.onResize);
  }

  /** Start position: origin in the city, the start/finish line on the oval. */
  private spawnPoint() {
    if (!this.isTrackMode) return { x: 0, z: 0, heading: 0 };
    const p = ovalPoint(Math.PI / 2, 0);
    return { x: p.x, z: p.z, heading: headingFromForward(p.tx, p.tz) };
  }

  private get isTrackMode() {
    return this.config.mode === "track";
  }

  // ---------- Build ----------
  private buildPlayer() {
    this.player = buildCar({
      car: this.config.car,
      paintColor: this.config.paintColor,
      wheelId: this.config.wheelId,
    });
    this.playerWheels = (this.player.userData.wheels as THREE.Mesh[]) ?? [];
    this.playerSteerPivots = (this.player.userData.steerPivots as THREE.Group[]) ?? [];
    this.playerWheelR = (this.player.userData.wheelRadius as number) ?? 0.34;

    this.scene.add(this.player);

    const shadowGeo = new THREE.CircleGeometry(2, 20);
    shadowGeo.rotateX(-Math.PI / 2);
    this.blobShadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
    );
    this.blobShadow.position.y = 0.02;
    this.scene.add(this.blobShadow);
  }

  private initPools() {
    const pGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false;
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, active: false, spin: 0 });
    }
    const skidGeo = new THREE.PlaneGeometry(0.28, 0.7);
    skidGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SKIDS; i++) {
      const m = new THREE.Mesh(
        skidGeo,
        new THREE.MeshBasicMaterial({ color: 0x1a1a1e, transparent: true, opacity: 0 }),
      );
      m.visible = false;
      m.position.y = 0.015;
      this.scene.add(m);
      this.skids.push(m);
    }
  }

  private buildCoins() {
    const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.14, 14);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshToonMaterial({ color: 0xffcf3f });
    const positions: [number, number][] = [];
    if (this.isTrackMode) {
      return;
    }
    // Scatter along the straight roads
    for (let i = 0; i < 90; i++) {
      const r = ROADS[Math.floor(Math.random() * ROADS.length)];
      const ext = roadExtent(r.pos) - 15;
      if (ext <= 0) continue;
      const along = (Math.random() * 2 - 1) * ext;
      const lat = r.pos + (Math.random() * 2 - 1) * (r.half - 3);
      positions.push(r.axis === "z" ? [along, lat] : [lat, along]);
    }
    // Trail along the outer ring road
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      positions.push([Math.cos(ang) * 235, Math.sin(ang) * 235]);
    }
    // Stunt park ring
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      positions.push([-150 + Math.cos(ang) * 22, 150 + Math.sin(ang) * 22]);
    }
    for (const [x, z] of positions) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(x, 0.9, z);
      this.scene.add(m);
      this.coins.push({ mesh: m, active: true, respawn: 0 });
    }
  }

  /** Wheels for an NPC car: pivots so the front pair can steer independently. */
  private buildNpcWheels(g: THREE.Group) {
    const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
    geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshToonMaterial({ color: 0x18181b });
    const wheels: THREE.Mesh[] = [];
    const steerPivots: THREE.Group[] = [];
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * 0.82, 0.32, sz * 0.95);
        const m = new THREE.Mesh(geo, mat);
        pivot.add(m);
        g.add(pivot);
        wheels.push(m);
        if (sz === -1) steerPivots.push(pivot);
      }
    }
    return { wheels, steerPivots };
  }

  private buildTraffic() {
    const colors = [0x6bcb77, 0x00c2d1, 0xff6fa5, 0xf8f9fa, 0xff9f45, 0xc56bff];
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const col = colors[i % colors.length];
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3), new THREE.MeshToonMaterial({ color: col }));
      body.position.y = 0.7;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.4), new THREE.MeshToonMaterial({ color: 0x22252e }));
      cabin.position.y = 1.15;
      g.add(cabin);
      const { wheels, steerPivots } = this.buildNpcWheels(g);
      if (this.isTrackMode) {
        const cruise = 22 + Math.random() * 14;
        const theta = (i / 12) * Math.PI * 2;
        const lane = (i % 3) * 7 - 7;
        const p = ovalPoint(theta, lane);
        g.position.set(p.x, p.y, p.z);
        const heading = headingFromForward(p.tx, p.tz);
        g.rotation.y = heading;
        this.scene.add(g);
        this.traffic.push({
          group: g,
          dir: new THREE.Vector2(p.tx, p.tz),
          speed: cruise,
          baseSpeed: cruise,
          cool: 0,
          axis: "x",
          limit: 0,
          theta,
          lane,
          heading,
          yawVel: 0,
          steer: 0,
          spin: 0,
          wheels,
          steerPivots,
          pitIn: 25 + Math.random() * 60,
          pitting: false,
        });
        continue;
      }
      const r = ROADS[i % ROADS.length];
      const limit = roadExtent(r.pos) - 12;
      if (limit <= 0) continue;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const along = (Math.random() * 2 - 1) * limit;
      const lat = r.pos + sign * (r.half * 0.45);
      g.position.set(
        r.axis === "z" ? along : lat,
        0,
        r.axis === "z" ? lat : along,
      );
      const dir =
        r.axis === "z" ? new THREE.Vector2(sign, 0) : new THREE.Vector2(0, sign);
      const heading = headingFromForward(dir.x, dir.y);
      g.rotation.y = heading;
      this.scene.add(g);
      this.traffic.push({
        group: g,
        dir,
        speed: 14 + Math.random() * 12,
        cool: 0,
        axis: r.axis,
        limit,
        laneCoord: lat,
        heading,
        yawVel: 0,
        steer: 0,
        spin: 0,
        wheels,
        steerPivots,
      });
    }

  }

  private buildPeds() {
    if (this.isTrackMode) return;
    const geo = new THREE.CapsuleGeometry(0.22, 0.6, 3, 6);
    const cols = [0xff5a5f, 0x4d7cff, 0xffcf3f, 0x6bcb77, 0xffffff];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: cols[i % cols.length] }));
      const r = ROADS[i % ROADS.length];
      const ext = roadExtent(r.pos) - 25;
      if (ext <= 0) continue;
      const along = (Math.random() * 2 - 1) * ext;
      const lat = r.pos + (Math.random() > 0.5 ? 1 : -1) * (r.half + 4);
      m.position.set(r.axis === "z" ? along : lat, 0.6, r.axis === "z" ? lat : along);
      this.scene.add(m);
      const ang = Math.random() * Math.PI * 2;
      this.peds.push({ mesh: m, vel: new THREE.Vector2(Math.cos(ang), Math.sin(ang)).multiplyScalar(1.2), t: 0 });
    }
  }


  private applyTimeOfDay(t: TimeOfDayDef) {
    this.tod = t;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(new THREE.Color(t.fog), t.fogNear, t.fogFar);
    this.ambient.intensity = t.ambient;
    this.dir.color = new THREE.Color(t.light);
    this.dir.intensity = t.lightIntensity;
    this.world.applyTimeOfDay(t);
  }

  setTimeOfDay(id: TimeOfDayId) {
    this.applyTimeOfDay(getTimeOfDay(id));
  }

  // ---------- Input ----------
  private attachInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private keyAction(e: KeyboardEvent): ControlAction | null {
    switch (e.key) {
      case "ArrowLeft": case "a": case "A": return "left";
      case "ArrowRight": case "d": case "D": return "right";
      case "ArrowUp": case "w": case "W": return "accel";
      case "ArrowDown": case "s": case "S": return "reverse";
      case " ": case "Spacebar": return "handbrake";
      case "Shift": return "nitro";
      default: return null;
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const a = this.keyAction(e);
    if (!a) return;
    e.preventDefault();
    this.keyState[a] = true;
    this.audio.ensureStarted();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const a = this.keyAction(e);
    if (!a) return;
    this.keyState[a] = false;
  };

  setControl(action: ControlAction, active: boolean) {
    this.ctl[action] = active;
    if (active) this.audio.ensureStarted();
  }

  /** Analog steering from the on-screen wheel (-1..1). */
  setSteerAxis(v: number) {
    this.steerAxis = Math.max(-1, Math.min(1, v));
    this.audio.ensureStarted();
  }

  setMuted(muted: boolean) {
    this.config.muted = muted;
    this.audio.setMuted(muted);
  }

  setCameraMode(mode: CameraModeId) {
    this.camCtl.setMode(mode);
  }
  getCameraMode(): CameraModeId {
    return this.camCtl.getMode();
  }
  setCameraSettings(patch: Partial<CameraSettings>) {
    this.camCtl.updateSettings(patch);
  }

  /** Draw the current road route directly on the driving surface. */
  setRoute(points: Array<{ x: number; z: number }> | null) {
    this.clearRoute();
    if (!points || points.length < 2) return;

    const validPoints = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
    if (validPoints.length < 2) return;
    this.routeGroup.add(new THREE.Mesh(this.routeStripGeometry(validPoints, 1.8), this.routeGlowMat));
    this.routeGroup.add(new THREE.Mesh(this.routeStripGeometry(validPoints, 0.72), this.routeCoreMat));
  }

  private clearRoute() {
    while (this.routeGroup.children.length) {
      const child = this.routeGroup.children.pop();
      if (!child) continue;
      child.parent = null;
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
    }
  }

  private routeStripGeometry(points: Array<{ x: number; z: number }>, width: number) {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexCount = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const half = width / 2;
      const nx = (-dz / length) * half;
      const nz = (dx / length) * half;
      const ay = this.routeHeightAt(a.x, a.z);
      const by = this.routeHeightAt(b.x, b.z);
      positions.push(
        a.x + nx, ay, a.z + nz,
        a.x - nx, ay, a.z - nz,
        b.x - nx, by, b.z - nz,
        b.x + nx, by, b.z + nz,
      );
      indices.push(
        vertexCount, vertexCount + 1, vertexCount + 2,
        vertexCount, vertexCount + 2, vertexCount + 3,
      );
      vertexCount += 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
  }

  private routeHeightAt(x: number, z: number) {
    if (!this.isTrackMode) return 0.095;
    return nearestOval(x, z).y + 0.18;
  }

  private input(a: ControlAction): boolean {
    return this.ctl[a] || this.keyState[a];
  }

  // ---------- Lifecycle ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.clock.start();
    this.loop();
  }

  pause() {
    this.paused = true;
    this.audio.engine(0, false);
    this.audio.drift(false, 0);
    this.audio.nitro(false);
  }
  resume() {
    this.paused = false;
    this.clock.getDelta();
  }

  respawn() {
    const spawn = this.spawnPoint();
    this.px = spawn.x; this.pz = spawn.z; this.py = 0;
    this.heading = spawn.heading; this.vf = 0; this.vl = 0; this.vy = 0;
    this.steerAngle = 0; this.steerInput = 0; this.latAccel = 0; this.yawVel = 0;
    this.airborne = false; this.airRoll = 0; this.airSpin = 0; this.airTime = 0;
    this.driftScore = 0; this.driftMult = 1; this.driftActive = false;
    this.bodyRoll = 0; this.bodyPitch = 0; this.susp = 0; this.suspVel = 0; this.lastVf = 0;
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    let dt = this.clock.getDelta();
    if (dt > 0.05) dt = 0.05;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  // ---------- Update ----------
  private update(dt: number) {
    // slow-motion easing (for big drifts/stunts)
    this.slowmo += ((this.slowmoTarget) - this.slowmo) * Math.min(1, dt * 6);
    const sdt = dt * this.slowmo;

    this.updateDriving(sdt);
    this.updateDriftScore(sdt);
    this.updateCoins(sdt);
    this.updateTraffic(sdt);
    this.updatePeds(sdt);
    this.updateParticles(dt);
    this.updateSkidFade(dt);
    this.updateCamera(dt);
    this.updateAudio();
    this.updateWear(sdt);

    this.statsTimer += dt;
    if (this.statsTimer >= 0.08) {
      this.statsTimer = 0;
      this.cb.onStats?.({
        speed: Math.round(Math.abs(this.vf) * KMH),
        x: this.px,
        z: this.pz,
        heading: this.heading,
        coins: this.sessionCoins,
        nitro: this.nitroCharge,
        drifting: this.driftActive,
        driftScore: Math.round(this.driftScore * this.driftMult),
        driftMult: Math.round(this.driftMult * 10) / 10,
        airborne: this.airborne,
        fuel: this.fuel,
        tyres: this.tyres,
      });
    }
  }

  /** Fuel level 0..1 — burns with throttle, speed and nitro. */
  private fuel = 1;
  /** Overall tyre condition 0..1 — wears with sliding, braking and speed. */
  private tyres = 1;
  private lowFuelWarned = false;
  private lowTyreWarned = false;

  /** Consumable wear model: light, purely arcade-paced. */
  private updateWear(dt: number) {
    const spd = Math.abs(this.vf);
    const throttle = this.input("accel") ? 1 : 0.25;
    const burn = (0.0016 + spd * 0.000075 * throttle + (this.nitroWasOn ? 0.006 : 0)) * dt * 60 * 0.016;
    this.fuel = Math.max(0, this.fuel - burn);

    const slide = Math.min(1, Math.abs(this.vl) / 12);
    const wear = (0.0006 + spd * 0.00002 + slide * 0.0035) * dt * 60 * 0.016;
    this.tyres = Math.max(0, this.tyres - wear);

    if (this.fuel < 0.15 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.cb.onPopup?.("LOW FUEL", "stunt");
    } else if (this.fuel > 0.2) this.lowFuelWarned = false;

    if (this.tyres < 0.2 && !this.lowTyreWarned) {
      this.lowTyreWarned = true;
      this.cb.onPopup?.("PIT FOR TIRES", "stunt");
    } else if (this.tyres > 0.25) this.lowTyreWarned = false;
  }

  private slowmoTarget = 1;
  private sessionCoins = 0;

  private updateDriving(dt: number) {
    const car = this.config.car;
    const upg = this.config.upgrades;

    const left = this.input("left");
    const right = this.input("right");
    const throttle = this.input("accel");
    const reverse = this.input("reverse");
    const handbrake = this.input("handbrake");

    // Nitro
    const wantNitro = this.input("nitro") && this.nitroCharge > 0.02 && this.vf > 3 && !this.airborne;
    if (wantNitro) {
      this.nitroCharge = Math.max(0, this.nitroCharge - dt / (2.6 + upg.nitro * 0.6));
      if (!this.nitroWasOn) this.cb.onEvent?.("nitro");
    } else {
      this.nitroCharge = Math.min(1, this.nitroCharge + dt / 7);
    }
    this.audio.nitro(wantNitro);
    this.nitroWasOn = wantNitro;
    const boost = wantNitro ? 1 + 0.35 * car.nitroStrength : 1;

    // Surface grip: asphalt (1) > grass (0.72) > sand (0.5). Wet reduces further.
    const surface = this.surfaceAt(this.px, this.pz);
    this.surfaceGrip = surface.grip;
    const tune = this.classTuning();

    // ---- Pit lane + pit stop service (track mode) ----
    if (this.isTrackMode && this.updatePit(dt)) {
      this.applyVisual();
      return;
    }

    // ---- Banking: extra tyre load through the turns, gravity down the slope ----
    let bankGrip = 1;
    if (this.isTrackMode && !this.airborne) {
      const tilt = this.surfaceTilt();
      if (Math.abs(tilt.bank) > 0.005) {
        bankGrip = 1 + Math.sin(Math.abs(tilt.bank)) * 1.6;
        this.vl -= tilt.roll * GRAVITY * 0.075 * dt;
      }
    }
    this.surfaceGrip *= bankGrip;

    if (this.airborne) {
      // ---- Airborne physics: very limited control, no free spinning ----
      this.vy -= GRAVITY * dt;
      this.py += this.vy * dt;
      this.airTime += dt;
      // Tiny yaw authority only — cannot pirouette in the air.
      const steer = this.steerVal(left, right);
      const airAuthority = 0.7; // rad/s max (was 3.2)
      this.heading += steer * airAuthority * dt;
      this.airSpin += Math.abs(steer * airAuthority * dt);
      this.airRoll += dt * 1.4;
      // integrate horizontal momentum (keep velocity)
      this.integrateHorizontal(dt);
      if (this.py <= this.groundHeightAt(this.px, this.pz)) {
        this.land();
      }
      this.applyVisual();
      return;
    }

    // ---- Grounded physics ----
    const speedBonus = 1 + upg.speed * 0.04;
    const accelBonus = 1 + upg.speed * 0.03;
    const maxFwd = car.topSpeed * boost * speedBonus;
    const maxRev = car.topSpeed * 0.42;
    const v = this.vf;
    // Progressive acceleration: engine power tapers as we approach top speed,
    // so cars build up speed gradually instead of snapping to max.
    const speedRatio = Math.max(0, v) / maxFwd;
    const powerCurve = 1 - 0.55 * speedRatio;
    if (reverse && v > 1) {
      // Reverse pedal acts as the brake while moving forward. Braking is
      // powerful but takes more distance from high speed (constant force).
      const brakeForce = car.accel * 2.1;
      this.vf -= brakeForce * dt;
      if (this.vf < 0) this.vf = 0;
    } else if (throttle) {
      this.vf += car.accel * dt * boost * powerCurve * accelBonus;
    } else if (reverse) {
      this.vf -= car.accel * 0.55 * dt;
    } else {
      // Engine braking + rolling resistance (light).
      this.vf -= this.vf * Math.min(1, dt * 0.5);
    }
    if (handbrake) this.vf -= this.vf * Math.min(1, dt * 1.0);
    // Rougher surfaces scrub speed.
    this.vf -= this.vf * Math.min(1, dt * surface.drag);
    this.vf = Math.max(-maxRev, Math.min(maxFwd, this.vf));

    if (this.fuel < 0.05 && Math.abs(this.vf) > 10.5) {
      const limiter = this.vf > 0 ? 10.5 : -10.5;
      this.vf += (limiter - this.vf) * Math.min(1, dt * 3.5);
    }

    // ---- Steering: bicycle model (steer angle -> yaw rate) ----
    const steer = this.steerVal(left, right);
    const speedAbs = Math.abs(this.vf);

    // Smoothed input with self-centering: turn-in is quick, release is quicker.
    const centering = Math.abs(steer) < Math.abs(this.steerInput) || steer === 0;
    const inputRate = centering ? 13 : 8 + 3 / car.weight;
    this.steerInput += (steer - this.steerInput) * Math.min(1, dt * inputRate);
    if (Math.abs(this.steerInput) < 0.001) this.steerInput = 0;

    // Steering lock shrinks with speed so fast corners stay stable but still
    // responsive (no harsh divide that made high speed feel "stuck").
    const maxLock = Math.min(MAX_STEER, 0.26 + car.turnRate * 0.06);
    const lockScale = 0.24 + 0.76 / (1 + speedAbs * 0.09);
    const targetAngle = Math.max(
      -MAX_STEER,
      Math.min(MAX_STEER, -this.steerInput * maxLock * lockScale * (handbrake ? 1.25 : 1)),
    );
    // Front wheels themselves take a moment to reach the commanded angle
    // (~0.2s to settle), so they visibly turn before the body follows.
    this.steerAngle += (targetAngle - this.steerAngle) * Math.min(1, dt * (11 / car.weight));

    // Yaw rate from wheelbase: the car carves a consistent arc at any speed.
    const wheelbase = 4.2 * (0.85 + car.weight * 0.15);
    const dirSign = this.vf >= 0 ? 1 : -1;
    let yawRate = (speedAbs * Math.tan(this.steerAngle)) / wheelbase;
    // Low-speed pivot assist so U-turns / parking still rotate the car.
    const crawl = 1 - Math.min(1, speedAbs / 7);
    yawRate += this.steerAngle * 1.5 * crawl * Math.min(1, speedAbs / 1.2);
    yawRate = Math.max(-3.0, Math.min(3.0, yawRate));
    const speedStability = 0.78 + 0.22 / (1 + speedAbs * 0.05);
    yawRate *= speedStability * (1 + upg.handling * 0.04 + upg.grip * 0.01) * (handbrake ? 1.25 : 1);
    // Angular velocity with inertia — the body eases into and out of the turn
    // instead of snapping to the commanded yaw rate.
    const yawTarget = yawRate * dirSign;
    this.yawVel += (yawTarget - this.yawVel) * Math.min(1, dt * (9 / car.weight));
    this.heading += this.yawVel * dt;


    // ---- Grip: cornering force vs. tyre limit -> slide when exceeded ----
    let grip = car.grip * (1 + upg.handling * 0.03 + upg.grip * 0.04) * surface.grip;
    if (handbrake) grip *= 0.2 + (1 - car.drift) * 0.16;
    // Counter-steering (steering opposite the slide) restores grip and keeps
    // the drift controllable rather than spinning out.
    const counterSteer =
      Math.sign(this.steerInput) === -Math.sign(this.vl) && Math.abs(this.steerInput) > 0.1;
    if (counterSteer) grip *= 1 + 0.6 * car.driftControl;

    // Required lateral acceleration to follow the arc; the tyres can only
    // supply so much before the car starts sliding outward.
    const latReq = Math.abs(yawRate) * speedAbs;
    this.latAccel = latReq * Math.sign(this.steerAngle || this.steerInput);
    const gripCap = grip * bankGrip * 9 * (handbrake ? 0.35 : 1);
    const excess = Math.max(0, latReq - gripCap);
    const slipGain = handbrake ? 1.6 * car.drift : 0.55;
    this.vl +=
      Math.sign(this.steerAngle || this.steerInput) *
      excess *
      dt *
      slipGain *
      (1 / car.driftControl);
    this.vl -= this.vl * Math.min(1, grip * dt);


    // Integrate position
    this.integrateHorizontal(dt);

    // Ground / ramp height
    const gh = this.groundHeightAt(this.px, this.pz);
    const rampInfo = this.rampAt(this.px, this.pz);
    if (rampInfo && rampInfo.progress > 0.86 && this.vf > 16 && this.jumpArmed) {
      // Launch off ramp
      this.airborne = true;
      this.jumpArmed = false;
      this.vy = this.vf * (rampInfo.ramp.height / rampInfo.ramp.length) * 1.15 + 3;
      this.py = gh;
      this.airSpin = 0;
      this.airTime = 0;
    } else {
      this.py = gh;
      if (!rampInfo) this.jumpArmed = true;
    }

    // Building collisions (arcade bump)
    this.resolveBuildings();

    if (this.isTrackMode) {
      this.confineToTrack(dt);
    } else {
      // Circular island boundary — the car slides along the shoreline
      const bR = (this.world?.radius ?? WORLD_HALF) - 8;
      const dr = Math.hypot(this.px, this.pz);
      if (dr > bR) {
        const nx = this.px / dr;
        const nz = this.pz / dr;
        this.px = nx * bR;
        this.pz = nz * bR;
        this.slideAlongNormal(nx, nz, 0.995);
      }
    }


    // Drift smoke + skid marks
    const sliding = this.isDrifting();
    this.driftActive = sliding;
    if (sliding && Math.abs(this.vf) > 8) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.03;
        this.spawnSmoke();
      }
      this.skidTimer -= dt;
      if (this.skidTimer <= 0) {
        this.skidTimer = 0.02;
        this.dropSkid();
      }
    }
    this.audio.drift(sliding && Math.abs(this.vf) > 8, Math.min(1, Math.abs(this.vl) / 20));

    // Nitro trail particles
    if (this.nitroWasOn) this.spawnNitroTrail();

    // ---- Body dynamics: roll into corners + weight transfer pitch ----
    // Real cornering force drives the lean, so it matches the corner.
    const rollTarget = -this.latAccel * 0.2 * tune.roll;
    this.bodyRoll += (rollTarget - this.bodyRoll) * Math.min(1, dt * 6);
    // Longitudinal g: braking dips the nose, accelerating squats the rear.
    const longAccel = (this.vf - this.lastVf) / Math.max(dt, 1e-3);
    this.lastVf = this.vf;
    const pitchTarget = Math.max(-0.08, Math.min(0.08, -longAccel * 0.004));
    this.bodyPitch += (pitchTarget - this.bodyPitch) * Math.min(1, dt * 5);
    // Suspension spring settles back to rest (also handles landing bounce).
    this.updateSuspension(dt, tune.suspSoft);

    this.applyVisual();
  }

  /** Critically-ish damped suspension spring; softer cars bounce more. */
  private updateSuspension(dt: number, soft: number) {
    const k = 90 / soft; // stiffness
    const damp = 14 / Math.sqrt(soft); // damping
    this.suspVel += (-this.susp * k - this.suspVel * damp) * dt;
    this.susp += this.suspVel * dt;
  }


  private nitroWasOn = false;

  private steerVal(left: boolean, right: boolean): number {
    const digital = (right ? 1 : 0) - (left ? 1 : 0);
    if (Math.abs(this.steerAxis) > 0.02) return this.steerAxis;
    return digital;
  }

  private integrateHorizontal(dt: number) {
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    const wx = fx * this.vf + rx * this.vl;
    const wz = fz * this.vf + rz * this.vl;
    this.px += wx * dt;
    this.pz += wz * dt;
  }

  /**
   * Removes only the velocity component pushing into a wall so the car keeps
   * gliding along the barrier instead of sticking to it.
   */
  private slideAlongNormal(nx: number, nz: number, friction = 0.99) {
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    let wx = fx * this.vf + rx * this.vl;
    let wz = fz * this.vf + rz * this.vl;
    const into = wx * nx + wz * nz;
    if (into > 0) {
      wx -= nx * into;
      wz -= nz * into;
    }
    wx *= friction;
    wz *= friction;
    this.vf = wx * fx + wz * fz;
    this.vl = wx * rx + wz * rz;
  }

  private land() {
    this.airborne = false;
    this.py = this.groundHeightAt(this.px, this.pz);
    const impact = Math.min(1, Math.abs(this.vy) / 22);
    this.vy = 0;
    this.airRoll = 0;
    // Suspension absorbs the impact — compress hard, then bounce back.
    const soft = this.classTuning().suspSoft;
    this.suspVel = -(6 + impact * 12) * soft;
    // Hard landings shake the camera proportional to impact speed.
    this.shake = Math.min(1, this.shake + 0.25 + impact * 0.5);
    this.cb.onEvent?.("bump");


    // Award stunt score
    const spins = Math.floor(this.airSpin / (Math.PI * 2));
    let bonus = 0;
    let label = "";
    if (this.airTime > 0.35) {
      bonus += Math.round(this.airTime * 120);
      label = "AIR TIME";
    }
    if (spins >= 1) {
      bonus += spins * 300;
      label = spins >= 2 ? `${spins}x SPIN!` : "360 SPIN!";
    }
    if (bonus > 0) {
      const coins = Math.max(1, Math.round(bonus / 20));
      this.sessionCoins += coins;
      this.cb.onBankCoins?.(coins);
      this.cb.onPopup?.(`${label} +${coins}`, "stunt");
      this.cb.onEvent?.("stunt");
      this.audio.stunt();
      if (spins >= 1 || this.airTime > 0.9) this.triggerSlowmo();
    }
  }

  private triggerSlowmo() {
    this.slowmoTarget = 0.45;
    setTimeout(() => (this.slowmoTarget = 1), 550);
  }

  private isDrifting(): boolean {
    return Math.abs(this.vl) > 5 && Math.abs(this.vf) > 10 && !this.airborne;
  }

  private updateDriftScore(dt: number) {
    if (this.driftActive) {
      const slip = Math.abs(this.vl);
      this.driftScore += slip * Math.abs(this.vf) * dt * 0.35;
      this.driftMult = Math.min(6, 1 + this.driftScore / 800);
      this.driftGrace = 0.6;
    } else if (this.driftGrace > 0) {
      this.driftGrace -= dt;
      if (this.driftGrace <= 0) this.bankDrift();
    }
  }

  private bankDrift() {
    const total = this.driftScore * this.driftMult;
    if (total > 120) {
      const coins = Math.max(4, Math.round(total / 24));
      this.sessionCoins += coins;
      this.cb.onBankCoins?.(coins);
      this.cb.onDriftBanked?.(total);
      this.cb.onPopup?.(`DRIFT +${coins}`, "drift");
      this.cb.onEvent?.("drift");
      if (total > 6000) this.triggerSlowmo();
    }
    this.driftScore = 0;
    this.driftMult = 1;
  }

  // ---------- World queries ----------
  private groundHeightAt(x: number, z: number): number {
    if (this.isTrackMode) return this.trackHeightAt(x, z);
    const r = this.rampAt(x, z);
    return r ? r.progress * r.ramp.height : 0;
  }

  /** Banked-surface height for the oval (flat straights, raised corners). */
  private trackHeightAt(x: number, z: number): number {
    const n = nearestOval(x, z);
    const lat = Math.max(-TRACK.half, Math.min(TRACK.half, n.lat));
    return bankHeight(n.theta, lat);
  }

  /**
   * Local slope of the banked surface expressed in the car frame:
   * how much the body should pitch (nose up) and roll (right side up).
   */
  private surfaceTilt(): { pitch: number; roll: number; bank: number; nx: number; nz: number } {
    if (!this.isTrackMode) return { pitch: 0, roll: 0, bank: 0, nx: 0, nz: 0 };
    const n = nearestOval(this.px, this.pz);
    const lat = Math.max(-TRACK.half, Math.min(TRACK.half, n.lat));
    const d = 0.6;
    const bank = Math.atan2(bankHeight(n.theta, lat + d) - bankHeight(n.theta, lat - d), d * 2);
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    return {
      pitch: bank * (n.nx * fx + n.nz * fz),
      roll: bank * (n.nx * rx + n.nz * rz),
      bank,
      nx: n.nx,
      nz: n.nz,
    };
  }

  private rampAt(x: number, z: number): { ramp: Ramp; progress: number } | null {
    for (const ramp of this.ramps) {
      const dx = x - ramp.x;
      const dz = z - ramp.z;
      const along = dx * ramp.dx + dz * ramp.dz;
      const lat = dx * -ramp.dz + dz * ramp.dx;
      if (along >= 0 && along <= ramp.length && Math.abs(lat) <= ramp.halfW) {
        return { ramp, progress: along / ramp.length };
      }
    }
    return null;
  }

  /**
   * Pit lane behaviour: automatic speed limiter, and a fast scripted stop
   * (fuel + four tyres + inspection) when the car halts inside a pit box.
   * Returns true while the car is frozen for service.
   */
  private updatePit(dt: number): boolean {
    if (this.pitMsgCool > 0) this.pitMsgCool -= dt;

    // Service in progress — the crew works, the car stays put.
    if (this.pitTimer > 0) {
      this.pitTimer -= dt;
      this.vf = 0;
      this.vl = 0;
      const stage = Math.floor(((PIT.serviceTime - this.pitTimer) / PIT.serviceTime) * 3);
      if (stage !== this.pitStage) {
        this.pitStage = stage;
        const labels = ["JACK UP · FUEL IN", "4 TYRES CHANGED", "INSPECTION OK"];
        this.cb.onPopup?.(labels[Math.min(2, stage)], "stunt");
        this.cb.onEvent?.("coin");
      }
      if (this.pitTimer <= 0) {
        this.nitroCharge = 1;
        this.fuel = 1;
        this.tyres = 1;
        this.pitDone = true;
        this.cb.onPopup?.("PIT STOP COMPLETE — GO!", "stunt");
      }
      return true;
    }

    const pit = pitLaneAt(this.px, this.pz);
    if (!pit.inLane) {
      this.inPitLane = false;
      this.pitDone = false;
      return false;
    }
    if (!this.inPitLane) {
      this.inPitLane = true;
      this.cb.onPopup?.("PIT LANE — LIMITER ON", "stunt");
    }
    // Automatic pit-lane speed limiter.
    if (this.vf > PIT.speedLimit) this.vf += (PIT.speedLimit - this.vf) * Math.min(1, dt * 3.5);
    if (this.vf < -PIT.speedLimit * 0.5) this.vf = -PIT.speedLimit * 0.5;

    // Stopped in a box -> service starts automatically.
    if (pit.box === 0 && !this.pitDone && Math.abs(this.vf) < 4) {
      const box = pitBoxPoint(pit.box);
      this.px = box.x;
      this.pz = box.z;
      this.pitTimer = PIT.serviceTime;
      this.pitStage = -1;
      this.vf = 0;
      this.vl = 0;
    }
    return false;
  }

  /**
   * Track mode: soft outer wall only (the inside of the oval is open) and the
   * anti-clockwise racing direction.
   */
  private confineToTrack(dt: number) {
    const near = nearestOval(this.px, this.pz);
    const limit = TRACK.half - 1.6;
    if (near.lat > limit) {
      this.px = near.x + near.nx * limit;
      this.pz = near.z + near.nz * limit;
      this.slideAlongNormal(near.nx, near.nz, 0.995);
      if (this.wallCool <= 0) {
        this.wallCool = 0.6;
        this.shake = Math.min(0.15, this.shake + 0.06);
        this.cb.onEvent?.("bump");
      }
    }
    if (this.wallCool > 0) this.wallCool -= dt;

    // Wrong-way: forward vector must roughly follow the counter-clockwise tangent.
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    const along = fx * near.tx + fz * near.tz;
    const wrong = along < -0.25 && this.vf > 6 && !this.inPitLane;
    if (wrong) {
      this.vf *= 0.965; // heavy drag until the driver turns around
      if (this.wrongWayCool <= 0) {
        this.wrongWayCool = 2;
        this.cb.onPopup?.("WRONG WAY", "stunt");
      }
    }
    if (this.wrongWayCool > 0) this.wrongWayCool -= dt;
  }

  private wallCool = 0;
  private wrongWayCool = 0;
  // ---- Pit stop state ----
  private inPitLane = false;
  private pitMsgCool = 0;
  private pitTimer = 0;
  private pitStage = 0;
  private pitDone = false;

  private isOnSand(x: number, z: number): boolean {

    for (const s of this.sand) {
      if (Math.abs(x - s.x) <= s.halfX && Math.abs(z - s.z) <= s.halfZ) return true;
    }
    return false;
  }

  /** Is the position on a paved surface (highways, ring road, stunt pad)? */
  private isOnRoad(x: number, z: number): boolean {
    if (!this.isTrackMode) return isOnRoadAt(x, z);
    return isOnTrackAt(x, z) || pitLaneAt(x, z).inLane;
  }

  /**
   * Surface physics lookup: grip multiplier (traction) + rolling drag.
   * Asphalt roads grip best; grass off-road is looser; sand is loosest.
   * Snow / night biomes make roads "wet" with reduced grip.
   */
  private surfaceAt(x: number, z: number): { grip: number; drag: number } {
    const wet = !!this.tod.night;
    if (this.isOnSand(x, z)) return { grip: 0.5, drag: 0.5 }; // sand — low grip
    if (this.isOnRoad(x, z)) {
      return wet ? { grip: 0.78, drag: 0.02 } : { grip: 1, drag: 0.02 }; // asphalt
    }
    // grass / dirt off-road — medium-low grip, more drag
    return { grip: 0.72, drag: 0.28 };
  }

  /** Per-class visual dynamics: how much the body leans and how soft the ride. */
  private classTuning(): { roll: number; suspSoft: number } {
    switch (this.config.car.class) {
      case "sports":
        return { roll: 0.006, suspSoft: 0.8 };
      case "hyper":
        return { roll: 0.005, suspSoft: 0.7 };
      case "muscle":
        return { roll: 0.009, suspSoft: 0.9 };
      case "suv":
        return { roll: 0.016, suspSoft: 1.3 };
      case "offroad":
        return { roll: 0.015, suspSoft: 1.6 };
      default:
        return { roll: 0.011, suspSoft: 1.0 };
    }
  }


  private resolveBuildings() {
    const cr = 1.6; // car collision radius
    for (const b of this.buildings) {
      const cx = Math.max(b.x - b.halfX, Math.min(this.px, b.x + b.halfX));
      const cz = Math.max(b.z - b.halfZ, Math.min(this.pz, b.z + b.halfZ));
      let dx = this.px - cx;
      let dz = this.pz - cz;
      let d = Math.hypot(dx, dz);
      if (d > cr) continue;
      if (d < 1e-4) {
        // Car centre is inside the box — eject along the nearest face.
        const ox = b.halfX - Math.abs(this.px - b.x);
        const oz = b.halfZ - Math.abs(this.pz - b.z);
        if (ox < oz) {
          dx = Math.sign(this.px - b.x) || 1;
          dz = 0;
        } else {
          dx = 0;
          dz = Math.sign(this.pz - b.z) || 1;
        }
        d = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      // Push exactly out of the wall, then keep only the tangential velocity
      // so the car grazes past the building instead of sticking to it.
      this.px += dx * (cr - d);
      this.pz += dz * (cr - d);
      this.slideAlongNormal(-dx, -dz, 0.985);
      if (this.shake < 0.1) {
        this.shake = Math.min(1, this.shake + 0.2);
        this.cb.onEvent?.("bump");
      }
    }
  }

  // ---------- Systems ----------
  private updateCoins(dt: number) {
    for (const c of this.coins) {
      if (c.active) {
        c.mesh.rotation.z += dt * 3;
        const dx = c.mesh.position.x - this.px;
        const dz = c.mesh.position.z - this.pz;
        const d2 = dx * dx + dz * dz;
        // magnet upgrade
        const magnet = 2 + this.config.upgrades.magnet * 1.5;
        if (d2 < magnet * magnet && d2 > 4) {
          c.mesh.position.x -= (dx / Math.sqrt(d2)) * dt * 14;
          c.mesh.position.z -= (dz / Math.sqrt(d2)) * dt * 14;
        }
        if (d2 < 3.2) {
          c.active = false;
          c.mesh.visible = false;
          c.respawn = 18;
          const value = this.isTrackMode ? 0 : 1;
          if (value > 0) {
            this.sessionCoins += value;
            this.cb.onBankCoins?.(value);
            this.cb.onPopup?.(`+${value}`, "coin");
            this.cb.onEvent?.("coin");
            this.audio.coin();
          }
        }
      } else {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          c.active = true;
          c.mesh.visible = true;
        }
      }
    }
  }

  /**
   * Shared AI steering: eases the front wheels toward a desired heading and
   * lets the body follow via the same bicycle model the player uses.
   */
  private steerNpc(t: Traffic, targetHeading: number, dt: number) {
    let diff = targetHeading - t.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const want = Math.max(-MAX_STEER, Math.min(MAX_STEER, diff * 2.2));
    // Wheels turn first (~0.2s), body rotation follows with damping.
    t.steer += (want - t.steer) * Math.min(1, dt * 9);
    const yawRate = (t.speed * Math.tan(t.steer)) / 3.4;
    t.yawVel += (yawRate - t.yawVel) * Math.min(1, dt * 7);
    t.heading += t.yawVel * dt;
    t.group.rotation.y = t.heading;
    // Slight lean into the corner.
    t.group.rotation.z += (-t.yawVel * 0.05 - t.group.rotation.z) * Math.min(1, dt * 6);
    t.spin += (t.speed * dt) / 0.32;
    for (const w of t.wheels) w.rotation.x = t.spin;
    for (const p of t.steerPivots) p.rotation.y = t.steer;
  }

  private updateTraffic(dt: number) {
    for (const t of this.traffic) {
      if (t.theta !== undefined) {
        // Follow an anti-clockwise look-ahead point, then advance only along
        // the car root's local -Z axis. Position is never driven separately
        // from orientation, so rivals cannot slide or swap front and rear.
        const near = nearestOval(t.group.position.x, t.group.position.z);
        t.theta = near.theta;
        // Rivals periodically peel off into the pit lane, slow to the limit,
        // and rejoin the track at the pit exit.
        if (t.pitIn !== undefined && !t.pitting) {
          t.pitIn -= dt;
          if (t.pitIn <= 0 && near.theta > PIT.thetaStart - 0.15 && near.theta < PIT.thetaStart + 0.35) {
            t.pitting = true;
          }
        }
        const inPitSector = near.theta <= PIT.thetaStart && near.theta >= PIT.thetaEnd;
        if (t.pitting && !inPitSector && (t.pitIn ?? 0) <= 0) {
          t.pitting = false;
          t.pitIn = 60 + Math.random() * 60;
        }
        const laneTarget = t.pitting ? PIT_LAT_CENTRE : (t.lane ?? 0);
        const targetSpeed = t.pitting && inPitSector ? PIT.speedLimit * 0.85 : t.baseSpeed ?? t.speed;
        t.speed += (targetSpeed - t.speed) * Math.min(1, dt * 1.6);
        const target = ovalPoint(near.theta - 0.12, laneTarget);
        this.steerNpc(
          t,
          headingFromForward(
            target.x - t.group.position.x,
            target.z - t.group.position.z,
          ),
          dt,
        );
        const forward = forwardFromHeading(t.heading);
        t.group.position.x += forward.x * t.speed * dt;
        t.group.position.z += forward.z * t.speed * dt;
        const corrected = nearestOval(t.group.position.x, t.group.position.z);
        const lane = laneTarget;
        const laneError = corrected.lat - lane;
        t.group.position.x -= corrected.nx * laneError * Math.min(1, dt * 2.5);
        t.group.position.z -= corrected.nz * laneError * Math.min(1, dt * 2.5);
        // Sit on the banked surface (and stay flat down the pit lane).
        const cLat = Math.max(-TRACK.half, Math.min(TRACK.half, corrected.lat));
        const gy = t.pitting && inPitSector ? 0 : bankHeight(corrected.theta, cLat);
        t.group.position.y += (gy - t.group.position.y) * Math.min(1, dt * 6);
        if (t.cool > 0) t.cool -= dt;
        this.resolveTrafficHit(t, dt);
        continue;
      }
      // Drive along the car's own heading toward its lane waypoint, so bumps
      // are recovered with a smooth curve instead of an instant snap back.
      const { x: fx, z: fz } = forwardFromHeading(t.heading);
      t.group.position.x += fx * t.speed * dt;
      t.group.position.z += fz * t.speed * dt;
      // Wrap along its own road so traffic never leaves the island.
      const along = t.axis === "z" ? t.group.position.x : t.group.position.z;
      if (along > t.limit) {
        if (t.axis === "z") t.group.position.x = -t.limit;
        else t.group.position.z = -t.limit;
      } else if (along < -t.limit) {
        if (t.axis === "z") t.group.position.x = t.limit;
        else t.group.position.z = t.limit;
      }
      // Waypoint: a point further along the lane centre line.
      const lookahead = 14;
      const laneOff = t.axis === "z" ? t.group.position.z : t.group.position.x;
      const laneTarget = t.laneCoord ?? laneOff;
      const lateral = laneTarget - laneOff;
      const wpX = t.axis === "z" ? t.dir.x * lookahead : lateral;
      const wpZ = t.axis === "z" ? lateral : t.dir.y * lookahead;
      const wpHeading = headingFromForward(wpX, wpZ);
      this.steerNpc(t, wpHeading, dt);
      if (t.cool > 0) t.cool -= dt;

      this.resolveTrafficHit(t, dt);
    }
    if (this.nearMissCool > 0) this.nearMissCool -= dt;
  }


  private resolveTrafficHit(t: Traffic, _dt: number) {
    const dx = t.group.position.x - this.px;
    const dz = t.group.position.z - this.pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < 6.5) {
      // Weak NPC: the traffic car gets shoved aside; the player is NOT flung.
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d;
      const nz = dz / d;
      // Push the NPC out of the way (it's the light one).
      t.group.position.x += nx * (2.6 - d) * 0.6;
      t.group.position.z += nz * (2.6 - d) * 0.6;
      // Player simply loses momentum and stops instead of bouncing around.
      this.vf *= 0.35;
      this.vl *= 0.35;
      // Tiny separation so we never sink into the NPC (no jitter/vibration).
      this.px -= nx * 0.05;
      this.pz -= nz * 0.05;
      // Throttle feedback so it can't spam shake + haptics every frame.
      if (t.cool <= 0) {
        t.cool = 0.7;
        this.shake = Math.min(0.18, this.shake + 0.1);
        this.cb.onEvent?.("bump");
      }
    } else if (d2 < 40 && this.nearMissCool <= 0 && Math.abs(this.vf) > 28) {
      this.nearMissCool = 0.8;
      const coins = 3;
      this.sessionCoins += coins;
      this.cb.onBankCoins?.(coins);
      this.cb.onPopup?.(`NEAR MISS +${coins}`, "stunt");
      this.cb.onEvent?.("stunt");
    }
  }

  private updatePeds(dt: number) {
    for (const p of this.peds) {
      p.t -= dt;
      if (p.t <= 0) {
        p.t = 2 + Math.random() * 3;
        const ang = Math.random() * Math.PI * 2;
        p.vel.set(Math.cos(ang), Math.sin(ang)).multiplyScalar(1 + Math.random());
      }
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.z += p.vel.y * dt;
      p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.y);
      // avoid car
      const dx = p.mesh.position.x - this.px;
      const dz = p.mesh.position.z - this.pz;
      if (dx * dx + dz * dz < 25) {
        p.mesh.position.x += dx * dt;
        p.mesh.position.z += dz * dt;
      }
    }
  }

  private spawnSmoke() {
    const p = this.particles.find((x) => !x.active);
    if (!p) return;
    const back = this.config.car.size[2] * 0.4;
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    p.mesh.position.set(this.px - fx * back, 0.3, this.pz - fz * back);
    p.vel.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2);
    p.life = 0.6;
    p.max = 0.6;
    p.active = true;
    p.spin = (Math.random() - 0.5) * 4;
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(0xdddddd);
    p.mesh.scale.setScalar(1);
    p.mesh.visible = true;
  }

  private spawnNitroTrail() {
    const p = this.particles.find((x) => !x.active);
    if (!p) return;
    const back = this.config.car.size[2] * 0.5;
    const { x: fx, z: fz } = forwardFromHeading(this.heading);
    p.mesh.position.set(this.px - fx * back, 0.5, this.pz - fz * back);
    p.vel.set((Math.random() - 0.5), 0.5, (Math.random() - 0.5));
    p.life = 0.35;
    p.max = 0.35;
    p.active = true;
    p.spin = 0;
    (p.mesh.material as THREE.MeshBasicMaterial).color.set(
      this.config.nitroColor ? new THREE.Color(this.config.nitroColor).getHex() : 0x4da3ff,
    );
    p.mesh.scale.setScalar(0.8);
    p.mesh.visible = true;
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 1.5);
      p.mesh.rotation.y += p.spin * dt;
      const k = p.life / p.max;
      p.mesh.scale.setScalar(0.6 + (1 - k) * 1.4);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = k;
    }
  }

  private dropSkid() {
    for (const side of [-1, 1]) {
      const m = this.skids[this.skidIdx];
      this.skidIdx = (this.skidIdx + 1) % this.skids.length;
      const rx = Math.cos(this.heading) * side * this.config.car.size[0] * 0.4;
      const rz = -Math.sin(this.heading) * side * this.config.car.size[0] * 0.4;
      const back = this.config.car.size[2] * 0.32;
      const { x: fx, z: fz } = forwardFromHeading(this.heading);
      m.position.set(this.px + rx - fx * back, 0.015, this.pz + rz - fz * back);
      m.rotation.y = this.heading;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55;
      m.visible = true;
      m.userData.fade = 6;
    }
  }

  private updateSkidFade(dt: number) {
    for (const m of this.skids) {
      if (!m.visible) continue;
      const fade = (m.userData.fade as number) - dt;
      m.userData.fade = fade;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (fade / 6) * 0.55);
      if (fade <= 0) m.visible = false;
    }
  }

  private updateCamera(dt: number) {
    this.camCtl.update(dt, {
      px: this.px,
      pz: this.pz,
      py: this.py,
      heading: this.heading,
      vf: this.vf,
      vl: this.vl,
      carHeight: this.config.car.size[1],
      carLength: this.config.car.size[2],
      airborne: this.airborne,
      drifting: this.driftActive,
      driftMult: this.driftMult,
      nitro: this.nitroWasOn,
      shakeImpulse: this.shake,
    });
    this.fov = this.camera.fov;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  private applyVisual() {
    // Suspension raises/lowers the body; never sink through the ground.
    const bodyY = this.py + Math.max(-0.35, Math.min(0.25, this.susp));
    this.player.position.set(this.px, bodyY, this.pz);
    this.player.rotation.set(0, this.heading, 0);
    // Body roll: lean outward through corners (plus airborne barrel roll).
    const tilt = this.surfaceTilt();
    // Smoothly settle onto the banking so the car never bounces or clips.
    this.bankRollVis += (tilt.roll - this.bankRollVis) * Math.min(1, 0.12);
    this.bankPitchVis += (tilt.pitch - this.bankPitchVis) * Math.min(1, 0.12);
    this.player.rotation.z =
      this.bodyRoll -
      this.vl * 0.004 +
      this.bankRollVis +
      (this.airborne ? Math.sin(this.airRoll) * 0.15 : 0);
    // Pitch: nose dives on braking, squats on acceleration / lands nose-up.
    if (this.airborne) this.player.rotation.x = -this.vy * 0.01;
    else this.player.rotation.x = this.bodyPitch - this.susp * 0.25 + this.bankPitchVis;
    // Wheels roll at true rolling speed (all four), front pair also steers.
    this.wheelSpin += (this.vf * 0.016) / this.playerWheelR;
    for (const w of this.playerWheels) w.rotation.x = this.wheelSpin;
    for (const p of this.playerSteerPivots) {
      p.rotation.y += (this.steerAngle - p.rotation.y) * 0.35;
    }

    this.blobShadow.position.set(this.px, this.groundHeightAt(this.px, this.pz) + 0.03, this.pz);
    const s = 1 + this.py * 0.15;
    this.blobShadow.scale.setScalar(1 / s);
    (this.blobShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.05, 0.22 - this.py * 0.03);
  }


  private updateAudio() {
    const speedN = Math.min(1, Math.abs(this.vf) / this.config.car.topSpeed);
    this.audio.engine(speedN, this.input("accel"));
  }

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.audio.dispose();
    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    this.routeGlowMat.dispose();
    this.routeCoreMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

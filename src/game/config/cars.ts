export type CarClass =
  | "economy"
  | "sports"
  | "muscle"
  | "suv"
  | "offroad"
  | "hyper";

export type CarDef = {
  id: string;
  name: string;
  class: CarClass;
  price: number;
  /** Body dimensions: [width, height, length]. */
  size: [number, number, number];
  /** Default paint color hex. */
  color: string;
  /** Cabin / glass color hex. */
  cabin: string;
  /** Extra ground clearance (visual + wheel size). */
  rideHeight: number;
  // ---- Arcade performance stats (all roughly 0..10 for display) ----
  /** Forward acceleration (world units/s²). */
  accel: number;
  /** Top forward speed (world units/s). */
  topSpeed: number;
  /** Lateral grip — higher recovers slides faster. */
  grip: number;
  /** Base steering rate (radians/s). */
  turnRate: number;
  /** Drift looseness — higher slides more under handbrake. */
  drift: number;
  /** How controllable a drift is (steering authority mid-slide). */
  driftControl: number;
  /** Nitro boost strength multiplier bonus. */
  nitroStrength: number;
  /** Vehicle weight — heavier = more momentum, slower direction change. */
  weight: number;
  /** Legacy handling multiplier (feeds upgrades). */
  handling: number;
};

export const CARS: CarDef[] = [
  {
    id: "hatch",
    name: "Pip",
    class: "economy",
    price: 0,
    size: [1.5, 0.7, 2.7],
    color: "#6bcb77",
    cabin: "#233a26",
    rideHeight: 0.05,
    accel: 24,
    topSpeed: 46,
    grip: 3.4,
    turnRate: 2.1,
    drift: 0.5,
    driftControl: 0.8,
    nitroStrength: 0.8,
    weight: 0.8,
    handling: 1.05,
  },
  {
    id: "compact",
    name: "Blitz",
    class: "economy",
    price: 400,
    size: [1.45, 0.65, 2.5],
    color: "#00c2d1",
    cabin: "#1a2e30",
    rideHeight: 0.04,
    accel: 26,
    topSpeed: 48,
    grip: 3.5,
    turnRate: 2.3,
    drift: 0.52,
    driftControl: 0.85,
    nitroStrength: 0.85,
    weight: 0.75,
    handling: 1.1,
  },
  {
    id: "tuner",
    name: "Katsu GT",
    class: "sports",
    price: 900,
    size: [1.6, 0.6, 3.2],
    color: "#4d7cff",
    cabin: "#1b2440",
    rideHeight: 0,
    accel: 34,
    topSpeed: 60,
    grip: 3.8,
    turnRate: 2.5,
    drift: 0.72,
    driftControl: 1.15,
    nitroStrength: 1.1,
    weight: 0.9,
    handling: 1.2,
  },
  {
    id: "drift-king",
    name: "Drift King",
    class: "sports",
    price: 1200,
    size: [1.65, 0.58, 3.3],
    color: "#ff6fa5",
    cabin: "#2d1a28",
    rideHeight: -0.02,
    accel: 32,
    topSpeed: 58,
    grip: 2.8,
    turnRate: 2.6,
    drift: 0.95,
    driftControl: 1.35,
    nitroStrength: 1.05,
    weight: 0.88,
    handling: 1.15,
  },
  {
    id: "muscle",
    name: "Vandal V8",
    class: "muscle",
    price: 1600,
    size: [1.85, 0.72, 3.4],
    color: "#ff5a5f",
    cabin: "#2b2d42",
    rideHeight: 0.02,
    accel: 38,
    topSpeed: 64,
    grip: 2.7,
    turnRate: 1.9,
    drift: 0.9,
    driftControl: 0.95,
    nitroStrength: 1.15,
    weight: 1.2,
    handling: 0.95,
  },
  {
    id: "iron-bull",
    name: "Iron Bull",
    class: "muscle",
    price: 2000,
    size: [1.9, 0.75, 3.6],
    color: "#2b2d42",
    cabin: "#121420",
    rideHeight: 0.03,
    accel: 40,
    topSpeed: 66,
    grip: 2.5,
    turnRate: 1.7,
    drift: 0.88,
    driftControl: 0.9,
    nitroStrength: 1.2,
    weight: 1.35,
    handling: 0.9,
  },
  {
    id: "suv",
    name: "Monarch X",
    class: "suv",
    price: 2400,
    size: [1.95, 1.0, 3.5],
    color: "#22252e",
    cabin: "#0f1220",
    rideHeight: 0.22,
    accel: 30,
    topSpeed: 56,
    grip: 3.2,
    turnRate: 1.8,
    drift: 0.62,
    driftControl: 0.9,
    nitroStrength: 1.0,
    weight: 1.35,
    handling: 1.0,
  },
  {
    id: "offroad",
    name: "Boulder 4x4",
    class: "offroad",
    price: 3000,
    size: [1.9, 0.95, 3.3],
    color: "#ff9f45",
    cabin: "#33251a",
    rideHeight: 0.4,
    accel: 28,
    topSpeed: 52,
    grip: 3.6,
    turnRate: 2.0,
    drift: 0.68,
    driftControl: 1.0,
    nitroStrength: 1.0,
    weight: 1.3,
    handling: 1.0,
  },
  {
    id: "rally-fox",
    name: "Rally Fox",
    class: "offroad",
    price: 3500,
    size: [1.7, 0.82, 3.1],
    color: "#e6af2e",
    cabin: "#2a2210",
    rideHeight: 0.32,
    accel: 33,
    topSpeed: 58,
    grip: 3.9,
    turnRate: 2.3,
    drift: 0.78,
    driftControl: 1.1,
    nitroStrength: 1.05,
    weight: 1.1,
    handling: 1.15,
  },
  {
    id: "apex-rs",
    name: "Apex RS",
    class: "sports",
    price: 4000,
    size: [1.62, 0.55, 3.4],
    color: "#a0a5b5",
    cabin: "#1a1c28",
    rideHeight: -0.02,
    accel: 42,
    topSpeed: 70,
    grip: 4.0,
    turnRate: 2.6,
    drift: 0.7,
    driftControl: 1.25,
    nitroStrength: 1.25,
    weight: 0.92,
    handling: 1.3,
  },
  {
    id: "hyper",
    name: "Aether One",
    class: "hyper",
    price: 5000,
    size: [1.6, 0.52, 3.6],
    color: "#c56bff",
    cabin: "#2a1b3d",
    rideHeight: -0.04,
    accel: 46,
    topSpeed: 78,
    grip: 4.2,
    turnRate: 2.7,
    drift: 0.66,
    driftControl: 1.3,
    nitroStrength: 1.4,
    weight: 0.95,
    handling: 1.35,
  },
  {
    id: "phantom",
    name: "Phantom LX",
    class: "hyper",
    price: 7500,
    size: [1.55, 0.48, 3.8],
    color: "#1a1c23",
    cabin: "#0a0c14",
    rideHeight: -0.06,
    accel: 50,
    topSpeed: 85,
    grip: 4.5,
    turnRate: 2.8,
    drift: 0.6,
    driftControl: 1.4,
    nitroStrength: 1.5,
    weight: 0.9,
    handling: 1.45,
  },
];

export const getCar = (id: string): CarDef =>
  CARS.find((c) => c.id === id) ?? CARS[0];


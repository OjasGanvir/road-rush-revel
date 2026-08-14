import { CAR_COLORS } from "./colors";

export type CosmeticItem = {
  id: string;
  name: string;
  price: number;
  value: string;
};

export const PAINTS: CosmeticItem[] = [
  { id: "paint-0", name: "Crimson Red", price: 0, value: "#ff5a5f" },
  { id: "paint-1", name: "Velocity Blue", price: 150, value: "#4d7cff" },
  { id: "paint-2", name: "Solar Yellow", price: 200, value: "#ffcf3f" },
  { id: "paint-3", name: "Viper Green", price: 250, value: "#6bcb77" },
  { id: "paint-4", name: "Sunset Orange", price: 300, value: "#ff9f45" },
  { id: "paint-5", name: "Hyper Violet", price: 350, value: "#c56bff" },
  { id: "paint-6", name: "Cyan Pulse", price: 400, value: "#00c2d1" },
  { id: "paint-7", name: "Neon Pink", price: 450, value: "#ff6fa5" },
  { id: "paint-8", name: "Midnight Black", price: 500, value: "#1a1c23" },
  { id: "paint-9", name: "Alpine White", price: 550, value: "#f8f9fa" },
  { id: "paint-10", name: "Gold Foil", price: 750, value: "#e6af2e" },
  { id: "paint-11", name: "Titanium Silver", price: 650, value: "#a0a5b5" },
];

export type WheelItem = CosmeticItem & {
  wheelColor: string;
  /** Number of visual spokes (affects 3D rim geometry). */
  spokes: number;
  /** Visual style category for display. */
  style: "stock" | "sport" | "mesh" | "deep-dish" | "forged" | "rally" | "drag" | "luxury";
  /** Short description of the wheel type. */
  desc: string;
};

export const WHEELS: WheelItem[] = [
  { id: "wheel-stock",   name: "Stock Steel",     price: 0,    value: "stock",     wheelColor: "#3a3f4b", spokes: 5,  style: "stock",     desc: "Basic factory wheels" },
  { id: "wheel-sport5",  name: "Sport 5-Spoke",   price: 200,  value: "sport5",    wheelColor: "#c9ccd4", spokes: 5,  style: "sport",     desc: "Lightweight alloy rims" },
  { id: "wheel-mesh",    name: "Mesh Weave",      price: 350,  value: "mesh",      wheelColor: "#8a8f9e", spokes: 12, style: "mesh",      desc: "Cross-hatch mesh pattern" },
  { id: "wheel-deep",    name: "Deep Dish",       price: 500,  value: "deep",      wheelColor: "#18181b", spokes: 8,  style: "deep-dish", desc: "Wide lip concave rims" },
  { id: "wheel-forged",  name: "Forged Monoblock", price: 750, value: "forged",    wheelColor: "#ffcf3f", spokes: 7,  style: "forged",    desc: "Single-piece forged alloy" },
  { id: "wheel-rally",   name: "Rally Bead-Lock", price: 400,  value: "rally",     wheelColor: "#ff9f45", spokes: 6,  style: "rally",     desc: "Heavy-duty off-road rims" },
  { id: "wheel-drag",    name: "Drag Slicks",     price: 600,  value: "drag",      wheelColor: "#ff5a5f", spokes: 3,  style: "drag",      desc: "Wide rear drag setup" },
  { id: "wheel-luxury",  name: "Chrome Luxury",   price: 900,  value: "luxury",    wheelColor: "#e8dcc8", spokes: 10, style: "luxury",    desc: "Mirror-polish chrome" },
];

export type TrailItem = CosmeticItem & { trailColor: string | null };

export const TRAILS: TrailItem[] = [
  { id: "trail-none", name: "None", price: 0, value: "none", trailColor: null },
  { id: "trail-fire", name: "Flame", price: 400, value: "fire", trailColor: "#ff9f45" },
  { id: "trail-ice", name: "Frost", price: 400, value: "ice", trailColor: "#00c2d1" },
  { id: "trail-rainbow", name: "Spark", price: 700, value: "spark", trailColor: "#c56bff" },
  { id: "trail-gold", name: "Golden", price: 900, value: "gold", trailColor: "#ffcf3f" },
];

export const getPaint = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
export const getWheel = (id: string) => WHEELS.find((w) => w.id === id) ?? WHEELS[0];
export const getTrail = (id: string) => TRAILS.find((t) => t.id === id) ?? TRAILS[0];

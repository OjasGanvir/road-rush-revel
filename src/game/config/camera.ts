/** Camera modes + tunable settings for the driving camera. */

export type CameraModeId =
  | "chase-close"
  | "chase-far"
  | "hood"
  | "cockpit"
  | "cinematic";

export type CameraModeDef = {
  id: CameraModeId;
  name: string;
  icon: string;
  /** Base distance behind the car (metres). */
  distance: number;
  /** Base height above the car. */
  height: number;
  /** Base field of view. */
  baseFov: number;
  /** How far ahead of the car the camera looks. */
  lookAhead: number;
  /** How high (relative to car) the look target sits. */
  lookHeight: number;
  /** Follow responsiveness base (higher = snappier). */
  stiffness: number;
  /** Rigidly attached view (hood / cockpit) — minimal lag. */
  attached?: boolean;
};

export const CAMERA_MODES: CameraModeDef[] = [
  {
    id: "chase-close",
    name: "Close",
    icon: "🎯",
    distance: 6.8,
    height: 3.2,
    baseFov: 66,
    lookAhead: 6,
    lookHeight: 1.3,
    stiffness: 7,
  },
  {
    id: "chase-far",
    name: "Far",
    icon: "🛰️",
    distance: 11,
    height: 5,
    baseFov: 60,
    lookAhead: 7,
    lookHeight: 1.5,
    stiffness: 5,
  },
  {
    id: "hood",
    name: "Hood",
    icon: "🚗",
    distance: -0.2,
    height: 1.5,
    baseFov: 74,
    lookAhead: 24,
    lookHeight: 1.1,
    stiffness: 16,
    attached: true,
  },
  {
    id: "cockpit",
    name: "Cockpit",
    icon: "🪟",
    distance: 1.1,
    height: 1.55,
    baseFov: 78,
    lookAhead: 24,
    lookHeight: 1.2,
    stiffness: 18,
    attached: true,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    icon: "🎬",
    distance: 9.5,
    height: 4,
    baseFov: 52,
    lookAhead: 5,
    lookHeight: 1.4,
    stiffness: 2.4,
  },
];

export const DEFAULT_CAMERA_MODE: CameraModeId = "chase-close";

export function getCameraMode(id: string): CameraModeDef {
  return CAMERA_MODES.find((m) => m.id === id) ?? CAMERA_MODES[0];
}

export type CameraSettings = {
  /** Distance multiplier (0.6 = closer, 1.6 = further). */
  distance: number;
  /** Height multiplier. */
  height: number;
  /** Follow sensitivity multiplier (0.4 = floaty, 1.6 = tight). */
  sensitivity: number;
  /** Camera shake toggle. */
  shake: boolean;
  /** Speed-based dynamic FOV toggle. */
  dynamicFov: boolean;
};

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  distance: 1,
  height: 1,
  sensitivity: 1,
  shake: true,
  dynamicFov: true,
};

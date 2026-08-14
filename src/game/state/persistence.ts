import { useSyncExternalStore } from "react";
import {
  DEFAULT_CAMERA_MODE,
  DEFAULT_CAMERA_SETTINGS,
  type CameraModeId,
  type CameraSettings,
} from "../config/camera";

export type Profile = {
  coins: number;
  /** Best single drift/combo score ever banked. */
  bestDrift: number;
  totalCoinsEarned: number;
  selectedCar: string;
  selectedPaint: string;
  selectedWheel: string;
  selectedTrail: string;
  timeOfDay: string;
  muted: boolean;
  /** ISO date (YYYY-MM-DD) of the last claimed daily reward. */
  lastDailyClaim: string | null;
  dailyStreak: number;
  /** Achievement ids whose reward has been collected. */
  claimedAchievements: string[];
  cameraMode: CameraModeId;
  cameraSettings: CameraSettings;
  owned: {
    cars: string[];
    paints: string[];
    wheels: string[];
    trails: string[];
  };
  upgrades: {
    handling: number;
    speed: number;
    grip: number;
    magnet: number;
    extraLife: number;
    nitro: number;
  };
  level: number;
  xp: number;
  driverRating: number;
  totalStars: number;
  division: string;
};

const STORAGE_KEY = "driftdash-profile-v2";

const DIVISIONS = [
  { minRating: 0, maxRating: 599, division: "Bronze" },
  { minRating: 600, maxRating: 1199, division: "Silver" },
  { minRating: 1200, maxRating: 1799, division: "Gold" },
  { minRating: 1800, maxRating: 2599, division: "Platinum" },
  { minRating: 2600, maxRating: 3599, division: "Diamond" },
  { minRating: 3600, maxRating: 99999, division: "Master" },
];

const getLevelFromXp = (xp: number) => {
  if (xp <= 0) return 1;
  let level = 1;
  let requiredXp = 0;
  while (requiredXp + 300 <= xp) {
    requiredXp += 300;
    level += 1;
  }
  return level;
};

const getDivisionFromRating = (rating: number) => {
  return DIVISIONS.find((entry) => rating >= entry.minRating && rating <= entry.maxRating) ?? DIVISIONS[0];
};

const DEFAULT_PROFILE: Profile = {
  coins: 0,
  bestDrift: 0,
  totalCoinsEarned: 0,
  selectedCar: "hatch",
  selectedPaint: "paint-0",
  selectedWheel: "wheel-black",
  selectedTrail: "trail-none",
  timeOfDay: "sunny",
  muted: false,
  lastDailyClaim: null,
  dailyStreak: 0,
  claimedAchievements: [],
  cameraMode: DEFAULT_CAMERA_MODE,
  cameraSettings: DEFAULT_CAMERA_SETTINGS,
  owned: {
    cars: ["hatch"],
    paints: ["paint-0"],
    wheels: ["wheel-black"],
    trails: ["trail-none"],
  },
  upgrades: { handling: 0, speed: 0, grip: 0, magnet: 0, extraLife: 0, nitro: 0 },
  level: 1,
  xp: 0,
  driverRating: 450,
  totalStars: 0,
  division: getDivisionFromRating(450).division,
};

let current: Profile = DEFAULT_PROFILE;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      owned: { ...DEFAULT_PROFILE.owned, ...(parsed.owned ?? {}) },
      upgrades: { ...DEFAULT_PROFILE.upgrades, ...(parsed.upgrades ?? {}) },
      cameraSettings: { ...DEFAULT_CAMERA_SETTINGS, ...(parsed.cameraSettings ?? {}) },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    current = load();
    loaded = true;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore quota errors */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayKey = () => dayKey(new Date());
const yesterdayKey = () => dayKey(new Date(Date.now() - 86400000));

/** True when today's daily reward has not been claimed yet. */
export const canClaimDaily = (p: Profile) => p.lastDailyClaim !== todayKey();

export const profileStore = {
  get(): Profile {
    ensureLoaded();
    return current;
  },
  subscribe(listener: () => void) {
    ensureLoaded();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(mutator: (p: Profile) => Profile) {
    ensureLoaded();
    current = mutator(current);
    emit();
  },
  /** Claims today's daily reward. Returns the amount granted (0 if already claimed). */
  claimDaily(amount: number): number {
    ensureLoaded();
    const today = todayKey();
    if (current.lastDailyClaim === today) return 0;
    const streak = current.lastDailyClaim === yesterdayKey() ? current.dailyStreak + 1 : 1;
    this.update((p) => ({
      ...p,
      coins: p.coins + amount,
      totalCoinsEarned: p.totalCoinsEarned + amount,
      lastDailyClaim: today,
      dailyStreak: streak,
    }));
    return amount;
  },
  claimAchievement(id: string, reward: number) {
    ensureLoaded();
    if (current.claimedAchievements.includes(id)) return;
    this.update((p) => ({
      ...p,
      coins: p.coins + reward,
      totalCoinsEarned: p.totalCoinsEarned + reward,
      claimedAchievements: [...p.claimedAchievements, id],
    }));
  },
  addCoins(amount: number) {
    if (amount <= 0) return;
    this.update((p) => ({
      ...p,
      coins: p.coins + amount,
      totalCoinsEarned: p.totalCoinsEarned + amount,
    }));
  },
  recordDrift(score: number) {
    this.update((p) => ({ ...p, bestDrift: Math.max(p.bestDrift, Math.round(score)) }));
  },
  earnXp(amount: number) {
    if (amount <= 0) return;
    this.update((p) => {
      const xp = p.xp + amount;
      return {
        ...p,
        xp,
        level: getLevelFromXp(xp),
      };
    });
  },
  addDriverRating(amount: number) {
    if (amount === 0) return;
    this.update((p) => {
      const rating = Math.max(0, p.driverRating + amount);
      return {
        ...p,
        driverRating: rating,
        division: getDivisionFromRating(rating).division,
      };
    });
  },
  setTimeOfDay(id: string) {
    this.update((p) => ({ ...p, timeOfDay: id }));
  },
  setMuted(muted: boolean) {
    this.update((p) => ({ ...p, muted }));
  },
  setCameraMode(mode: CameraModeId) {
    this.update((p) => ({ ...p, cameraMode: mode }));
  },
  setCameraSettings(patch: Partial<CameraSettings>) {
    this.update((p) => ({ ...p, cameraSettings: { ...p.cameraSettings, ...patch } }));
  },
};

export function useProfile(): Profile {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, () => DEFAULT_PROFILE);
}

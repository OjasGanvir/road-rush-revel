export type PowerUpType =
  | "magnet"
  | "shield"
  | "slowmo"
  | "nitro"
  | "double";

export type PowerUpDef = {
  type: PowerUpType;
  name: string;
  color: string;
  /** Base active duration in seconds. */
  duration: number;
  icon: string;
};

export const POWERUPS: Record<PowerUpType, PowerUpDef> = {
  magnet: { type: "magnet", name: "Coin Magnet", color: "#4d7cff", duration: 8, icon: "🧲" },
  shield: { type: "shield", name: "Shield", color: "#00c2d1", duration: 10, icon: "🛡️" },
  slowmo: { type: "slowmo", name: "Slow Motion", color: "#c56bff", duration: 6, icon: "⏳" },
  nitro: { type: "nitro", name: "Nitro Boost", color: "#ff9f45", duration: 4, icon: "🔥" },
  double: { type: "double", name: "Double Coins", color: "#ffcf3f", duration: 10, icon: "✨" },
};

export const POWERUP_TYPES = Object.keys(POWERUPS) as PowerUpType[];

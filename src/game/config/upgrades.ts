export type UpgradeDef = {
  id: "handling" | "magnet" | "extraLife" | "nitro" | "speed" | "grip";
  name: string;
  description: string;
  maxLevel: number;
  /** Cost per level index (length === maxLevel). */
  costs: number[];
};

export const UPGRADES: UpgradeDef[] = [
  {
    id: "handling",
    name: "Better Handling",
    description: "Sharper, more responsive steering and corner control.",
    maxLevel: 5,
    costs: [300, 600, 1000, 1600, 2400],
  },
  {
    id: "speed",
    name: "Speed Tuning",
    description: "Adds a noticeable boost to acceleration and top speed.",
    maxLevel: 5,
    costs: [450, 900, 1500, 2200, 3200],
  },
  {
    id: "grip",
    name: "Grip Compound",
    description: "Improves cornering grip and reduces oversteer.",
    maxLevel: 5,
    costs: [420, 840, 1400, 2100, 3000],
  },
  {
    id: "magnet",
    name: "Coin Magnet",
    description: "Passively pulls in nearby coins.",
    maxLevel: 5,
    costs: [400, 800, 1300, 2000, 3000],
  },
  {
    id: "extraLife",
    name: "Extra Life",
    description: "Revive once per run after a crash.",
    maxLevel: 3,
    costs: [1200, 2600, 4500],
  },
  {
    id: "nitro",
    name: "Nitro Duration",
    description: "Nitro boosts last longer.",
    maxLevel: 5,
    costs: [350, 700, 1200, 1900, 2800],
  },
];

export const getUpgrade = (id: string) =>
  UPGRADES.find((u) => u.id === id) ?? UPGRADES[0];

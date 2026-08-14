import type { Profile } from "../state/persistence";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  reward: number;
  /** Current progress out of goal. */
  progress: (p: Profile) => number;
  goal: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "coins-100",
    name: "Pocket Change",
    description: "Collect 100 coins in total.",
    reward: 50,
    goal: 100,
    progress: (p) => p.totalCoinsEarned,
  },
  {
    id: "coins-1000",
    name: "Coin Hoarder",
    description: "Collect 1,000 coins in total.",
    reward: 250,
    goal: 1000,
    progress: (p) => p.totalCoinsEarned,
  },
  {
    id: "coins-5000",
    name: "Rolling in It",
    description: "Collect 5,000 coins in total.",
    reward: 750,
    goal: 5000,
    progress: (p) => p.totalCoinsEarned,
  },
  {
    id: "drift-500",
    name: "Sideways Rookie",
    description: "Bank a 500 point drift combo.",
    reward: 100,
    goal: 500,
    progress: (p) => p.bestDrift,
  },
  {
    id: "drift-2500",
    name: "Drift King",
    description: "Bank a 2,500 point drift combo.",
    reward: 400,
    goal: 2500,
    progress: (p) => p.bestDrift,
  },
  {
    id: "cars-3",
    name: "Small Collection",
    description: "Own 3 different cars.",
    reward: 200,
    goal: 3,
    progress: (p) => p.owned.cars.length,
  },
  {
    id: "streak-3",
    name: "Regular Driver",
    description: "Claim the daily reward 3 days in a row.",
    reward: 150,
    goal: 3,
    progress: (p) => p.dailyStreak,
  },
];

export const DAILY_REWARD = 30;

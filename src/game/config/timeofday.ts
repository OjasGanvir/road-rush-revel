export type TimeOfDayId = "sunny" | "sunset" | "night";

export type TimeOfDayDef = {
  id: TimeOfDayId;
  name: string;
  icon: string;
  sky: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ground: string;
  road: string;
  building: string;
  buildingAlt: string;
  ambient: number;
  light: string;
  lightIntensity: number;
  /** Emissive glow on windows / lights at night. */
  night: boolean;
};

export const TIMES_OF_DAY: TimeOfDayDef[] = [
  {
    id: "sunny",
    name: "Sunny",
    icon: "☀️",
    sky: "#8ec5ff",
    fog: "#bfe0ff",
    fogNear: 90,
    fogFar: 340,
    ground: "#6bcb77",
    road: "#3a3f4b",
    building: "#dbe4ee",
    buildingAlt: "#b9c6d6",
    ambient: 0.9,
    light: "#fff6e0",
    lightIntensity: 1.15,
    night: false,
  },
  {
    id: "sunset",
    name: "Sunset",
    icon: "🌇",
    sky: "#ffb27a",
    fog: "#ffcf9e",
    fogNear: 80,
    fogFar: 300,
    ground: "#5e9e69",
    road: "#463f47",
    building: "#e6b48c",
    buildingAlt: "#c98f6e",
    ambient: 0.8,
    light: "#ffb066",
    lightIntensity: 1.25,
    night: false,
  },
  {
    id: "night",
    name: "Night",
    icon: "🌙",
    sky: "#0e1430",
    fog: "#141d3d",
    fogNear: 60,
    fogFar: 230,
    ground: "#1f3352",
    road: "#20242e",
    building: "#2a3350",
    buildingAlt: "#39456b",
    ambient: 0.55,
    light: "#9fb0ff",
    lightIntensity: 0.85,
    night: true,
  },
];

export const getTimeOfDay = (id: string): TimeOfDayDef =>
  TIMES_OF_DAY.find((t) => t.id === id) ?? TIMES_OF_DAY[0];

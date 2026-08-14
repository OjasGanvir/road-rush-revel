export type BiomeDef = {
  id: string;
  name: string;
  sky: string;
  fog: string;
  ground: string;
  road: string;
  /** Scenery accent colors used for trees / props. */
  prop: string;
  propAlt: string;
  /** Ambient + directional light tint. */
  light: string;
  ambient: number;
  night?: boolean;
};

export const BIOMES: BiomeDef[] = [
  {
    id: "city",
    name: "City",
    sky: "#8ec5ff",
    fog: "#bfe0ff",
    ground: "#8d99ae",
    road: "#3a3f4b",
    prop: "#4d7cff",
    propAlt: "#ff5a5f",
    light: "#ffffff",
    ambient: 0.75,
  },
  {
    id: "desert",
    name: "Desert",
    sky: "#ffd8a8",
    fog: "#ffe8cc",
    ground: "#f2c879",
    road: "#5a4f42",
    prop: "#c98a3a",
    propAlt: "#8a5a2b",
    light: "#fff3d6",
    ambient: 0.85,
  },
  {
    id: "forest",
    name: "Forest",
    sky: "#a8e6a1",
    fog: "#d3f2cf",
    ground: "#5fa860",
    road: "#3d3a34",
    prop: "#2f7d32",
    propAlt: "#8bc34a",
    light: "#eafff0",
    ambient: 0.8,
  },
  {
    id: "snow",
    name: "Snow",
    sky: "#dbeeff",
    fog: "#f0f8ff",
    ground: "#eef4fb",
    road: "#5b6472",
    prop: "#9fc7e8",
    propAlt: "#ffffff",
    light: "#ffffff",
    ambient: 0.9,
  },
  {
    id: "night",
    name: "Night Highway",
    sky: "#141a33",
    fog: "#1c2447",
    ground: "#23304f",
    road: "#22252e",
    prop: "#4d7cff",
    propAlt: "#ffcf3f",
    light: "#aab6ff",
    ambient: 0.55,
    night: true,
  },
];

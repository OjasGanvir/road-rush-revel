import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/game/GameCanvas";
import { RotateDeviceOverlay } from "../components/game/RotateDeviceOverlay";

type PlaySearch = { mode: "city" | "track" };

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>): PlaySearch => ({
    mode: search.mode === "track" ? "track" : "city",
  }),
  head: () => ({
    meta: [
      { title: "Playing — Drift City" },
      {
        name: "description",
        content: "Free-roam the open city or race the NASCAR oval speedway in Drift City.",
      },
      { property: "og:title", content: "Playing — Drift City" },
      {
        property: "og:description",
        content: "Drive, drift and stunt in the open world or lap the NASCAR stadium oval.",
      },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { mode } = Route.useSearch();
  return (
    <>
      <GameCanvas mode={mode} />
      <RotateDeviceOverlay />
    </>
  );
}

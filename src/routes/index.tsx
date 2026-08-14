import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Play, Warehouse, Coins, Flag, ChartLine, Sparkles } from "lucide-react";
import { useProfile } from "../game/state/persistence";
import { Button } from "../components/ui/button";
import { DailyReward, Achievements } from "../components/game/Rewards";
import { RotateDeviceOverlay } from "../components/game/RotateDeviceOverlay";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Road Rush Revel — Open World Arcade Racing" },
      {
        name: "description",
        content:
          "Jump into open-world city driving, drift through the streets, and take on track races in a browser arcade racer.",
      },
      { property: "og:title", content: "Road Rush Revel — Open World Arcade Racing" },
      {
        property: "og:description",
        content:
          "Drive freely through the city, hit ramps, and choose between open-world and track racing modes.",
      },
    ],
  }),
  component: MainMenu,
});

function MainMenu() {
  const profile = useProfile();

  return (
    <>
      <RotateDeviceOverlay />
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#8ec5ff] via-[#bfe0ff] to-[#6bcb77] px-5 py-8">
        <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-24 h-52 w-52 rounded-full bg-[#ffcf3f]/30 blur-3xl" />

        <div className="z-10 flex w-full max-w-md flex-col items-center">
          <div className="mb-1 flex items-center gap-2 text-white drop-shadow-md">
            <Car className="h-9 w-9" />
          </div>
          <h1 className="text-center text-6xl font-extrabold leading-none tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.15)]">
            DRIFT
            <span className="text-[#ff5a5f]">CITY</span>
          </h1>
          <p className="mt-2 text-center text-sm font-semibold text-white/90 drop-shadow">
            Free-roam the city. Drift, jump, and collect.
          </p>

          <div className="mt-6 grid w-full grid-cols-3 gap-2">
            <MenuStat icon={<Coins className="h-4 w-4" />} label="Coins" value={profile.coins} />
            <MenuStat icon={<ChartLine className="h-4 w-4" />} label="Level" value={profile.level} />
            <MenuStat
              icon={<Sparkles className="h-4 w-4" />}
              label="Stars"
              value={profile.totalStars}
            />
          </div>

          <p className="mt-6 text-center text-xs font-extrabold uppercase tracking-widest text-white/90 drop-shadow">
            Choose your drive
          </p>

          <Button
            asChild
            className="mt-2 h-16 w-full rounded-2xl bg-[#ff5a5f] text-xl font-extrabold shadow-[0_6px_0_#c23e42] transition-transform hover:bg-[#ff5a5f] active:translate-y-1 active:shadow-[0_2px_0_#c23e42]"
          >
            <Link to="/play" search={{ mode: "city" }}>
              <Play className="mr-2 h-7 w-7 fill-current" /> OPEN WORLD
            </Link>
          </Button>

          <Button
            asChild
            className="mt-3 h-16 w-full rounded-2xl bg-[#4d7cff] text-xl font-extrabold shadow-[0_6px_0_#2f56c4] transition-transform hover:bg-[#4d7cff] active:translate-y-1 active:shadow-[0_2px_0_#2f56c4]"
          >
            <Link to="/play" search={{ mode: "track" }}>
              <Flag className="mr-2 h-7 w-7" /> NASCAR TRACK
            </Link>
          </Button>

          <Button
            asChild
            variant="secondary"
            className="mt-3 h-14 w-full rounded-2xl text-lg font-bold shadow-md"
          >
            <Link to="/garage">
              <Warehouse className="mr-2 h-5 w-5" /> Garage
            </Link>
          </Button>

          <DailyReward />
          <Achievements />

          <p className="mt-5 text-center text-xs font-semibold text-white/80 drop-shadow">
            Steer with the wheel · hold handbrake to drift · nitro to boost · hit ramps to fly
          </p>
        </div>
      </div>
    </>
  );
}

function MenuStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/85 py-2 shadow-md backdrop-blur">
      <div className="text-[#4d7cff]">{icon}</div>
      <span className="text-lg font-extrabold leading-tight text-[#22252e]">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

import { Fuel, CircleDot, Check, TriangleAlert, CircleAlert } from "lucide-react";

type Props = { fuel: number; tyres: number };

function tone(pct: number) {
  if (pct >= 60) return { color: "#43d675", glow: "rgba(67,214,117,0.55)" };
  if (pct >= 30) return { color: "#ffd23f", glow: "rgba(255,210,63,0.55)" };
  if (pct >= 15) return { color: "#ff9f43", glow: "rgba(255,159,67,0.55)" };
  return { color: "#ff4d5e", glow: "rgba(255,77,94,0.6)" };
}

function StatusIcon({ pct, critical }: { pct: number; critical: number }) {
  if (pct < critical) return <CircleAlert className="h-3 w-3 text-[#ff4d5e]" />;
  if (pct < critical * 2) return <TriangleAlert className="h-3 w-3 text-[#ffd23f]" />;
  return <Check className="h-3 w-3 text-[#43d675]" />;
}

function Gauge({
  label,
  pct,
  icon,
  critical,
}: {
  label: string;
  pct: number;
  icon: React.ReactNode;
  critical: number;
}) {
  const t = tone(pct);
  const low = pct < critical;
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center justify-center text-white/90"
        style={{ filter: `drop-shadow(0 0 6px ${t.glow})`, color: t.color }}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-white/70">
          <span>{label}</span>
          <span className="ml-2 flex items-center gap-0.5 tabular-nums text-white">
            {Math.round(pct)}%
            <StatusIcon pct={pct} critical={critical} />
          </span>
        </div>
        <div
          className="relative h-2 w-16 overflow-hidden rounded-full bg-white/20 sm:h-2.5 sm:w-24"
          style={low ? { animation: "pulse 1.6s ease-in-out infinite" } : undefined}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width,background-color] duration-500 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, pct))}%`,
              backgroundColor: t.color,
              boxShadow: `0 0 8px ${t.glow}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function StatusPanel({ fuel, tyres }: Props) {
  const fuelPct = fuel * 100;
  const tyrePct = tyres * 100;
  const isLow = fuelPct < 15 || tyrePct < 20;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="flex items-center gap-2.5 sm:gap-4 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-4 sm:py-2">
        <Gauge
          label="Fuel"
          pct={fuelPct}
          critical={15}
          icon={<Fuel className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
        />
        <div className="h-5 w-px bg-white/15" />
        <Gauge
          label="Tires"
          pct={tyrePct}
          critical={20}
          icon={<CircleDot className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
        />
        {isLow && (
          <span
            className="rounded-full bg-[#ff4d5e] px-2 py-0.5 text-center text-[8px] sm:text-[9px] font-extrabold uppercase leading-tight tracking-wide text-white whitespace-nowrap"
            style={{ animation: "pulse 1.6s ease-in-out infinite" }}
          >
            {fuelPct < 15 ? "Low Fuel" : "Pit for Tires"}
          </span>
        )}
      </div>
    </div>
  );
}

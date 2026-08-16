import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Pause,
  Play,
  RotateCcw,
  Home,
  Coins,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hand,
  Zap,
  Warehouse,
  Volume2,
  VolumeX,
  Camera,
  Flame,
} from "lucide-react";
import {
  GameEngine,
  type ControlAction,
  type EngineConfig,
  type PopupKind,
  type Stats,
} from "../../game/engine/GameEngine";
import { getCar } from "../../game/config/cars";
import { getPaint, getTrail, getWheel } from "../../game/config/cosmetics";
import { TIMES_OF_DAY, type TimeOfDayId } from "../../game/config/timeofday";
import {
  CAMERA_MODES,
  type CameraModeId,
  type CameraSettings,
} from "../../game/config/camera";
import { profileStore } from "../../game/state/persistence";
import { ROADS, RING_HALF, RING_RADIUS, STUNT, WORLD_RADIUS, roadExtent } from "../../game/engine/world";
import { PIT, TRACK, ovalPoint } from "../../game/engine/track";
import { Button } from "../ui/button";
import { StatusPanel } from "./StatusPanel";

type Status = "playing" | "paused";
type Popup = { id: number; text: string; kind: PopupKind };

let popupId = 0;

export function GameCanvas({ mode = "city" }: { mode?: "city" | "track" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("playing");
  const [stats, setStats] = useState<Stats>({
    speed: 0,
    x: 0,
    z: 0,
    heading: 0,
    coins: 0,
    nitro: 1,
    drifting: false,
    driftScore: 0,
    driftMult: 1,
    airborne: false,
    fuel: 1,
    tyres: 1,
  });
  const [popups, setPopups] = useState<Popup[]>([]);
  const [muted, setMuted] = useState(false);
  const [camMode, setCamMode] = useState<CameraModeId>("chase-close");
  const [camSettings, setCamSettings] = useState<CameraSettings>({
    distance: 1,
    height: 1,
    sensitivity: 1,
    shake: true,
    dynamicFov: true,
  });
  const [tod, setTod] = useState<TimeOfDayId>("sunny");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const profile = profileStore.get();
    setMuted(profile.muted);
    setTod(profile.timeOfDay as TimeOfDayId);
    setCamMode(profile.cameraMode);
    setCamSettings(profile.cameraSettings);
    const config: EngineConfig = {
      car: getCar(profile.selectedCar),
      paintColor: getPaint(profile.selectedPaint).value,
      wheelId: getWheel(profile.selectedWheel).id,
      nitroColor: getTrail(profile.selectedTrail).trailColor,
      upgrades: profile.upgrades,
      timeOfDay: profile.timeOfDay as TimeOfDayId,
      muted: profile.muted,
      cameraMode: profile.cameraMode,
      cameraSettings: profile.cameraSettings,
      mode,
    };

    const engine = new GameEngine(container, config, {
      onStats: setStats,
      onBankCoins: (amount) => profileStore.addCoins(amount),
      onDriftBanked: (score) => profileStore.recordDrift(score),
      onPopup: (text, kind) => {
        const id = popupId++;
        setPopups((p) => [...p.slice(-4), { id, text, kind }]);
        setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 900);
      },
      onEvent: (e) => {
        if (typeof navigator === "undefined" || !navigator.vibrate) return;
        if (e === "bump") navigator.vibrate(60);
        else if (e === "stunt" || e === "drift") navigator.vibrate([15, 30, 15]);
      },
    });
    engineRef.current = engine;
    engine.start();

    const onVisibility = () => {
      if (document.hidden && engineRef.current) {
        engineRef.current.pause();
        setStatus((s) => (s === "playing" ? "paused" : s));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      engineRef.current = null;
    };
  }, [mode]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
    setStatus("paused");
  }, []);
  const handleResume = useCallback(() => {
    engineRef.current?.resume();
    setStatus("playing");
  }, []);
  const handleRespawn = useCallback(() => {
    engineRef.current?.respawn();
    engineRef.current?.resume();
    setStatus("playing");
  }, []);

  const setControl = (action: ControlAction, active: boolean) => {
    engineRef.current?.setControl(action, active);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
    profileStore.setMuted(next);
  };

  const cycleCamera = () => {
    const idx = CAMERA_MODES.findIndex((m) => m.id === camMode);
    const next = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length].id;
    setCamMode(next);
    engineRef.current?.setCameraMode(next);
    profileStore.setCameraMode(next);
  };

  const changeCamMode = (mode: CameraModeId) => {
    setCamMode(mode);
    engineRef.current?.setCameraMode(mode);
    profileStore.setCameraMode(mode);
  };

  const changeCamSetting = (patch: Partial<CameraSettings>) => {
    setCamSettings((s) => ({ ...s, ...patch }));
    engineRef.current?.setCameraSettings(patch);
    profileStore.setCameraSettings(patch);
  };

  const changeTod = (id: TimeOfDayId) => {
    setTod(id);
    engineRef.current?.setTimeOfDay(id);
    profileStore.setTimeOfDay(id);
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-sky-200 no-select">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Speed motion blur + edge speed-lines (intensifies with velocity) */}
      <div
        className="pointer-events-none absolute inset-0 z-[4] transition-opacity duration-150"
        style={{
          opacity:
            status === "playing"
              ? Math.max(0, Math.min(1, (stats.speed - 90) / 130))
              : 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.10) 80%, rgba(255,255,255,0.24) 100%)",
          backdropFilter: "blur(2px)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, transparent 46%, black 82%)",
          maskImage: "radial-gradient(ellipse at center, transparent 46%, black 82%)",
        }}
      />

      {/* Subtle drift motion-blur / speed vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] transition-opacity duration-200"
        style={{
          opacity: status === "playing" && stats.drifting ? 1 : 0,
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.06) 68%, rgba(0,0,0,0.28) 100%)",
          backdropFilter: "blur(1.5px)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, transparent 45%, black 78%)",
          maskImage: "radial-gradient(ellipse at center, transparent 45%, black 78%)",
        }}
      />



      {/* On-screen driving controls */}
      {status === "playing" && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Steering — bottom left */}
          <div className="pointer-events-none absolute bottom-4 left-4 flex items-end gap-3">
            <ControlButton label="Turn left" size="lg" onChange={(a) => setControl("left", a)}>
              <ChevronLeft className="h-9 w-9" />
            </ControlButton>
            <ControlButton label="Turn right" size="lg" onChange={(a) => setControl("right", a)}>
              <ChevronRight className="h-9 w-9" />
            </ControlButton>
          </div>

          {/* Pedals & actions — bottom right */}
          <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <div className="flex items-end gap-2">
              <ControlButton label="Handbrake / drift" tone="warn" onChange={(a) => setControl("handbrake", a)}>
                <Hand className="h-7 w-7" />
              </ControlButton>
              <div className="flex flex-col items-center">
                <ControlButton
                  label="Nitro boost"
                  tone="nitro"
                  disabled={stats.nitro <= 0.02}
                  onChange={(a) => setControl("nitro", a)}
                >
                  <Zap className="h-7 w-7" />
                </ControlButton>
                <div className="mt-1 h-1.5 w-12 overflow-hidden rounded-full bg-background/50">
                  <div
                    className="h-full rounded-full bg-[#ffcf3f] transition-[width] duration-100"
                    style={{ width: `${Math.round(stats.nitro * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <ControlButton label="Reverse / brake" size="lg" onChange={(a) => setControl("reverse", a)}>
                <ChevronDown className="h-9 w-9" />
              </ControlButton>
              <ControlButton label="Accelerate" tone="go" size="lg" onChange={(a) => setControl("accel", a)}>
                <ChevronUp className="h-9 w-9" />
              </ControlButton>
            </div>
          </div>
        </div>
      )}

      {/* Top-left HUD */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-1.5">
        {status === "playing" && <MiniMap mode={mode} x={stats.x} z={stats.z} heading={stats.heading} />}
        <HudPill icon={<Coins className="h-4 w-4" />} value={stats.coins} tone="coin" />
        {stats.driftScore > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-[#ff5a5f] px-3 py-1 text-sm font-extrabold text-white shadow">
            <Flame className="h-4 w-4" />
            <span className="tabular-nums">{stats.driftScore}</span>
            <span className="rounded-full bg-white/25 px-1.5 text-xs">x{stats.driftMult}</span>
          </div>
        )}
      </div>

      {/* Fuel & tire status panel */}
      <StatusPanel fuel={stats.fuel} tyres={stats.tyres} />

      {/* Top-right speed and controls */}
      <div className="absolute right-3 top-3 z-30 flex items-start gap-2">
        {status === "playing" && <SpeedReadout speed={stats.speed} />}
        <button
          onClick={cycleCamera}
          aria-label="Switch camera view"
          className="flex h-11 items-center gap-1.5 rounded-full bg-background/80 px-3 text-foreground shadow-lg backdrop-blur transition-transform active:scale-90"
        >
          <Camera className="h-5 w-5" />
          <span className="text-xs font-bold">
            {CAMERA_MODES.find((m) => m.id === camMode)?.name ?? "Cam"}
          </span>
        </button>
        <IconBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </IconBtn>
        {status === "playing" && (
          <IconBtn label="Pause" onClick={handlePause}>
            <Pause className="h-5 w-5" />
          </IconBtn>
        )}
      </div>

      {/* Big drift banner */}
      {status === "playing" && stats.drifting && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 animate-pulse rounded-full bg-[#ff5a5f] px-5 py-1.5 text-lg font-extrabold text-white shadow-lg">
          DRIFT!
        </div>
      )}

      {/* Floating popups */}
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        {popups.map((p, i) => (
          <div
            key={p.id}
            className="absolute animate-[fade-out_0.9s_ease-out_forwards] text-2xl font-extrabold drop-shadow-lg"
            style={{
              color: p.kind === "coin" ? "#ffcf3f" : p.kind === "drift" ? "#ff5a5f" : "#4d7cff",
              transform: `translateY(${-40 - i * 30}px)`,
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* Pause menu */}
      {status === "paused" && (
        <Overlay>
          <h2 className="mb-4 text-3xl font-extrabold">Paused</h2>

          <div className="mb-4 w-full">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Time of day</p>
            <div className="grid grid-cols-3 gap-2">
              {TIMES_OF_DAY.map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeTod(t.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-muted p-2 text-xs font-bold transition-transform active:scale-95 ${
                    tod === t.id ? "border-[#4d7cff]" : "border-transparent"
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Camera view modes */}
          <div className="mb-4 w-full">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Camera view</p>
            <div className="grid grid-cols-5 gap-2">
              {CAMERA_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => changeCamMode(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-muted p-2 text-[10px] font-bold leading-tight transition-transform active:scale-95 ${
                    camMode === m.id ? "border-[#4d7cff]" : "border-transparent"
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Camera settings */}
          <div className="mb-4 w-full">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Camera settings</p>
            <div className="flex flex-col gap-3 rounded-2xl bg-muted p-3">
              <CamSlider
                label="Distance"
                value={camSettings.distance}
                min={0.6}
                max={1.6}
                onChange={(v) => changeCamSetting({ distance: v })}
              />
              <CamSlider
                label="Height"
                value={camSettings.height}
                min={0.6}
                max={1.6}
                onChange={(v) => changeCamSetting({ height: v })}
              />
              <CamSlider
                label="Sensitivity"
                value={camSettings.sensitivity}
                min={0.4}
                max={1.6}
                onChange={(v) => changeCamSetting({ sensitivity: v })}
              />
              <CamToggle
                label="Camera shake"
                on={camSettings.shake}
                onChange={(v) => changeCamSetting({ shake: v })}
              />
              <CamToggle
                label="Dynamic FOV"
                on={camSettings.dynamicFov}
                onChange={(v) => changeCamSetting({ dynamicFov: v })}
              />
            </div>
          </div>


          <div className="flex w-full flex-col gap-3">
            <Button size="lg" className="w-full" onClick={handleResume}>
              <Play className="mr-1 h-5 w-5" /> Resume
            </Button>
            <Button size="lg" variant="secondary" className="w-full" onClick={handleRespawn}>
              <RotateCcw className="mr-1 h-5 w-5" /> Respawn Car
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" asChild>
                <Link to="/garage">
                  <Warehouse className="mr-1 h-4 w-4" /> Garage
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                <Home className="mr-1 h-4 w-4" /> Menu
              </Button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}


function SpeedReadout({ speed }: { speed: number }) {
  return (
    <div className="pointer-events-none flex h-11 min-w-[86px] flex-col items-center justify-center rounded-full bg-background/80 px-4 shadow-lg backdrop-blur">
      <span className="text-xl font-extrabold leading-none tabular-nums">{speed}</span>
      <span className="text-[9px] font-bold uppercase leading-none tracking-widest text-muted-foreground">km/h</span>
    </div>
  );
}

function MiniMap({
  mode,
  x,
  z,
  heading,
}: {
  mode: "city" | "track";
  x: number;
  z: number;
  heading: number;
}) {
  const size = 136;
  const pad = 10;
  const worldSize = mode === "track" ? 760 : WORLD_RADIUS * 2;
  const scale = (size - pad * 2) / worldSize;
  const centre = size / 2;
  const toMap = (wx: number, wz: number) => ({
    x: centre + wx * scale,
    y: centre + wz * scale,
  });
  const car = toMap(x, z);
  const rot = (heading * 180) / Math.PI;

  return (
    <div className="h-[116px] w-[116px] overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-lg backdrop-blur-md sm:h-[136px] sm:w-[136px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <defs>
          <radialGradient id="minimap-ground" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#7acb70" />
            <stop offset="100%" stopColor="#4ea35f" />
          </radialGradient>
        </defs>
        <rect width={size} height={size} fill="#4aa8d8" />
        {mode === "track" ? <TrackMap scale={scale} toMap={toMap} /> : <CityMap scale={scale} toMap={toMap} />}
        <g transform={`translate(${car.x} ${car.y}) rotate(${rot})`}>
          <path d="M 0 -7 L 5 6 L 0 3 L -5 6 Z" fill="#ff5a5f" stroke="white" strokeWidth="1.4" />
        </g>
      </svg>
    </div>
  );
}

function CityMap({
  scale,
  toMap,
}: {
  scale: number;
  toMap: (wx: number, wz: number) => { x: number; y: number };
}) {
  const centre = toMap(0, 0);
  const stunt = toMap(STUNT.x, STUNT.z);

  return (
    <>
      <circle cx={centre.x} cy={centre.y} r={WORLD_RADIUS * scale} fill="url(#minimap-ground)" />
      <circle
        cx={centre.x}
        cy={centre.y}
        r={RING_RADIUS * scale}
        fill="none"
        stroke="#4b4f58"
        strokeWidth={RING_HALF * scale * 2}
      />
      {ROADS.map((road, i) => {
        const extent = roadExtent(road.pos);
        const a = road.axis === "z" ? toMap(-extent, road.pos) : toMap(road.pos, -extent);
        const b = road.axis === "z" ? toMap(extent, road.pos) : toMap(road.pos, extent);
        return (
          <line
            key={`${road.axis}-${road.pos}-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#4b4f58"
            strokeWidth={road.half * scale * 2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={stunt.x} cy={stunt.y} r={STUNT.radius * scale} fill="#5b6270" stroke="#ffcf3f" strokeWidth="1.3" />
      <circle cx={centre.x} cy={centre.y} r={WORLD_RADIUS * scale} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.4" />
    </>
  );
}

function TrackMap({
  scale,
  toMap,
}: {
  scale: number;
  toMap: (wx: number, wz: number) => { x: number; y: number };
}) {
  const outer = ovalPolyline(TRACK.half, toMap);
  const inner = ovalPolyline(-TRACK.half, toMap);
  const pitOuter = pitPolyline(PIT.latOuter, toMap);
  const pitInner = pitPolyline(PIT.latInner, toMap);

  return (
    <>
      <circle cx="68" cy="68" r={340 * scale} fill="url(#minimap-ground)" />
      <polygon points={`${outer} ${inner.split(" ").reverse().join(" ")}`} fill="#4b4f58" />
      <polyline points={pitOuter} fill="none" stroke="#3b404a" strokeWidth={(PIT.latOuter - PIT.latInner) * scale} strokeLinecap="round" />
      <polyline points={pitInner} fill="none" stroke="#ffcf3f" strokeWidth="1.2" />
      <polyline points={ovalPolyline(0, toMap)} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeDasharray="3 3" />
    </>
  );
}

function ovalPolyline(lat: number, toMap: (wx: number, wz: number) => { x: number; y: number }) {
  return Array.from({ length: 97 }, (_, i) => {
    const p = ovalPoint((i / 96) * Math.PI * 2, lat);
    const m = toMap(p.x, p.z);
    return `${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  }).join(" ");
}

function pitPolyline(lat: number, toMap: (wx: number, wz: number) => { x: number; y: number }) {
  return Array.from({ length: 33 }, (_, i) => {
    const theta = PIT.thetaStart - (i / 32) * (PIT.thetaStart - PIT.thetaEnd);
    const p = ovalPoint(theta, lat);
    const m = toMap(p.x, p.z);
    return `${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  }).join(" ");
}


function ControlButton({
  label,
  children,
  onChange,
  tone = "default",
  size = "md",
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onChange: (active: boolean) => void;
  tone?: "default" | "go" | "warn" | "nitro";
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "go"
      ? "bg-[#4d7cff]/70 text-white active:bg-[#4d7cff]"
      : tone === "warn"
        ? "bg-[#ff5a5f]/60 text-white active:bg-[#ff5a5f]"
        : tone === "nitro"
          ? "bg-[#ffcf3f]/70 text-[#33251a] active:bg-[#ffcf3f]"
          : "bg-background/50 text-foreground active:bg-background/80";
  const sizeClass = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onPointerLeave={() => onChange(false)}
      className={`pointer-events-auto flex touch-none select-none items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-transform active:scale-90 disabled:opacity-40 ${toneClass} ${sizeClass}`}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg backdrop-blur transition-transform active:scale-90 ${
        active ? "bg-[#4d7cff] text-white" : "bg-background/80 text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function HudPill({
  icon,
  value,
  tone,
}: {
  icon: React.ReactNode;
  value: string | number;
  tone: "default" | "coin";
}) {
  const toneClass = tone === "coin" ? "text-[#a9760a] bg-[#fff2c2]" : "text-foreground bg-background/80";
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold shadow backdrop-blur ${toneClass}`}>
      {icon}
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="animate-[scale-in_0.2s_ease-out] flex max-h-[92dvh] w-full max-w-sm flex-col items-center overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function CamSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm font-bold">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-background accent-[#4d7cff]"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}

function CamToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center justify-between text-sm font-bold"
    >
      <span>{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          on ? "bg-[#4d7cff]" : "bg-background"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

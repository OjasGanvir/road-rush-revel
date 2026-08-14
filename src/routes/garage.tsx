import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Coins,
  Check,
  Lock,
  Play,
  Gauge as GaugeIcon,
  Zap,
  Shield,
  Activity,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { CarPreview } from "../components/game/CarPreview";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CARS, getCar, type CarDef } from "../game/config/cars";
import {
  PAINTS,
  TRAILS,
  WHEELS,
  getPaint,
  getTrail,
  getWheel,
  type WheelItem,
} from "../game/config/cosmetics";
import { UPGRADES } from "../game/config/upgrades";
import { profileStore, useProfile, type Profile } from "../game/state/persistence";
import { RotateDeviceOverlay } from "../components/game/RotateDeviceOverlay";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "Garage — Drift Dash" },
      {
        name: "description",
        content: "Unlock cars, paint colors, wheels and trails, and buy permanent upgrades in the Drift Dash garage.",
      },
      { property: "og:title", content: "Garage — Drift Dash" },
      { property: "og:description", content: "Customize your ride and upgrade your run." },
    ],
  }),
  component: Garage,
});

type OwnedCategory = keyof Profile["owned"];

function Garage() {
  const profile = useProfile();

  const [activeTab, setActiveTab] = useState<string>("cars");
  const [previewCarId, setPreviewCarId] = useState<string>(profile.selectedCar);
  const [previewPaintId, setPreviewPaintId] = useState<string>(profile.selectedPaint);
  const [previewWheelId, setPreviewWheelId] = useState<string>(profile.selectedWheel);
  const [previewTrailId, setPreviewTrailId] = useState<string>(profile.selectedTrail);

  const previewCar = getCar(previewCarId);
  const equippedCar = getCar(profile.selectedCar);
  const previewPaint = getPaint(previewPaintId);
  const previewWheel = getWheel(previewWheelId);
  const previewTrail = getTrail(previewTrailId);

  // Check ownership & equipped status for current preview item depending on active tab
  const getItemStatus = () => {
    if (activeTab === "cars") {
      const owned = profile.owned.cars.includes(previewCarId);
      const equipped = profile.selectedCar === previewCarId;
      return { owned, equipped, price: previewCar.price, name: previewCar.name, category: "cars" as OwnedCategory, id: previewCarId, selectField: "selectedCar" as keyof Profile };
    }
    if (activeTab === "paint") {
      const owned = profile.owned.paints.includes(previewPaintId);
      const equipped = profile.selectedPaint === previewPaintId;
      return { owned, equipped, price: previewPaint.price, name: previewPaint.name, category: "paints" as OwnedCategory, id: previewPaintId, selectField: "selectedPaint" as keyof Profile };
    }
    if (activeTab === "wheels") {
      const owned = profile.owned.wheels.includes(previewWheelId);
      const equipped = profile.selectedWheel === previewWheelId;
      return { owned, equipped, price: previewWheel.price, name: previewWheel.name, category: "wheels" as OwnedCategory, id: previewWheelId, selectField: "selectedWheel" as keyof Profile };
    }
    if (activeTab === "trails") {
      const owned = profile.owned.trails.includes(previewTrailId);
      const equipped = profile.selectedTrail === previewTrailId;
      return { owned, equipped, price: previewTrail.price, name: previewTrail.name, category: "trails" as OwnedCategory, id: previewTrailId, selectField: "selectedTrail" as keyof Profile };
    }
    return null;
  };

  const statusInfo = getItemStatus();

  const handleEquip = (selectField: keyof Profile, id: string) => {
    profileStore.update((p) => ({ ...p, [selectField]: id } as Profile));
  };

  const handleBuy = (category: OwnedCategory, selectField: keyof Profile, id: string, price: number) => {
    profileStore.update((p) => {
      if (p.coins < price) return p;
      const currentOwned = p.owned[category];
      if (currentOwned.includes(id)) {
        return { ...p, [selectField]: id } as Profile;
      }
      return {
        ...p,
        coins: p.coins - price,
        owned: { ...p.owned, [category]: [...currentOwned, id] },
        [selectField]: id,
      } as Profile;
    });
  };

  const upgrade = (id: keyof Profile["upgrades"], max: number, costs: number[]) => {
    profileStore.update((p) => {
      const level = p.upgrades[id];
      if (level >= max) return p;
      const cost = costs[level];
      if (p.coins < cost) return p;
      return {
        ...p,
        coins: p.coins - cost,
        upgrades: { ...p.upgrades, [id]: level + 1 },
      };
    });
  };

  return (
    <>
      <RotateDeviceOverlay />
      <div className="h-screen w-screen max-w-full min-h-[100dvh] overflow-hidden bg-gradient-to-b from-[#f7f9ff] via-[#eef4ff] to-[#f8fafc] text-slate-900 flex flex-col select-none">
        {/* Full-Width Header */}
        <div className="h-14 flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 sm:px-6 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-700 hover:bg-slate-100 rounded-xl" asChild>
              <Link to="/" aria-label="Back to menu">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#ffcf3f]" />
              <h1 className="text-lg sm:text-xl font-extrabold tracking-wide text-slate-900">GARAGE SHOWROOM</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-[#ffcf3f]/20 border border-[#ffcf3f]/40 px-3.5 py-1.5 text-sm font-extrabold text-[#ffcf3f] backdrop-blur">
              <Coins className="h-4 w-4" />
              <span className="tabular-nums">{profile.coins}</span>
            </div>
            <Button asChild size="sm" className="h-9 rounded-xl bg-gradient-to-r from-[#ff5a5f] to-[#ff2a30] px-4 font-extrabold shadow-md hover:brightness-110 active:scale-95">
              <Link to="/play" search={{ mode: "city" }}>
                <Play className="mr-1.5 h-4 w-4 fill-current" /> Race
              </Link>
            </Button>
          </div>
        </div>

        {/* Full Screen Grid Layout (Occupies 100% Width & Height, No Outer Scroll) */}
        <div className="flex-1 w-full p-3 sm:p-4 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Left Column: Interactive 3D Stage & Vehicle Specs */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-h-0 h-full">
            {/* 3D Stage Container */}
            <div className="relative flex-1 rounded-2xl sm:rounded-3xl border border-slate-200 bg-gradient-to-b from-white/80 via-[#f5f8ff] to-white/70 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-md overflow-hidden min-h-[220px]">
              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-700 backdrop-blur border border-slate-200">
                🖱️ Drag to rotate 360°
              </span>

              <CarPreview
                carId={previewCarId}
                paintId={previewPaintId}
                wheelId={previewWheelId}
                trailId={previewTrailId}
                className="h-full w-full"
              />

              {/* Action Bar Overlay */}
              {statusInfo && (
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur-md z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Previewing</span>
                    <span className="text-sm font-extrabold text-slate-900">{statusInfo.name}</span>
                  </div>

                  {statusInfo.equipped ? (
                    <div className="flex items-center gap-1.5 rounded-xl bg-[#43d675]/20 border border-[#43d675]/40 px-4 py-1.5 text-xs font-extrabold text-[#43d675]">
                      <Check className="h-4 w-4" /> Equipped
                    </div>
                  ) : statusInfo.owned ? (
                    <Button
                      onClick={() => handleEquip(statusInfo.selectField, statusInfo.id)}
                      className="bg-[#4d7cff] hover:bg-[#3b68e6] text-white font-extrabold rounded-xl px-5 h-9"
                    >
                      Equip Item
                    </Button>
                  ) : (
                    <Button
                      disabled={profile.coins < statusInfo.price}
                      onClick={() => handleBuy(statusInfo.category, statusInfo.selectField, statusInfo.id, statusInfo.price)}
                      className="bg-gradient-to-r from-[#ffcf3f] to-[#ff9f45] text-[#241700] hover:brightness-110 font-extrabold rounded-xl px-5 h-9 shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {profile.coins < statusInfo.price ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Lock className="h-3.5 w-3.5" /> Need {statusInfo.price} Coins
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <ShoppingBag className="h-3.5 w-3.5" /> Buy for {statusInfo.price}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Vehicle Specs Bar */}
            <CarSpecsPanel car={previewCar} equippedCar={equippedCar} isPreviewingDifferent={previewCar.id !== profile.selectedCar} />
          </div>

          {/* Right Column: Customization & Upgrade Shop Panel */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 min-h-0 h-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-white/80 p-3 sm:p-4 backdrop-blur shadow-xl overflow-hidden">
            <Tabs defaultValue="cars" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-5 bg-slate-100 border border-slate-200 p-1 rounded-2xl flex-shrink-0">
                <TabsTrigger value="cars" className="rounded-xl text-xs font-extrabold data-[state=active]:bg-[#4d7cff] data-[state=active]:text-white">Cars</TabsTrigger>
                <TabsTrigger value="paint" className="rounded-xl text-xs font-extrabold data-[state=active]:bg-[#4d7cff] data-[state=active]:text-white">Paint</TabsTrigger>
                <TabsTrigger value="wheels" className="rounded-xl text-xs font-extrabold data-[state=active]:bg-[#4d7cff] data-[state=active]:text-white">Wheels</TabsTrigger>
                <TabsTrigger value="trails" className="rounded-xl text-xs font-extrabold data-[state=active]:bg-[#4d7cff] data-[state=active]:text-white">Nitro</TabsTrigger>
                <TabsTrigger value="upg" className="rounded-xl text-xs font-extrabold data-[state=active]:bg-[#4d7cff] data-[state=active]:text-white">Upgrades</TabsTrigger>
              </TabsList>

              {/* Cars Tab */}
              <TabsContent value="cars" className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 gap-2.5">
                {CARS.map((c) => {
                  const owned = profile.owned.cars.includes(c.id);
                  const equipped = profile.selectedCar === c.id;
                  const previewing = previewCarId === c.id;
                  return (
                    <CarShopCard
                      key={c.id}
                      car={c}
                      owned={owned}
                      equipped={equipped}
                      previewing={previewing}
                      canAfford={profile.coins >= c.price}
                      onSelect={() => setPreviewCarId(c.id)}
                    />
                  );
                })}
              </TabsContent>

              {/* Paint Tab */}
              <TabsContent value="paint" className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-3 gap-2.5">
                {PAINTS.map((p) => {
                  const owned = profile.owned.paints.includes(p.id);
                  const equipped = profile.selectedPaint === p.id;
                  const previewing = previewPaintId === p.id;
                  return (
                    <CosmeticCard
                      key={p.id}
                      title={p.name}
                      price={p.price}
                      owned={owned}
                      equipped={equipped}
                      previewing={previewing}
                      canAfford={profile.coins >= p.price}
                      swatch={p.value}
                      onSelect={() => setPreviewPaintId(p.id)}
                    />
                  );
                })}
              </TabsContent>

              {/* Wheels Tab */}
              <TabsContent value="wheels" className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 gap-2.5">
                {WHEELS.map((w) => {
                  const owned = profile.owned.wheels.includes(w.id);
                  const equipped = profile.selectedWheel === w.id;
                  const previewing = previewWheelId === w.id;
                  return (
                    <WheelShopCard
                      key={w.id}
                      wheel={w}
                      owned={owned}
                      equipped={equipped}
                      previewing={previewing}
                      canAfford={profile.coins >= w.price}
                      onSelect={() => setPreviewWheelId(w.id)}
                    />
                  );
                })}
              </TabsContent>

              {/* Trails Tab */}
              <TabsContent value="trails" className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-2 gap-2.5">
                {TRAILS.map((t) => {
                  const owned = profile.owned.trails.includes(t.id);
                  const equipped = profile.selectedTrail === t.id;
                  const previewing = previewTrailId === t.id;
                  return (
                    <CosmeticCard
                      key={t.id}
                      title={t.name}
                      price={t.price}
                      owned={owned}
                      equipped={equipped}
                      previewing={previewing}
                      canAfford={profile.coins >= t.price}
                      swatch={t.trailColor ?? "#cbd5e1"}
                      onSelect={() => setPreviewTrailId(t.id)}
                    />
                  );
                })}
              </TabsContent>

              {/* Upgrades Tab */}
              <TabsContent value="upg" className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5">
                {UPGRADES.map((u) => {
                  const level = profile.upgrades[u.id];
                  const maxed = level >= u.maxLevel;
                  const cost = maxed ? 0 : u.costs[level];
                  const canAfford = profile.coins >= cost;
                  return (
                    <div key={u.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{u.name}</h3>
                          <p className="text-[11px] text-slate-500">{u.description}</p>
                        </div>
                        <span className="shrink-0 text-xs font-extrabold text-[#ffcf3f]">
                          Lv {level}/{u.maxLevel}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: u.maxLevel }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 flex-1 rounded-full ${i < level ? "bg-[#4d7cff]" : "bg-white/10"}`}
                            />
                          ))}
                        </div>
                        <Button
                          size="sm"
                          disabled={maxed || !canAfford}
                          onClick={() => upgrade(u.id, u.maxLevel, u.costs)}
                          className="bg-white/15 hover:bg-white/25 text-white border border-white/10 font-bold h-8 text-xs"
                        >
                          {maxed ? "Maxed" : (
                            <span className="flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5 text-[#ffcf3f]" /> {cost}
                            </span>
                          )}
                        </Button>
                      </div>

                      {/* Per-level price breakdown */}
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="font-bold text-slate-700 mr-2">Prices:</span>
                        <div className="flex gap-1 items-center">
                          {u.costs.map((c, i) => {
                            const isCurrent = i === level && !maxed;
                            return (
                              <div
                                key={i}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${isCurrent ? "bg-[#fff7e6] border border-[#ffdf9b] text-[#b65f00]" : "bg-slate-100 text-slate-700"}`}
                                title={`Level ${i + 1}: ${c} coins`}
                              >
                                L{i + 1}: {c}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}

/** Car Specifications Component */
function CarSpecsPanel({ car, equippedCar, isPreviewingDifferent }: { car: CarDef; equippedCar: CarDef; isPreviewingDifferent: boolean }) {
  const topSpeedKmh = Math.round(car.topSpeed * 2.8);
  const accelScore = Math.round((car.accel / 50) * 100);
  const gripScore = Math.round((car.grip / 4.5) * 100);
  const nitroScore = Math.round((car.nitroStrength / 1.5) * 100);

  const equippedTopSpeed = Math.round(equippedCar.topSpeed * 2.8);
  const speedDiff = topSpeedKmh - equippedTopSpeed;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 backdrop-blur shadow-md flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold text-slate-900">{car.name} Specs</span>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#4d7cff]">
            {car.class}
          </span>
        </div>
        {isPreviewingDifferent && speedDiff !== 0 && (
          <span className={`text-xs font-extrabold ${speedDiff > 0 ? "text-[#43d675]" : "text-[#ff4d5e]"}`}>
            {speedDiff > 0 ? `+${speedDiff} km/h` : `${speedDiff} km/h`} vs current
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <StatRow icon={<GaugeIcon className="h-3.5 w-3.5 text-[#ffcf3f]" />} label="Top Speed" value={`${topSpeedKmh} km/h`} pct={Math.min(100, (topSpeedKmh / 240) * 100)} />
        <StatRow icon={<Zap className="h-3.5 w-3.5 text-[#ff5a5f]" />} label="Accel" value={`${accelScore}`} pct={accelScore} />
        <StatRow icon={<Shield className="h-3.5 w-3.5 text-[#4d7cff]" />} label="Handling" value={`${gripScore}`} pct={gripScore} />
        <StatRow icon={<Activity className="h-3.5 w-3.5 text-[#c56bff]" />} label="Nitro Power" value={`${nitroScore}`} pct={nitroScore} />
      </div>
    </div>
  );
}

function StatRow({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: string; pct: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="flex items-center gap-1 text-slate-600">
          {icon} {label}
        </span>
        <span className="tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4d7cff] to-[#6bcb77] transition-all duration-300"
          style={{ width: `${Math.max(5, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

/** Inline SVG car silhouette based on body proportions */
function CarSilhouette({ car }: { car: CarDef }) {
  const [w, h, l] = car.size;
  // Normalised proportions (car length mapped to ~80px wide, height scaled proportionally)
  const svgW = 80;
  const scale = svgW / l;
  const bodyW = l * scale;
  const bodyH = h * scale;
  const cabinH = (car.class === "suv" || car.class === "offroad" ? h * 1.05 : h * 0.85) * scale;
  const cabinW = (car.class === "muscle" || car.class === "hyper" ? l * 0.42 : l * 0.5) * scale;
  const rideOff = Math.max(0, car.rideHeight) * scale * 1.5;
  const wheelR = (0.34 + Math.max(0, car.rideHeight) * 0.5) * scale;
  const totalH = bodyH + cabinH + rideOff + wheelR * 2 + 4;

  return (
    <svg width={svgW} height={totalH} viewBox={`0 0 ${svgW} ${totalH}`} fill="none" className="drop-shadow-lg">
      {/* Body */}
      <rect
        x={(svgW - bodyW) / 2}
        y={totalH - wheelR * 2 - bodyH - rideOff - 2}
        width={bodyW}
        height={bodyH}
        rx={3}
        fill={car.color}
        opacity={0.9}
      />
      {/* Cabin */}
      <rect
        x={(svgW - cabinW) / 2}
        y={totalH - wheelR * 2 - bodyH - cabinH - rideOff - 2}
        width={cabinW}
        height={cabinH}
        rx={2}
        fill={car.cabin}
        opacity={0.85}
      />
      {/* Front wheel */}
      <circle cx={svgW * 0.22} cy={totalH - wheelR - 1} r={wheelR} fill="#2a2d3a" stroke="#555" strokeWidth={1} />
      {/* Rear wheel */}
      <circle cx={svgW * 0.78} cy={totalH - wheelR - 1} r={wheelR} fill="#2a2d3a" stroke="#555" strokeWidth={1} />
      {/* Headlight */}
      <rect x={(svgW - bodyW) / 2 + 1} y={totalH - wheelR * 2 - bodyH * 0.5 - rideOff} width={3} height={2.5} rx={0.5} fill="#fff6c2" />
      {/* Taillight */}
      <rect x={(svgW + bodyW) / 2 - 4} y={totalH - wheelR * 2 - bodyH * 0.5 - rideOff} width={3} height={2.5} rx={0.5} fill="#ff5a5f" />
    </svg>
  );
}

/** Inline SVG wheel/rim spoke diagram */
function WheelDiagram({ wheel }: { wheel: WheelItem }) {
  const r = 22;
  const cx = 26;
  const cy = 26;
  const spokeCount = wheel.spokes;

  return (
    <svg width={52} height={52} viewBox="0 0 52 52" fill="none" className="drop-shadow-md">
      {/* Tire */}
      <circle cx={cx} cy={cy} r={r} fill="#1a1c23" stroke="#333" strokeWidth={1.5} />
      {/* Rim face */}
      <circle cx={cx} cy={cy} r={r - 5} fill={wheel.wheelColor} opacity={0.85} />
      {/* Spokes */}
      {Array.from({ length: spokeCount }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / spokeCount - Math.PI / 2;
        const x2 = cx + Math.cos(angle) * (r - 6);
        const y2 = cy + Math.sin(angle) * (r - 6);
        return (
          <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#1a1c23" strokeWidth={wheel.style === "mesh" ? 1 : 2} strokeLinecap="round" opacity={0.7} />
        );
      })}
      {/* Hub */}
      <circle cx={cx} cy={cy} r={4} fill="#1a1c23" />
      <circle cx={cx} cy={cy} r={2} fill={wheel.wheelColor} opacity={0.6} />
    </svg>
  );
}

/** CarX-style car shop card with inline car silhouette and quick stats */
function CarShopCard({
  car,
  owned,
  equipped,
  previewing,
  canAfford,
  onSelect,
}: {
  car: CarDef;
  owned: boolean;
  equipped: boolean;
  previewing: boolean;
  canAfford: boolean;
  onSelect: () => void;
}) {
  const locked = !owned && !canAfford;
  const topSpeedKmh = Math.round(car.topSpeed * 2.8);
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-white/90 p-3 shadow-md transition-all active:scale-95 ${
        previewing
          ? "border-[#4d7cff] bg-[#4d7cff]/10 shadow-[0_0_15px_rgba(77,124,255,0.3)]"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {equipped && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#43d675] text-black font-bold">
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}

      {/* Car silhouette */}
      <CarSilhouette car={car} />

      {/* Name & class */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-extrabold text-slate-900">{car.name}</span>
        <span className="text-[9px] uppercase font-bold text-slate-500">{car.class}</span>
      </div>

      {/* Quick speed badge */}
      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-700">
        <GaugeIcon className="h-2.5 w-2.5 text-[#ffcf3f]" /> {topSpeedKmh} km/h
      </span>

      {owned ? (
        <span className={`text-[11px] font-extrabold ${equipped ? "text-[#43d675]" : "text-[#4d7cff]"}`}>
          {equipped ? "Equipped" : "Owned"}
        </span>
      ) : (
        <span className={`flex items-center gap-1 text-[11px] font-extrabold ${locked ? "text-slate-400" : "text-[#ffcf3f]"}`}>
          {locked ? <Lock className="h-3 w-3" /> : <Coins className="h-3 w-3" />} {car.price}
        </span>
      )}
    </button>
  );
}

/** Wheel shop card with spoke diagram and style description */
function WheelShopCard({
  wheel,
  owned,
  equipped,
  previewing,
  canAfford,
  onSelect,
}: {
  wheel: WheelItem;
  owned: boolean;
  equipped: boolean;
  previewing: boolean;
  canAfford: boolean;
  onSelect: () => void;
}) {
  const locked = !owned && !canAfford;
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-white/90 p-3 shadow-md transition-all active:scale-95 ${
        previewing
          ? "border-[#4d7cff] bg-[#4d7cff]/10 shadow-[0_0_15px_rgba(77,124,255,0.3)]"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {equipped && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#43d675] text-black font-bold">
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}

      {/* Wheel spoke diagram */}
      <WheelDiagram wheel={wheel} />

      {/* Name & style */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-extrabold text-slate-900">{wheel.name}</span>
        <span className="text-[9px] uppercase font-bold text-slate-500">{wheel.style}</span>
      </div>

      {/* Description */}
      <span className="text-[9px] text-slate-500 text-center leading-tight">{wheel.desc}</span>

      {owned ? (
        <span className={`text-[11px] font-extrabold ${equipped ? "text-[#43d675]" : "text-[#4d7cff]"}`}>
          {equipped ? "Equipped" : "Owned"}
        </span>
      ) : (
        <span className={`flex items-center gap-1 text-[11px] font-extrabold ${locked ? "text-slate-400" : "text-[#ffcf3f]"}`}>
          {locked ? <Lock className="h-3 w-3" /> : <Coins className="h-3 w-3" />} {wheel.price}
        </span>
      )}
    </button>
  );
}

/** Generic Cosmetic Item Card (Paint, Trails) */
function CosmeticCard({
  title,
  price,
  owned,
  equipped,
  previewing,
  canAfford,
  swatch,
  onSelect,
}: {
  title: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  previewing: boolean;
  canAfford: boolean;
  swatch: string;
  onSelect: () => void;
}) {
  const locked = !owned && !canAfford;
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-white/90 p-3 shadow-md transition-all active:scale-95 ${
        previewing
          ? "border-[#4d7cff] bg-[#4d7cff]/10 shadow-[0_0_15px_rgba(77,124,255,0.3)]"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {equipped && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#43d675] text-black font-bold">
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      )}
      <span
        className="h-8 w-8 rounded-full border border-white/20 shadow-inner"
        style={{ backgroundColor: swatch }}
      />
      <span className="text-xs font-bold text-slate-900 text-center leading-tight">{title}</span>
      {owned ? (
        <span className={`text-[11px] font-extrabold ${equipped ? "text-[#43d675]" : "text-[#4d7cff]"}`}>
          {equipped ? "Equipped" : "Owned"}
        </span>
      ) : (
        <span className={`flex items-center gap-1 text-[11px] font-extrabold ${locked ? "text-slate-400" : "text-[#ffcf3f]"}`}>
          {locked ? <Lock className="h-3 w-3" /> : <Coins className="h-3 w-3" />} {price}
        </span>
      )}
    </button>
  );
}

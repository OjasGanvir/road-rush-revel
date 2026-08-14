import { useEffect, useState } from "react";
import { Smartphone, RotateCw } from "lucide-react";

/**
 * Prompts the player to rotate to landscape on narrow portrait screens.
 * Automatically attempts to lock screen orientation to landscape where supported.
 */
export function RotateDeviceOverlay() {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const tryLockOrientation = async () => {
      try {
        if (window.screen?.orientation && "lock" in window.screen.orientation) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window.screen.orientation as any).lock("landscape").catch(() => {});
        }
      } catch {
        // Fallback for browsers that block programmatic lock without user gesture
      }
    };
    tryLockOrientation();

    const check = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      const isPortraitScreen = window.innerHeight > window.innerWidth;
      setPortrait(isPortraitScreen);
    };

    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!portrait) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-5 bg-slate-950/95 p-6 text-center text-white backdrop-blur-xl">
      <div className="relative flex items-center justify-center">
        <Smartphone className="h-20 w-20 text-white/40 animate-pulse" />
        <RotateCw className="absolute h-10 w-10 text-[#4d7cff] animate-spin [animation-duration:4s]" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          LANDSCAPE MODE REQUIRED
        </h2>
        <p className="text-sm font-semibold text-slate-300">
          Drift City is designed to be played in landscape mode for full-screen vision and arcade controls.
        </p>
        <span className="mt-2 text-xs font-bold text-[#ffcf3f] uppercase tracking-widest bg-[#ffcf3f]/10 border border-[#ffcf3f]/30 py-1.5 px-3 rounded-full">
          📱 Rotate your phone sideways
        </span>
      </div>
    </div>
  );
}


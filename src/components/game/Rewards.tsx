import { useState } from "react";
import { Gift, Coins, Trophy, Check, Lock } from "lucide-react";
import { useProfile, profileStore, canClaimDaily } from "../../game/state/persistence";
import { ACHIEVEMENTS, DAILY_REWARD } from "../../game/config/achievements";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export function DailyReward() {
  const profile = useProfile();
  const available = canClaimDaily(profile);

  return (
    <div className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white/85 p-3 shadow-md backdrop-blur">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffcf3f]/25 text-[#e0a800]">
        <Gift className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight text-[#22252e]">Daily Reward</p>
        <p className="text-[11px] font-semibold text-muted-foreground">
          {available
            ? `Claim ${DAILY_REWARD} coins today`
            : `Claimed — streak ${profile.dailyStreak} day${profile.dailyStreak === 1 ? "" : "s"}`}
        </p>
      </div>
      <Button
        size="sm"
        disabled={!available}
        onClick={() => profileStore.claimDaily(DAILY_REWARD)}
        className="h-9 rounded-xl bg-[#ffcf3f] font-extrabold text-[#22252e] shadow-[0_3px_0_#c9a01f] hover:bg-[#ffd960] disabled:opacity-60"
      >
        {available ? (
          <>
            <Coins className="mr-1 h-4 w-4" /> +{DAILY_REWARD}
          </>
        ) : (
          <>
            <Check className="mr-1 h-4 w-4" /> Done
          </>
        )}
      </Button>
    </div>
  );
}

export function Achievements() {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const claimable = ACHIEVEMENTS.filter(
    (a) => !profile.claimedAchievements.includes(a.id) && a.progress(profile) >= a.goal,
  ).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="relative mt-3 h-14 w-full rounded-2xl text-lg font-bold shadow-md"
        >
          <Trophy className="mr-2 h-5 w-5" /> Achievements
          {claimable > 0 && (
            <span className="absolute right-3 top-2 rounded-full bg-[#ff5a5f] px-2 py-0.5 text-xs font-extrabold text-white">
              {claimable}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-extrabold">Achievements</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map((a) => {
            const progress = Math.min(a.progress(profile), a.goal);
            const done = progress >= a.goal;
            const claimed = profile.claimedAchievements.includes(a.id);
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold leading-tight">{a.name}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">{a.description}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={!done || claimed}
                    onClick={() => profileStore.claimAchievement(a.id, a.reward)}
                    className="h-8 shrink-0 rounded-lg font-extrabold"
                  >
                    {claimed ? (
                      <>
                        <Check className="mr-1 h-4 w-4" /> Claimed
                      </>
                    ) : done ? (
                      <>
                        <Coins className="mr-1 h-4 w-4" /> {a.reward}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-1 h-4 w-4" /> {a.reward}
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#4d7cff] transition-all"
                    style={{ width: `${(progress / a.goal) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] font-bold text-muted-foreground">
                  {progress} / {a.goal}
                </p>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

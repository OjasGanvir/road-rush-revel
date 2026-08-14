# Better Car Turning

## What's wrong today

Steering is currently a direct "rotate the car" formula, not a real cornering model:
`djcnn`
- `heading += steerInput * turnRate * dt * rollBite * highSpeedCalm * dirSign`
- `highSpeedCalm = 1 / (1 + speed * 0.045)` — at high speed this cuts turn rate to roughly a quarter, so fast corners feel like the wheel is stuck.
- Below ~3 units/s (`rollBite`) the car barely turns at all, so tight manoeuvres and parking feel dead.
- Sideways velocity (`vl`) is added by a separate "kick" term unrelated to the actual rotation, so the car rotates and slides in ways that don't match each other — the "bad" floaty feel.
- Steering input smoothing is a single fixed rate (`dt * 9`) with no self-centering, so returning to straight is mushy.

## The fix: a proper arcade cornering model

Replace the steering block in `GameEngine.ts` with a bicycle-model turn, the same shape used by arcade driving games:

1. **Steering angle, not turn rate.** Keep a smoothed front-wheel angle. Turn-in is quick, return-to-center is quicker (self-centering), so the car snaps back to straight cleanly.
2. **Speed-sensitive steering lock.** Max steering angle shrinks smoothly with speed (full lock when slow, tightened at high speed) instead of the harsh `highSpeedCalm` divide. High-speed corners stay responsive but stable.
3. **Yaw from wheelbase.** Turn rate derived as `speed * tan(steerAngle) / wheelbase`, so the turning circle is consistent and physically believable at every speed — the car always carves an arc instead of pivoting.
4. **Low-speed pivot assist.** A small extra yaw term at crawl speeds so tight turns, U-turns and parking work without the car refusing to rotate.
5. **Lateral force tied to rotation.** Drop the arbitrary `vl` kick. Sideways velocity comes from grip limit vs. required cornering force: within grip the car follows the arc (front end bites), past the limit it slides — that's natural understeer at speed and oversteer under handbrake/power.
6. **Handbrake drift kept and improved.** Handbrake cuts rear grip, so the tail steps out and yaw increases; counter-steer already restores grip and will now feel connected because both yaw and slide come from the same model.
7. **Per-car character preserved.** `turnRate` maps to steering lock, `grip`/`weight` set cornering limit and turn-in lag, `driftControl` sets counter-steer authority — so hypercar vs. SUV vs. muscle still feel different (SUVs lazier turn-in, hypercar sharp, muscle loose).

## Also updated

- Front wheels visually steer with the real steer angle (currently a flat `steerInput * 0.4`).
- Body roll driven by actual lateral force instead of the old proxy, so lean matches the corner.
- Air-steer authority left as-is (no free spinning).

## Technical notes

All changes are confined to the grounded-physics steering section of `src/game/engine/GameEngine.ts` (plus the wheel-visual line). No config, UI, save-data, or control-layout changes; existing left/right buttons and keyboard mapping are untouched. Verified with a typecheck and a Playwright drive test (turn left/right at low and high speed, handbrake drift, no console errors).
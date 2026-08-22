---
'@simten/embed': patch
'@simten/ui': patch
---

Auto-run now batches ticks per frame instead of firing one per timer.

Each `tick()` is a postMessage round trip to the sandbox plus a React render,
and browsers clamp nested interval callbacks to ~4ms — so `setInterval(tick,
1000/speed)` delivered a couple of hundred cycles a second no matter what the
slider asked for, while the engine itself does thousands. `useCircuitSimulator`
now drives `tickN` (N cycles, one round trip) at the display rate, with an
in-flight guard so a slow batch skips rather than queues.

Measured in the editor: 1000 tick/s delivered ~250 before, 990 after; 10000
delivers 9990.

With that fixed the ceiling is worth raising, so `MAX_SPEED` goes to 10,000 and
the slider becomes logarithmic — a linear track with a 10k ceiling put the
entire sub-100 tick/s range, which is where stepping and the game live, in the
first half-pixel. Each quarter of the track is now one decade.

`DEFAULT_SPEED` and `MAX_SPEED` are exported from `@simten/ui`, replacing the
`maxSpeed={1000}` / `|| 15` pair that was duplicated across the web editor and
the game.

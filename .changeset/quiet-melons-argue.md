---
'@simten/core': patch
---

Stop copying memory contents on every clock tick.

Committing sequential state cloned every memory `Map` twice per tick, and the
onTick wrapper cloned it a third time before handing it over. None of those three
copies asked whether anything had been written. `ROM` declares
`onTick: ({ memory }) => ({ memory })`, so a read-only wavetable was copied three
times per cycle in order to return itself unchanged.

The cost scaled with the size of the memory, which is the wrong axis: a larger ROM
is not more work to read from.

Copy-on-write instead. `onTick` is handed the committed Map directly and the first
write clones it, so a tick that writes nothing costs nothing. Commit adopts the Map
it is given rather than copying it a second and third time.

| ROM entries | before | after |
|---|---|---|
| 256 | 25k ticks/s | 342k |
| 1024 | 7k | 292k |
| 4096 | 1.7k | 306k |

The size dependence is gone, so memory can be sized for what the design needs
rather than for what the simulator can afford. A memory node still costs more per
tick than a plain register, but it is now a constant rather than a slope.

Snapshots alias the committed Map by reference (`toFlatSequentialState`), so the
old per-tick clone was load-bearing for time travel without anything recording
that it was. A write still produces a fresh Map, which preserves the invariant,
and `snapshot-roundtrip.test.ts` now covers memory state directly — including that
a held snapshot survives later writes, and that a read-only memory is handed
through untouched across ticks.

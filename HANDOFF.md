# Handoff — Simten challenge game

## Where things stand

`apps/game` is a ten-level campaign at `play.simten.dev` (dev: `localhost:3003`).
The map is the front door; there is no list page.

Everything described here is **on `main`**:

- **#293** — four Act 1 levels, the map as a running circuit, the drilldown,
  array-valued `nodes` in `@simten/core`
- **#294** — map as `/`, editor gated per level, arithmetic band, reference
  solutions as typechecked files
- **#295** — `@simten/ui` fix: a wire between two composites rendered grey while
  carrying a 1. That bug affected `/circuit` and the RV32I demos too, not only
  the game

Branch fresh from `main` before starting.

**The dev sandbox must be running.** `pnpm dev:sandbox` (port 3002). Without it
the canvas is blank and Submit never grades — it looks like a bug and is not.
The game server on 3003 is run by the user; do not start your own.

## The levels

Ten, in four bands. `apps/game/src/game/levels.ts`.

| # | id | target | allowed | par |
|---|---|---|---|---|
| 1 | `first-wire` | `Nand1` | Nand | 1 |
| 2 | `not-from-nand` | `Not1` | Nand | 1 |
| 3 | `and-from-nand` | `And2` | Nand | 2 |
| 4 | `or-from-nand` | `Or1` | Nand | 3 |
| 5 | `nor-from-nand` | `Nor1` | Nand | 4 |
| 6 | `xor-from-nand` | `Xor1` | Nand | 4 |
| 7 | `xnor-from-nand` | `Xnor1` | Nand | 5 |
| 8 | `making-a-component` | `Xor2` | Nand | 4 |
| 9 | `half-adder` | `HalfAdder` | `ARITHMETIC_GATES` | 2 |
| 10 | `full-adder` | `FullAdder` | `ARITHMETIC_GATES` | 5 |

Level 8's id **changed** from `half-adder` to `making-a-component` so the real
half adder could take the name. That is a live URL change.

`ARITHMETIC_GATES` is every gate the player built from NAND, handed back. It is
the only place `allowed` grows, which is what makes the completion card's unlock
line fire — once, after level 8: *"Not, And, Or, Nor, Xor, Xnor unlocked"*.

## The persistence task

This is the next thing to build: four finished features are inert without it.
Composition later builds on top of it — a passing snapshot is a field added to
`progress` — but that is not part of this task.

### Two records, one copy of the source

```
simten:game:drafts     per level: the source currently in the editor
simten:game:progress   per level: { gates: number }
```

These are different *kinds* of data, not two copies of the same thing. The draft
restores your work on refresh. Progress is a flag and a score — it is what the
map's green nodes, the lit wires, `ENFORCE_LOCKING` and the header chip read,
and it needs no source at all.

Do not store the passing source yet. Nothing reads it: no level imports another
level's circuit today, since the full adder's half adder lives in its own stub
rather than being pulled from level 9. Building a snapshot store with no
consumer is work with nothing to verify it against.

**When composition lands**, `progress` gains a `source` field holding the
solution that last *passed*, and the split earns its keep. Downstream levels must
then read that snapshot rather than the draft — otherwise going back and
mangling your half adder breaks a later level built on it, with an error
pointing at code you are not looking at. Re-solve it and the better version
propagates, which is the good version of that behaviour. The interface is safe
by construction there: a snapshot only exists because it passed, and passing
means `grade.ts` already verified it exposes the signals the level named.

### What exists already

`apps/game/src/game/storage.ts` — `readStored(key, fallback)` and
`writeStored(key, data)`. SSR-guarded, parse wrapped in try/catch, every record
carries a `version` envelope so a format change is detectable rather than
silently misread. The intro flag is its only caller today.

### Wiring, file by file

1. **`storage.ts`** — add typed accessors over the generic pair:
   `readDrafts(): Record<string, string>` and
   `readProgress(): Record<string, { gates: number }>`, plus writers. Keep the
   envelope.

2. **`routes/play.$levelId.tsx`**
   - Seed the editor from the draft: `useState(level.stub)` becomes the draft if
     one exists. The route already remounts per level via `key`, so the
     initialiser runs per level — do not add an effect for this.
   - Write the draft on change (debounce; every keystroke is wasteful).
   - On `verdict.status === 'pass'`, write `{ gates: verdict.gates }` to
     progress. No source — see above.

3. **`routes/index.tsx`** (the map) — read progress, derive a `Set` of solved
   ids, pass it to `<LevelMap solved={…} />`. The prop already exists and is
   already threaded into `buildMapGraph(solved)` and `simulateMap(solved)`.

4. **`components/LevelMap.tsx`** — flip `ENFORCE_LOCKING` to `true`. Read its
   docstring first; this is a design decision, not just a switch. Locking gives
   the map stakes and makes the unlock line mean something, but levels are
   reachable by URL regardless so it is a soft gate.

5. **`components/LevelDrilldown.tsx`** — one line. `SOLUTIONS[level.id]` becomes
   the **draft** for that level, falling back to the reference answer for levels
   never opened. Not a passing snapshot, which will not exist — and the draft is
   the better source anyway, because the drilldown *shows* you your work rather
   than depending on it. If you edited a solved level, seeing the edited version
   is correct.

   This also shrinks the spoiler: `solutions/` currently ships every answer to
   the browser, documented as temporary in `solutions/index.ts`. It stays as the
   fallback for unopened levels rather than disappearing.

6. **Add a reset-level button.** Once drafts persist there is no way back to the
   stub, and a player who mangles a given preamble is stuck.

### Traps

- **SSR.** Read storage in an effect, never during render, or you get a
  hydration mismatch. `IntroDialog.tsx` does it correctly — copy that shape.
- **Do not write the draft on mount.** The first render carries the stub; a
  write-on-mount overwrites a real draft with the stub before it is read.
- **The theme key is `theme`, not namespaced.** Written by an inline script in
  `__root.tsx` that runs before paint. Do not route it through `storage.ts` —
  they have to agree on the default (`dark`), and a mismatch there already caused
  one bug where the page loaded dark and flipped to light.

### Verify

`pnpm --filter @simten/game test` (105 today), `tsc --noEmit`, `pnpm lint` (590
warning baseline — do not raise it).

Then **in the browser**, because every UI bug in this project has passed the test
suite: solve a level, refresh, confirm the draft survives; go back and break a
solved level, confirm a later level still works; confirm the map goes green and
the drilldown shows your circuit.

## After persistence

**Cut NOR and XNOR.** They teach nothing new — both are "bolt a NOT onto the
thing you just built". Agreed repeatedly, never done.

**Add two problem levels.** Act 1 has no level whose title withholds the answer.
Do *not* copy Turing Complete's list — its gate order is deliberately shared, but
lifting its level names reads as a clone. Two that come from this campaign's own
arc:

- **Majority** — three switches, light when most are on. Secretly the carry-out
  of a full adder, so it rehearses something needed two bands later.
- **Exactly one** — three switches, light when precisely one is on. Sounds like
  XOR and is not; XOR-of-three is true for one *or* three. That gap is the
  puzzle.

**Then the byte band.** `Invert a byte` — eight switches, eight lamps, one loop.
Array-valued nodes shipped in `@simten/core`, and this was verified end to end
through the game's own execution path. It is the level that shows why this is
not nandgame.

**Then composition.** `Adding Bytes` needs a half adder *and* a full adder
available. The stub trick used in level 10 works for exactly one hop before the
scenery compounds. Two things are proven and neither is built:

- Library components can be real `.ts` files loaded with Vite's `?raw`
  (verified: composed and graded at 5 gates)
- Monaco resolves relative imports across models with full type flow (verified
  live: `h1.bogus` errored with the real port type while `h1.sum` did not) — so
  no hand-written type declarations are needed

The remaining piece is teaching the sandbox to resolve `./half-adder`.
`rewrite-imports.ts` already does that shape of work for npm via blob URLs.
Cheapest version: prepend the library source and let the existing
import-stripping remove the player's import line — that needs one condition in
`rewriteSpecifier` treating relative specifiers like `@simten/*` (skip them).

To use the player's *own* circuit as a component you also need a deharness
transform: a passing self-contained solution exposes node ids, not ports, so
`Switch`/`Led` must become `inputs`/`outputs`. The names are grader-guaranteed.
`createDrillDownViewCircuit` does the same job in the other direction and is a
working precedent.

## How the pieces work

**Level format** — `game/types.ts`. Pure data: `id`, `title`, `brief`, `target`,
`inputs`/`outputs` (bare signal-name arrays), `allowed`, `stub`, `vectors`,
`par?`, `outro`.

**`allowed` does three jobs**, and they are starting to conflict:

1. which primitives may appear in the flattened netlist (`forbiddenPrimitives`)
2. the scoring list — `countGates` counts nodes whose type is in it
3. what the editor puts in scope

A composite never survives flattening, so it cannot go in `allowed` to be made
available — that would serve (3) while breaking (1) and (2). Splitting scope out
is the change library components will force.

**Editor gating** — `buildGlobalsFor(names)` in `@simten/ui/monaco` filters the
generated ambient globals to a subset, JSDoc intact. The level page composes it
from `allowed ∪ STRUCTURAL ∪ helpers`. On a NAND level `Xor` does not
autocomplete and does not compile. `STRUCTURAL` is exported from `grade.ts` so
the editor and grader cannot disagree.

**Stubs open below a given component** — `givenPreambleEnd` in
`routes/play.$levelId.tsx`. Level 10 hands over a finished half adder, and
landing on it makes the level look like it starts with someone else's code. It
fires *only* when a circuit is defined above the target: on every other level the
text above `export default circuit(` is the hint, and scrolling past it would
hide the teaching. Keyed off structure rather than a per-level flag, and pinned
by `__tests__/preamble.test.ts`.

**npm works inside circuits.** `import figlet from 'figlet'` resolves via esm.sh
in the editor and canvas — there is an `npm → ROM` example in
`packages/core/src/examples/catalog.ts` that runs figlet at build time and bakes
the result into a ROM. Static imports only; dynamic `import()` is rejected at
compile because the URL itself is an exfiltration channel. Note the two paths
differ: `executeCircuitCode` (tests, headless) strips imports and injects the
stdlib as globals, while the sandbox rewrites and loads them.

**Reference solutions** — `game/solutions/*.ts`, real files loaded via `?raw`.
They typecheck: a wrong port name fails `tsc` rather than surviving to a grader
failure. ⚠️ `?raw` is **Vite-only** — vitest resolves it, a bare `tsx` script
does not. Use vitest when poking at these.

**The map is a real circuit** — `game/map-circuit.ts` builds an actual
`circuit()`: a `Switch` per level, a `Constant` feeding row 0, `And` gates where
a row has several prerequisites, and an `Led` per level whose value *is* its
unlock state. `simulateMap` runs it on the same engine as player circuits. Wire
colour comes from the canvas's `WIRE_COLORS`, so a live wire is the same green a
`1` is everywhere else.

**Map bands** — `MAP_SECTIONS` in `game/map.ts`, declared by the row each opens
on. `SECTION_PAD_TOP`/`BOTTOM` are budgeted out of `ROW_GAP - NODE_HEIGHT`;
overrun it and adjacent bands overlap instead of separating.

**Grading** — `game/grade.ts`, four ordered checks: circuit exists → exposes the
named signals → built only from permitted primitives → truth table. Score is
positive: nodes whose type is in `allowed`.

## Known, deliberately unfixed

- **`GradeReport` was deleted.** `vector` failures are covered by the truth
  table's red column, but `interface` failures ("no output signal `out`") are now
  **silent**. `forbidden` matters less since the editor filter prevents it.
- **`BaseNode` handle styling in `@simten/ui` is inert.** It sets
  `h-3 w-3 bg-blue-500` for connected ports, but `@xyflow/react/dist/style.css`
  defines `.react-flow__handle` at the same specificity and is imported after the
  utilities, so every port on every canvas renders as React Flow's 6px default.
  Measured, not inferred.
- **monaco version skew in `apps/game`.** It declares `^0.52.2` but a direct
  `import from 'monaco-editor'` resolves **0.55.1**, while the editor prop's type
  comes from `@simten/ui`'s 0.52.2 — two incompatible `IStandaloneCodeEditor`
  types. Let types infer from the prop rather than importing monaco types.
- **`check_circuit` (MCP) fails on `Switch`/`Led`** with "Cannot read properties
  of undefined", so every self-contained circuit — which is levels 1–7 — is
  uncheckable through the MCP. They export correctly from `@simten/core/std` in
  both source and dist, so it is the MCP's own resolution.
- **`Adding Bytes` has a display problem.** Sixteen inputs and nine outputs is 25
  signal rows in the truth table. Needs a different presentation for wide levels.
- Level briefs render as plain text, so backticks show literally.
- No hint affordance. The cheapest real one is a circuit diff: run the player's
  circuit and the reference over the vectors, find the first divergent row, then
  walk their netlist for the earliest node whose value is wrong. That teaches
  debugging rather than giving the answer, and needs no authored content.

## Conventions

Conventional Commits, **one line, no `Co-Authored-By`**. Biome runs first in CI,
so `pnpm lint` before pushing. Pull `main` and branch fresh. Every change to a
published package (`@simten/core`, `@simten/ui`, `@simten/embed`, `@simten/mcp`)
needs a changeset; apps are in the ignore list.

## Honest assessment

It is more of a game than it was — the arithmetic ladder gives it a spine, and
the editor gating means rules are visible rather than discovered by breaking
them. It still is not *fun* in the way Zachtronics is. Two of ten levels are real
puzzles; the rest are recipes where the title names the answer.

The code-only bet is still unexploited, because the game is too short to need it.
At eight gates dragging would be fine. Typing only wins at scale, and the byte
band is the first place that shows.

And the gap to "game" is content, which is human-authored and cannot be
shortcut. The project notes say the goal is visibility and to bias toward launch
and outreach over feature-building. Several sessions have now been
feature-building. The cheapest useful thing remains putting what exists in front
of five people and watching whether the typing feels like thinking.

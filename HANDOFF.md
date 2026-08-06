# Handoff — Simten challenge game

## Where things stand

`apps/game` is a playable four-level campaign at `play.simten.dev` (dev: `localhost:3003`).
All four levels have been solved end to end in a browser. The engine works.

**Branch `feat/game-level-complete` has uncommitted work** that must be committed and
PR'd before anything else:

- `packages/ui/src/primitives/dialog.tsx` — new shadcn Dialog over Radix Dialog (the
  same library `Sheet` already uses, so no new dependency). Exported as
  `@simten/ui/primitives/dialog`, wired into `exports` **and** `publishConfig.exports`.
- `apps/game/src/components/LevelComplete.tsx` — completion dialog.
- Per-level `outro: { headline, body }` on the `Level` type, written for all four levels.
- Level 2's stub now places `n1: Nand` and pre-wires `n1.out.to(out.in)`.
- `SpecPanel` shows failures only; a pass belongs to the dialog.

Needs a changeset for `@simten/ui` (minor — new export). Everything else is app-local.

Merged already: #285 #286 #287 #289. PR #290 is an open Version Packages release.

## The task

Add Act 1's four missing levels to `apps/game/src/game/levels.ts`:

```
1  First Wire          (And given)     exists
2  NOT from NAND                       exists
3  AND from NAND       ADD  ~2 gates, 4 wires
4  OR from NAND        ADD  ~3 gates, 5 wires   ← De Morgan, the insight of the act
5  NOR from NAND       ADD  ~4 gates, 6 wires
6  XOR from NAND                       exists (renumber after 5)
7  XNOR from NAND      ADD  ~5 gates, 7 wires
8  Making a Component                  exists (currently id `half-adder`, keep the id —
                                       it is public URL surface)
```

Loosely follows Turing Complete's own order (NAND → NOT → {AND, NOR, OR} → XOR → XNOR).
Each new level is a few minutes. This takes Act 1 from ten minutes to something with a
shape, and fills the gap where the scaffolding currently drops sharply between levels 2
and 3.

## Design rules that were argued out — do not quietly reverse these

**Levels are self-contained.** `Switch` nodes → your gates → `Led` nodes. **No `inputs`/
`outputs` ports.** A circuit with ports gets wrapped by `autoHarness` and renders as one
opaque `dut` box, which hides the gates the player just wrote — the entire feedback loop.
`autoHarness` returns the circuit untouched when it declares no ports
(`packages/core/src/circuit/auto-harness.ts:23`), so self-contained levels get the raw
view for free. Level 8 is the deliberate exception: introducing ports *is* its lesson,
and the black box is the point.

**Composition is for ingredients, never for the dish.** What you build this level is
always self-contained and fully visible. What you *reuse* from an earlier level is a box
you can double-click into. Never let the thing under construction collapse.

**Watch the wire budget.** Act 1 levels are 4–7 `.to()` lines. That is fine. A 4-bit
adder written as raw gates is ~90 lines and would be unplayable; built from the player's
own `FullAdder` it is ~12. Composition is not a nice-to-have arriving late — it is what
decides whether Act 2 exists. Nothing today lets a level import a previous solution;
**that is the real design work after this task.**

**Skip TC's byte-widening grind.** Byte NAND / Byte NOT / Adding Bytes / Byte XOR exist
in TC because wiring eight copies by hand is its difficulty. `bus(8)` makes eight bits
one wire. Replace that whole band with a single parameterised-width level.

**Names are fixed and that is fine** (LeetCode does the same). What was wrong was the
silence — solved in #287: the editor warns inline on the exact line, the preview falls
back to the last circuit defined so the canvas never blanks, and the panel always shows
"Must define". Do not reintroduce a silent failure here.

**Stubs use `export default circuit('Name', …)`.** One occurrence of the name, no unused
`const`. Verified this registers identically to the `const` form — `stripExports`
rewrites it to a bare expression.

## How the pieces work

**Level format** — `apps/game/src/game/types.ts`. A level is pure data: `id`, `title`,
`brief`, `target` (circuit name), `inputs`/`outputs` (**bare signal-name arrays**, not
port maps), `allowed` (primitive names), `stub`, `vectors`, `par?`, `outro`.
Nothing executes, so levels can move to R2 later as plain JSON.

**Grading** — `apps/game/src/game/grade.ts`, four ordered checks: circuit exists →
exposes the named signals → built only from permitted primitives → truth table.
The score is **positive**: `gates = nodes whose type ∈ allowed`. Counting everything and
subtracting an exclusion list means a forgotten primitive silently inflates par; this way
`Switch`/`Led` never count because they are not in `allowed`.

**Runtime** — `apps/game/src/game/runtime.ts`. `GradeRuntime` is a narrow interface so
the grader runs host-side in tests. Two traps already paid for:

- `sandbox.compile` builds its simulator on the **last** circuit in the source, so
  `select()` pins the target by name via `compileIR`. Without it a helper defined below
  the answer gets graded instead.
- Output keys differ between runtimes — the sandbox namespaces top-level ports under
  `__top__.`, `@simten/core/sim` returns them bare. `resolveOutput` reads
  `__top__.<name>` else `<name>.in`. A missing signal is an **error**, never a default
  of 0; a `?? 0` fallback silently passed every row expecting 0, which is most of them.

**The validation gate** — `apps/game/src/game/__tests__/levels.test.ts`. Every level
ships a reference solution that must pass, **and** constant-0/constant-1 answers that
must fail. The second direction catches a tautological grader and is invisible if you
only test that solutions pass. **Add a reference solution for every new level** — the
suite asserts the set matches `LEVELS` exactly.

## Verification

```
pnpm --filter @simten/game test       # 47 currently; add ~4 per new level
pnpm --filter @simten/game exec tsc --noEmit
pnpm test                             # check-exports + all packages
pnpm lint                             # 590-warning baseline, do not raise it
```

Browser is not optional. Every UI bug this session — blank canvas, stale layout, broken
truth table, state surviving navigation — passed the test suite. Dev server is on
**:3003**, run by the user; do not start your own. Drive it with the Playwright MCP:
`window.monaco.editor.getModels()[0].setValue(...)` edits the editor,
`document.querySelector('button.bg-primary').click()` submits.

## Conventions

Conventional Commits, **one line, no `Co-Authored-By`**. Biome runs first in CI, so
`pnpm lint` before pushing. **Pull `main` and branch fresh before starting** — a stale
branch cost a conflict this session. Every change to a published package
(`@simten/core`, `@simten/ui`, `@simten/embed`, `@simten/mcp`) needs a changeset;
apps are in the changesets ignore list.

## Known, deliberately unfixed

- Level briefs render as plain text, so backticks show literally.
- No hint affordance. Levels 2–3 are where someone will stall; this is the highest-value
  UX addition after the levels themselves.
- No persistence — refresh loses everything. localStorage was designed but not built:
  `simten:game:progress` (solved + gates) and `simten:game:drafts` (source per level),
  behind a narrow module so D1 can replace it later. Guard SSR, wrap the parse, include a
  `version` field. Do this before any playtest, or lost progress will read as "broken".
- No level map. The intent is that it *is* a circuit — solved levels as `Switch` nodes,
  prerequisites as real `And` gates, unlock state as the simulator's actual output. TC's
  map only looks like circuitry; ours would run. Edges should mean genuine dependency
  ("this level imports the XOR you built"), not just suggested order.
- Embed utility classes are unprefixed, so a host page also running Tailwind gets two
  definitions of `.flex`. Deliberate: needs a divergent Tailwind config before anything
  breaks, and scoping the sheet risks the `.dark` trigger that intentionally matches the
  host's element.
- `pnpm --filter @simten/web build` fails at prerendering on a Cloudflare API auth error,
  after both Vite bundles build fine. Pre-existing and unrelated; matches the note about
  wrangler defaulting to the wrong account.

## Honest assessment, so the next agent does not oversell it

It is satisfying, not yet fun. The victory sweep — the lamp following the truth table,
driven by the player's own circuit — is the best thing in it and should be protected.
But two of four levels have no puzzle (level 1 hands you the answer, level 8 is level 6
retyped), there is no reason to solve anything twice, and there is no viral loop at all:
no share, no score comparison, no persistence, no map.

The gap to "game" is mostly **content**, which is human-authored and cannot be shortcut.
Before paying that cost, the cheapest useful thing is to put the existing levels in front
of five people and watch — specifically whether the typing feels like thinking or like
typing, which is the bet the whole code-only decision rests on.

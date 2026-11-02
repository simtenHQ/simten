# @simten/game

The puzzle game at [play.simten.dev](https://play.simten.dev): start from a NAND gate and
build up to a CPU, one level at a time. It's a TanStack Start app deployed as a
Cloudflare Worker.

```bash
pnpm dev:game      # from the repo root: the game on :3003
pnpm dev:sandbox   # the sandbox on :3002, needed for circuits to draw and grade
```

Where things are:

- `src/game/levels.ts`: every level, in order: its brief, the parts it allows, its
  starter code and the test vectors it's graded on.
- `src/game/solutions/`: a working solution for each level.
- `src/game/grade.ts`: grading, which runs the player's circuit in the sandbox.
- `src/routes/`: the map and the level page.

`pnpm test` grades every solution against its level, so a change that breaks a level
fails there. Deploy with `pnpm deploy:game` from the root.

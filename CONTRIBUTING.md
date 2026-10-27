# Contributing to Simten

Thanks for taking the time. This doc covers setup, workflow, and what we expect from PRs.

If anything here is unclear or wrong, open an issue. Fixing this doc is a great first contribution.

## Quick start

You need [Node 20+](https://nodejs.org/) and [pnpm 8+](https://pnpm.io/installation) (run `corepack enable` once and pnpm gets pinned to the version in `package.json`).

```bash
git clone https://github.com/simtenhq/simten
cd simten
pnpm install
pnpm dev:all     # web app on :3001 + sandbox on :3002 + embed pages on :3004
```

Open <http://localhost:3001>. The editor, simulator, docs, blog and learn pages all work end-to-end. You're done.

To work on the game (play.simten.dev) instead, run the sandbox and the game side by side:

```bash
pnpm dev:sandbox   # :3002, runs player code
pnpm dev:game      # :3003
```

Open <http://localhost:3003>. Both apps run player code in the sandbox iframe, so it needs to be up for levels to grade.

Embed pages (embed.simten.dev) run on :3004 with `pnpm dev:embed`, alongside the web app and the sandbox. In dev they read the shares the local web app creates, so Share → Embed in the editor previews them. `pnpm --filter @simten/embed-page test:e2e` builds the page and checks it from another origin in a browser.

## Setup tiers

What you need depends on what you're working on.

### Tier 1: UI, game, circuits, docs, blog, learn pages, simulator (most contributions)

- Node 20+
- pnpm 8+

That's it. The simulator runs entirely in the browser, so there's nothing extra to install.

### Tier 2: Verilog / FPGA toolchain (`apps/compiler`, `apps/synth`, `apps/verifier`)

Add **Docker**. Then:

```bash
pnpm --filter @simten/compiler dev     # RISC-V cross-compiler on :55001
pnpm --filter @simten/synth dev        # Yosys synthesis
pnpm --filter @simten/verifier dev     # iverilog cross-validation
```

On the dev server (`vite dev`) the `@simten/web` app calls the containers on localhost when there's no service binding, and skips rate limits it has no binding for, so running the compiler container locally is enough to test the flow end-to-end. A deployed build never does either; see `apps/web/src/api/deploy-mode.ts`.

### Tier 3: FPGA hardware flow (`hardware/ulx3s/`)

Add a ULX3S board, [openFPGALoader](https://github.com/trabucayre/openFPGALoader) (or fujprog), and the relevant USB driver. See `hardware/ulx3s/README.md`. You only need this if you're working on the bitstream or the on-chip CPU path.

## Project structure

```
apps/
  web/               ← main React app (editor, docs, blog, learn), `@simten/web`
  game/              ← play.simten.dev, the level campaign, `@simten/game`
  embed-page/        ← embed.simten.dev, shared circuits for iframes, `@simten/embed-page`
  sandbox/           ← isolated iframe that runs user circuit code
  compiler/          ← Cloudflare Container: RISC-V cross-compiler
  synth/             ← Cloudflare Container: Yosys synthesis
  verifier/          ← Cloudflare Container: iverilog cross-validation
packages/
  core/              ← circuit IR, simulator, stdlib, Verilog exporter
  ui/                ← React components (canvas, editor, waveform)
  embed/             ← embeddable React Flow viewer
  mcp/               ← MCP server for Claude Code integration
hardware/ulx3s/      ← FPGA bitstream build pipeline

apps/web/content/docs/   ← the MDX behind simten.dev/docs
```

## Workflow

We use trunk-based development with PRs:

1. Branch from `main`: `git checkout -b feat/your-thing`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (see below)
3. Push the branch: `git push -u origin feat/your-thing`
4. Open a PR against `main`
5. CI runs Biome, tests, and the workspace build automatically
6. After review, merge. The CI deploy workflow ships it to production

### Before opening a PR

```bash
pnpm lint                          # Biome lint + format check (first CI gate)
pnpm test                          # every package's tests, plus the export and synth-limit checks
pnpm typecheck                     # type-check across the workspace
```

If `pnpm lint` complains, `pnpm lint:fix` fixes most of it, formatting included.

### Code style

We use [Biome](https://biomejs.dev/) for both linting and formatting. `biome.json` at the repo root is the entire config. Don't match style by eye, run the formatter.

```bash
pnpm lint          # check (this is what CI runs)
pnpm lint:fix      # fix lint + format
pnpm format        # format only
```

The settings that come up most: single quotes, semicolons everywhere including `.tsx`, 2-space indent, 100-column lines, trailing commas.

CI runs `biome ci` as its first gate. **Errors block the build; warnings don't.** The warnings you'll see are pre-existing a11y and `noExplicitAny` findings being cleaned up incrementally. Leave them alone unless you're already touching that code, and don't add new ones.

VS Code is set up for you: `.vscode/settings.json` makes Biome the default formatter with format-on-save, and `.vscode/extensions.json` recommends the extension. On any other editor, install the Biome plugin or run `pnpm lint:fix` before you commit.

One repo-wide formatting commit is listed in `.git-blame-ignore-revs`. GitHub honors it automatically; to get the same locally:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/). Look at `git log --oneline` for examples; the repo is consistent.

Format: `<type>(<scope>): <subject>`

Common types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`.

Examples from the history:
```
feat(deploy): sandbox wrangler config + workspace deploy scripts
refactor(core): rename circuit() builder keys in/out → inputs/outputs
fix(ci): build workspace packages before web app
docs(hardware): cover CPU project, FPGA workflow, and the UART skid race
```

The subject should describe the *outcome*, not the change. "Fix bug" is bad. "Drop duplicate pnpm version" is good.

## The sandbox

Circuit code is arbitrary TypeScript, so neither the web app nor the game ever runs it directly. Every surface that runs user code (the editor, the game, embed pages, `<circuit-embed>`) sends it to `apps/sandbox`, a hidden iframe on its own origin, which runs it in a Web Worker and sends back plain JSON. Because it's a different origin, user code can't read the main site's cookies, storage or DOM.

- **Where it runs:** `localhost:3002` in dev, `sandbox.simtenusercontent.dev` in production. Set `VITE_SANDBOX_ORIGIN` to point at a different one, e.g. a staging sandbox.
- **If it isn't running:** nothing compiles or grades. The app waits about 10 seconds for the iframe to say it's ready, then gives up. If circuits silently never simulate, check that `pnpm dev:sandbox` (or `pnpm dev:all`) is up.
- **What code sees:** the sandbox strips `import` lines and provides the stdlib as globals. That's why game stubs and solutions can keep real imports for `tsc` and still run.
- **Deploying:** the production web app and game load the deployed sandbox. Changes to `@simten/core` or the sandbox itself only show up on simten.dev and play.simten.dev after `pnpm deploy:sandbox`.

The full threat model (worker isolation, timeouts, what crosses the boundary) is in [`apps/web/content/docs/security.mdx`](apps/web/content/docs/security.mdx), also published at simten.dev/docs.

## Working on the game

Levels live in `apps/game/src/game/`:

- `levels.ts` holds every level: its brief, the starting code (`stub`), the parts it allows, the test vectors and `par`.
- `solutions/<level-id>.ts` is a reference answer for each level, registered in `solutions/index.ts`. They're real TypeScript, so a typo fails `tsc`.
- `map.ts` places the level on the campaign map.

`pnpm --filter @simten/game test` checks that every reference solution passes its level and that the solutions match `LEVELS` one to one, so a new level needs all three.

Players' code is saved per level in their browser, and a saved draft takes priority over the stub. Changing a stub only reaches new players, or anyone who presses Reset. Existing progress isn't affected.

`apps/game/LEVELS-NEXT.md` sketches where the campaign could go next.

## Larger features

For anything bigger than a bug fix or small feature, **open an issue first**. We'll discuss the approach before you write code. This saves both of us from a PR that goes nowhere because the design wasn't aligned.

If you're not sure whether something is "big enough" to warrant an issue first, it probably isn't, so just open the PR.

## Asking questions

[GitHub Issues](https://github.com/simtenhq/simten/issues) for anything: bug, feature request, design question, "is this thing intentional?". Tag with `question` if it's a question rather than work.

## Code of conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Bad behavior gets the contributor blocked, no warning needed.

## License

Apache 2.0 (see [LICENSE](./LICENSE)). By contributing, you agree your contributions are licensed under the same terms.

## Publishing

Packages are released with [Changesets](https://github.com/changesets/changesets). Record one on any PR that touches `@simten/core`, `@simten/ui`, `@simten/embed` or `@simten/mcp`; apps are in the ignore list.

```bash
pnpm changeset    # record a changeset for your PR
pnpm release      # build everything and publish (CI)
```

### How the exports work

Each publishable package has two `exports` blocks in its `package.json`:

```jsonc
{
  "exports": {
    ".":         "./src/index.ts",          // dev: read source directly
    "./circuit": "./src/circuit/index.ts"
  },
  "publishConfig": {
    "exports": {
      ".":         { "types": "./dist/index.d.ts",         "import": "./dist/index.js" },
      "./circuit": { "types": "./dist/circuit/index.d.ts", "import": "./dist/circuit/index.js" }
    }
  }
}
```

`pnpm` and `npm` swap in `publishConfig.exports` at publish time, so people installing from the registry get compiled `.js` and `.d.ts` from `dist/`. Inside the monorepo the block is inert and you always get source.

The point is that no tool needs a custom resolve condition. Vite (browser and Workers SSR), vitest and tsc all resolve `@simten/*` through the standard `default`/`import` keys, so adding a new tool does not mean adding a fifth config file.

### Adding an export subpath

A new entry in `exports` needs a matching entry in `publishConfig.exports`. `tsx scripts/check-exports.ts` runs as part of `pnpm test` and fails CI when the two drift. It checks four things:

1. `exports` and `publishConfig.exports` have identical key sets.
2. Every dev-export path exists on disk in `src/`.
3. For entries shaped `./src/<segs>/index.<ext>` ↔ `./dist/<same-segs>/index.<ext'>`, the segments match.
4. If any `publishConfig.exports` path points at `./dist/...`, `files` includes `"dist"`.

To see what consumers will actually receive, without publishing:

```bash
cd packages/core && pnpm pack --pack-destination /tmp
tar -tzf /tmp/simten-core-*.tgz                    # dist/, never src/
tar -xzf /tmp/simten-core-*.tgz -O package/package.json | jq .exports
```

`@simten/embed` is the one package with a non-trivial build: `tsc -b` for the React surface (`.`, `./nodes`, `./canvas`), then a Vite IIFE pass for the web-component drop-in (`./webcomponent` → `dist/circuit-embed.js`, `./styles.css` → `dist/styles.css`). The Vite step sets `emptyOutDir: false` so it does not wipe the tsc output.

## Notes for maintainers

If you're reviewing a PR from an external fork:

- **Don't `pnpm install` blindly.** A malicious `package.json` can run `postinstall` scripts on your machine. Read the diff, particularly any new `scripts` or `dependencies`, before installing.
- **For unknown contributors**, prefer reviewing in [Codespaces](https://github.com/features/codespaces) or a devcontainer rather than your laptop. (Devcontainer config is on the roadmap; until it lands, a fresh shell with no sensitive paths mounted is the manual workaround.)
- **`pnpm install --ignore-scripts`** is a useful intermediate option when reading the diff for new lifecycle scripts isn't enough.

The threat model: fork PRs run their `package.json` on your shell. Your CF API token, your `~/.ssh`, your `~/.config/wrangler` are all in scope if `postinstall` does something hostile. CI secrets are GitHub-protected; your laptop isn't.

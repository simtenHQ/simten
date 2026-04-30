# Contributing to Simten

Thanks for taking the time. This doc covers setup, workflow, and what we expect from PRs.

If anything here is unclear or wrong, open an issue — fixing this doc is a great first contribution.

## Quick start

You need [Node 20+](https://nodejs.org/) and [pnpm 8+](https://pnpm.io/installation) (run `corepack enable` once and pnpm gets pinned to the version in `package.json`).

```bash
git clone https://github.com/simtenhq/simten
cd simten
pnpm install
pnpm dev:all     # web app on :3001 + sandbox on :3002
```

Open <http://localhost:3001>. The editor, simulator, blog, learn pages, and chat sidebar all work end-to-end. You're done.

## Setup tiers

What you need depends on what you're working on.

### Tier 1 — UI, circuits, docs, blog, learn pages, simulator (~90% of contributions)

- Node 20+
- pnpm 8+

That's it. The simulator runs entirely in the browser; nothing extra to install.

### Tier 2 — Verilog / FPGA toolchain (`apps/compiler`, `apps/synth`, `apps/verifier`)

Add **Docker**. Then:

```bash
pnpm --filter @simten/compiler dev     # RISC-V cross-compiler on :55001
pnpm --filter @simten/synth dev        # Yosys synthesis
pnpm --filter @simten/verifier dev     # iverilog cross-validation
```

The `@simten/web` app falls back to `localhost:55001` for Verilog export when there's no production binding, so running the compiler container locally is enough to test the flow end-to-end.

### Tier 3 — FPGA hardware flow (`hardware/ulx3s/`)

Add a ULX3S board, [openFPGALoader](https://github.com/trabucayre/openFPGALoader) (or fujprog), and the relevant USB driver. See `hardware/ulx3s/README.md`. This is genuinely niche — you only need this if you're working on the bitstream / on-chip CPU path.

## Project structure

```
apps/
  web/               ← main React app (editor, blog, learn, chat) — `@simten/web`
  sandbox/           ← isolated iframe that runs user circuit code
  compiler/          ← Cloudflare Container — RISC-V cross-compiler
  synth/             ← Cloudflare Container — Yosys synthesis
  verifier/          ← Cloudflare Container — iverilog cross-validation
packages/
  core/              ← circuit IR, simulator, stdlib, Verilog exporter
  ui/                ← React components (canvas, editor, waveform)
  embed/             ← embeddable React Flow viewer
  mcp/               ← MCP server for Claude Code integration
hardware/ulx3s/      ← FPGA bitstream build pipeline
docs/                ← markdown docs (also surfaced in /docs route)
```

## Workflow

We use trunk-based development with PRs:

1. Branch from `main`: `git checkout -b feat/your-thing`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (see below)
3. Push the branch: `git push -u origin feat/your-thing`
4. Open a PR against `main`
5. CI runs tests + workspace build automatically
6. After review, merge — the CI deploy workflow will ship to production

### Before opening a PR

```bash
pnpm test                          # core unit tests (~480 tests, ~2s)
pnpm -r exec tsc --noEmit          # type-check across the workspace
```

There's no Prettier/ESLint config — just TypeScript type-checking. Match the surrounding code's style (mostly 2-space indent, no semicolons in JSX, semicolons in TS files).

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

The subject should describe the *outcome*, not the change. "Fix bug" — bad. "Drop duplicate pnpm version" — good.

## Larger features

For anything bigger than a bug fix or small feature, **open an issue first**. We'll discuss the approach before you write code. This saves both of us from a PR that goes nowhere because the design wasn't aligned.

If you're not sure whether something is "big enough" to warrant an issue first, it probably isn't — just open the PR.

## Asking questions

[GitHub Issues](https://github.com/simtenhq/simten/issues) for anything: bug, feature request, design question, "is this thing intentional?". Tag with `question` if it's a question rather than work.

## Code of conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Bad behavior gets the contributor blocked, no warning needed.

## License

Apache 2.0 (see [LICENSE](./LICENSE)). By contributing, you agree your contributions are licensed under the same terms.

## Notes for maintainers

If you're reviewing a PR from an external fork:

- **Don't `pnpm install` blindly.** A malicious `package.json` can run `postinstall` scripts on your machine. Read the diff — particularly any new `scripts` or `dependencies` — before installing.
- **For unknown contributors**, prefer reviewing in [Codespaces](https://github.com/features/codespaces) or a devcontainer rather than your laptop. (Devcontainer config is on the roadmap; until it lands, a fresh shell with no sensitive paths mounted is the manual workaround.)
- **`pnpm install --ignore-scripts`** is a useful intermediate option when reading the diff for new lifecycle scripts isn't enough.

The threat model: fork PRs run their `package.json` on your shell. Your CF API token, your `~/.ssh`, your `~/.config/wrangler` are all in scope if `postinstall` does something hostile. CI secrets are GitHub-protected; your laptop isn't.

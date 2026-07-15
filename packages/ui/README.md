# @simten/ui

React components for the Simten circuit editor, canvas, and sandbox — the building blocks used to construct simten.dev's own editor UI.

This is the low-level UI kit. If you just want to embed a runnable circuit in a page, use **[`@simten/embed`](https://www.npmjs.com/package/@simten/embed)** instead — it wraps `@simten/ui`'s primitives in a turn-key component.

Use `@simten/ui` directly when you need to build a custom editor, a non-standard canvas layout, or your own variant of the sandbox harness.

## Install

```bash
npm install @simten/ui @simten/core react react-dom
```

## What's in it

| Subpath | Purpose |
|---|---|
| `@simten/ui/canvas` | `CircuitCanvas` — the React Flow-based visual canvas |
| `@simten/ui/nodes` | Node renderers for primitives (gates, registers, peripherals, …) |
| `@simten/ui/monaco` | `SimtenCodeEditor` — Monaco with IntelliSense for circuit source ([below](#the-code-editor)) |
| `@simten/ui/editor` | Simulator state capture/restore helpers |
| `@simten/ui/editor/stores` | Zustand stores backing the editor |
| `@simten/ui/editor/components` | `ClockControls`, `CircuitTabBar`, `CircuitSelector`, `SignalOutputPanel` |
| `@simten/ui/waveform` | `WaveformViewer` for VCD playback |
| `@simten/ui/sandbox` | Cross-origin sandbox primitives for running untrusted circuit code |
| `@simten/ui/share` | Encode/decode share links |

Each subpath has its own entry point with full TypeScript types — pick the smallest set you need.

Looking for `useCircuitSimulator`? It lives in **[`@simten/embed`](https://www.npmjs.com/package/@simten/embed)**, alongside `builtFromIR`.

## The code editor

`@simten/ui/monaco` gives you Monaco pre-wired for circuit source: typed completions and hovers for the Simten stdlib, plus automatic type acquisition so third-party imports (`react`, `zod`, …) resolve to real types.

```bash
pnpm add @simten/ui @monaco-editor/react
```

```tsx
import { SimtenCodeEditor } from '@simten/ui/monaco';

<SimtenCodeEditor value={source} onChange={setSource} />;
```

If you already own a Monaco instance — a collaborative editor with a Yjs binding, say — use the headless primitives instead and keep your own `<Editor>`:

```tsx
import { setupSimtenIntellisense, useTypeAcquisition } from '@simten/ui/monaco';

useTypeAcquisition(source, monaco);

<Editor path="file:///circuit.ts" beforeMount={setupSimtenIntellisense} onMount={bindYjs} />;
```

The model needs a real `file:///` URI: TypeScript resolves modules by walking up from the containing file looking for `node_modules`, and Monaco's default `inmemory://` scheme has nothing to walk. `SimtenCodeEditor` sets this for you. Get it wrong and every import silently resolves to `any`.

This subpath handles **types only**. Circuit source *executes* in the sandbox iframe, which resolves imports from esm.sh independently — so code can run fine while its types are still downloading. That's why module-not-found diagnostics are suppressed while semantic validation stays on.

Type acquisition fetches from jsDelivr at runtime. Pass `typeAcquisition={{ enabled: false }}` to opt out, or `{ typescriptCdn }` to self-host; failures degrade to "no completions", never a broken editor.

## Peer dependencies

- React 18 or 19
- `@simten/core`
- `@monaco-editor/react` — **optional**, required only by `@simten/ui/monaco`

Monaco is an *optional* peer, so it is never installed unless you ask for it: every other subpath stays Monaco-free on disk and in your bundle. That also means it isn't auto-installed, hence naming it explicitly in the install command above. You won't import `@monaco-editor/react` yourself — `SimtenCodeEditor` does — and `monaco-editor` follows automatically as a peer of it.

Monaco itself is not bundled by anyone here: `@monaco-editor/react` loads it from a CDN at runtime, and the `monaco-editor` package is present for its types.

## Docs

Component API and integration examples at <https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0

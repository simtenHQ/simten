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
| `@simten/ui/editor` | `EditorWorkspace` and code-editor surface |
| `@simten/ui/editor/stores` | Zustand stores backing the editor |
| `@simten/ui/editor/hooks` | Hooks: `useCircuitSimulator`, history, compile pipeline |
| `@simten/ui/waveform` | `WaveformViewer` for VCD playback |
| `@simten/ui/sandbox` | Cross-origin sandbox primitives for running untrusted circuit code |
| `@simten/ui/share` | Encode/decode share links |

Each subpath has its own entry point with full TypeScript types — pick the smallest set you need.

## Peer dependencies

- React 18 or 19
- `@simten/core`

## Docs

Component API and integration examples at <https://simten.dev/docs>. Source: <https://github.com/simtenHQ/simten>.

## License

Apache-2.0

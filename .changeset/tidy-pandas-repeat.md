---
"@simten/ui": minor
---

Add `@simten/ui/monaco` — Monaco editor IntelliSense for circuit source.

Gives typed completions and hovers for the Simten stdlib, plus automatic type acquisition so third-party imports (`react`, `zod`, …) resolve to real types rather than `any`.

```bash
pnpm add @simten/ui @monaco-editor/react
```

```tsx
import { SimtenCodeEditor } from '@simten/ui/monaco';

<SimtenCodeEditor value={source} onChange={setSource} />;
```

Two layers are exported:

- `SimtenCodeEditor` — Monaco, pre-wired. The default choice.
- `setupSimtenIntellisense` / `useTypeAcquisition` — headless primitives for consumers that own their own Monaco instance, such as a collaborative editor with a Yjs binding where the source of truth is a `Y.Text` rather than a `value` prop.

The `@simten/core` type payloads are inlined at build time, so they need no network and work under any bundler. Third-party types are fetched from jsDelivr at runtime by `@typescript/ata`; failures degrade to "no completions", never a broken editor. Pass `typeAcquisition={{ enabled: false }}` to opt out, or `{ typescriptCdn }` to self-host.

`@monaco-editor/react` and `monaco-editor` are **optional** peer dependencies: only this subpath needs them, so every other `@simten/ui` subpath stays Monaco-free both on disk and in the bundle. Being optional, they are not auto-installed — hence naming `@monaco-editor/react` explicitly in the install command above (`monaco-editor` follows as a peer of it). Existing consumers are unaffected.

Also corrects the README, which documented `@simten/ui/editor` as exporting an `EditorWorkspace` (it exports simulator state capture/restore helpers) and `@simten/ui/editor/hooks` as providing `useCircuitSimulator` (that entry point is empty; the hook lives in `@simten/embed`).

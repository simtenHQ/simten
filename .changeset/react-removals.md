---
'@simten/react': minor
---

Removed in the move from `@simten/ui` and `@simten/embed` to `@simten/react` (#418), so there is one migration:

- **The `<circuit-embed>` web component** (`@simten/embed/webcomponent`, `dist/circuit-embed.js`). To show a circuit on a page that isn't React, open it on simten.dev and use Share > Embed: an iframe that works where `<script>` is stripped, is isolated from the page, and ships nothing into it.
- **`@simten/embed/nodes` and `@simten/embed/canvas`**, which only re-exported `@simten/ui`. The node components are how `CircuitCanvas` draws and aren't exported.
- **The Zustand editor stores**, `@simten/ui/editor/stores`: `useCircuitStore`, `useCircuitPreviewStore`, `useCircuitDefinitionsStore` and their types. The editor stopped reading them when it moved to `useSimulation` (#520).
- **`@simten/ui/editor`**, which only re-exported `captureEnvironmentalState` and `restoreEnvironmentalState` from `@simten/core/internal`.
- **`@simten/ui/editor/components`**: `ClockControls` is in `@simten/react`; `ReactFlowProvider` comes from `@xyflow/react` (`CircuitCanvas` has its own); `CircuitSelector`, `CircuitTabBar` and `SignalOutputPanel` read the removed stores and had no other users.
- **`@simten/ui/editor/types`**. The IR types (`CircuitIR` and the rest) come from `@simten/core/internal`; the editor-only types there had no users.
- **`@simten/ui/editor/hooks`**, which exported nothing.

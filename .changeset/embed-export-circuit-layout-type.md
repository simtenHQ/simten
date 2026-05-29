---
"@simten/embed": patch
---

fix: re-export `CircuitLayout` type from package entry

The README documents `import { type CircuitLayout } from '@simten/embed'` and the `CircuitEmbed` component's `layout` prop is typed `CircuitLayout<C>`, but the entry was only re-exporting `CircuitCanvasProps` from `@simten/ui/canvas` — leaving `CircuitLayout` reachable only via the deeper `@simten/ui/canvas` path. Consumers following the README got `TS2305: Module '"@simten/embed"' has no exported member 'CircuitLayout'`. Re-exported now so the documented import works.

---
'@simten/ui': minor
---

Export `@simten/ui/primitives/sheet`, and let it render without the dimming backdrop.

`SheetContent` always rendered `SheetOverlay`, which is `fixed inset-0 bg-black/50` — so it swallowed every click on the page regardless of whether the sheet was modal. That made `<Sheet modal={false}>` useless in practice: Radix stops trapping focus, but the backdrop still blocks the page underneath.

`showOverlay={false}` turns it off, which is what a non-modal sheet actually needs. Defaults to `true`, so existing usage is unchanged.

The primitive is also now exported as a subpath, alongside `tooltip` and `resizable`. `apps/web` had been carrying a byte-identical copy of it.

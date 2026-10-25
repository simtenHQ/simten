---
'@simten/ui': patch
'@simten/embed': patch
---

Pin labels are now on by default on every canvas, not only when `showPortLabels` is passed. Blocks grow to fit their pins and label names instead of squeezing them together, the layout spaces them by the same sizes, and labels hide when the canvas is zoomed out too far to read them.

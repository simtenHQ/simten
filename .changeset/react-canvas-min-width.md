---
'@simten/react': patch
---

`CircuitCanvas` fills its container's width and is never narrower than 280px. Before, in a container that sizes to its content, such as `#root` in Vite's starter app, the canvas was 0px wide and drew nothing.

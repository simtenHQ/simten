---
'@simten/react': patch
---

The canvas reads the simulation's values in the simulation's own terms, and redraws only what changed.

- A value update re-renders only the nodes and wires whose value changed. Before, every node and wire was rebuilt on every update.
- Double-clicking the box of a circuit with ports opens the circuit itself. Inside it, a Screen shows its pixels, consoles and UARTs show their text, and loading a program onto a memory calls `onLoadMemory` with the memory's path (`imem`), as it does on a circuit without ports.
- A circuit that compiles but fails to open (an `eval` that throws as it first settles, say) is reported in `state.compileError`, so the editor marks it and the canvas keeps the last good drawing. It used to be `state.error`, which replaced the drawing.
- `WaveformViewer` drops the cycles stepped back over when the clock ticks again from the past.
- The boundary ports inside the drill-down have no pin labels, like the switches and lamps the canvas draws for a circuit's ports.

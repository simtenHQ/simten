---
'@simten/ui': minor
---

Remove leftover drag-and-drop editor state: `useUIStore`, the UI state types (`UIState`, `DragOperation`, `SelectionState`, `SimulationStatus`, `SimulationState`, `CanvasState`) and the per-node and per-connection actions on `useCircuitStore`. The circuit store now has `circuit`, `setCircuit` and `clearCircuit`.

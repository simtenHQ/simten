---
'@simten/core': patch
---

Verilog export now reports primitives it has no mapping for.

`emitPrimitive`'s default case emits `// WARNING: Unsupported primitive` in
place of logic and lets the export succeed, so the result parses, synthesizes,
and does not do what the circuit does. It was found with a yosys miter/sat
equivalence check: round-tripping `RV32I_ALU` through import and back produced a
module whose `result` matched but whose `zero` did not, and nothing in the file
looked wrong to a reader.

`ExportResult` gains an optional `unsupported` map of primitive type to node
ids, populated during the real emit rather than by probing, and left absent on a
clean export so existing consumers are unaffected. Imported designs hit this
routinely — `Slice`, `ZeroExtend`, `SignExtend` and `Pmux_*` are all products of
yosys elaboration with no exporter mapping.

# @simten/core

## 0.2.0

### Minor Changes

- fix(elaboration): chained-composite feedthrough wires now propagate via transitive closure (#138)

  Previously, composite circuits that chained feedthrough wires through multiple nested composites could silently produce wrong netlists — signals that should have reached downstream nodes were dropped at elaboration time. The fix computes the full transitive closure of feedthrough connections so multi-level chains stitch correctly.

### Patch Changes

- test: structural invariants helper for FlatCircuit + 17 targeted elaboration patterns (#140)

  Adds an internal invariants checker used by the test suite to catch malformed flat netlists earlier, plus 17 targeted elaboration test patterns covering edge cases surfaced during the audit. No public API change; ships as a patch so consumers picking up `@simten/core@0.2.0` get the additional safety net.

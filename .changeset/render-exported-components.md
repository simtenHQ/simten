---
'@simten/core': minor
'@simten/embed': patch
---

Look at a component without wrapping it in a circuit.

`export default FullAdder` used to report "No circuits found in source" at
someone who could see a component in front of them. The collector only watches
`circuit()` calls, and a re-export builds nothing, so the source read as empty.

`ExecuteResult` gains `exportedCircuits` for components the code exported
without defining. `circuits` still means "constructed here" and is what the MCP
tools report, so nothing starts claiming a stdlib gate was written locally; a
renderer falls back to the export only when the source defined nothing.
Parameterised components are exported as factories, so a bare function is
called with no arguments for its default instance, matching what
`nodes: { r: Register }` gives you.

The message for a genuinely empty source now says what to do: "Nothing to show.
Define a circuit with circuit('Name', { ... }), or export a component to look
at." Previously three call sites had three different wordings.

Also fixes the harness for eval-only primitives. It skips ports nothing inside
the circuit wires up, which is right for a composite and wrong for an `Or`,
whose ports are used by its `eval` rather than by connections — so a rendered
primitive had no switches to click.

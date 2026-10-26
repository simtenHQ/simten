---
'@simten/core': minor
---

Memory contents have one format, a plain object `{ address: value }`, and contents that don't fit the memory are compile errors (#474). The new `MemoryContents` type names it.

| Old | New |
|---|---|
| `mem(depth, width, new Map([[0, 7]]))` | `mem(depth, width, { 0: 7 })` |
| `ROM({ memory: [7, 9] })` (and `RAM`, `DualPortRAM`, `DualPortROM`) | `ROM({ memory: romFromBytes([7, 9]) })`, or `romFromWords(words, width)` for wider words |
| `sim.setNode('rom', new Map([[0, 7]]))` | `sim.setNode('rom', { 0: 7 })`. `setNode` is typed `number \| MemoryContents` instead of `any` |
| `RegState` | `RegDecl` |
| `MemState` | `MemDecl` |
| `ConnectArg` | `ConnectContext` |
| `MemoryValue.data` in the IR (`/internal`) is a `Map` | a `MemoryContents` object, so the IR stays plain JSON |
| `ArgumentValue` (`/internal`) includes `number[]` | it doesn't; memory arguments are `MemoryContents` |

New compile errors, each naming the circuit, the state field and the address:

- a value that doesn't fit the memory's width (`{ 0: 300 }` at 8 bits used to be masked to 44), or one that isn't an integer
- an address at or past the memory's depth (it used to be ignored), or one that isn't a non-negative integer
- an array or a `Map` where contents are expected, with a pointer at `romFromBytes`/`romFromWords` (an array used to crash with a raw `TypeError` in `mem()` and was silently dropped by the Verilog exporter)

# 0001. How component behaviour is represented

**Status:** Accepted. Tracked in #435.

## Context

A primitive's behaviour (`eval`, `onTick`) is a JS function. Today it reaches the places that need it in three ways:

- the sandbox worker turns it into text with `fn.toString()` and rebuilds it with `new Function`, which drops anything the closure captured (factory options like `width`)
- eval-synth reads the same text to generate Verilog
- every behaviour lives in one global registry keyed by circuit name, so two circuits with the same name overwrite each other, and importing a module registers its components as a side effect

## Decision

There are three forms of a circuit, each with one job:

- **Source is canonical.** It's what gets shared, saved as a draft, edited and forked.
- **The IR stays non-executable JSON** describing structure. The page, the canvas and share links only ever hold this. Behaviour is never added to it.
- **Behaviour is code, and stays where code is allowed to run:** the sandbox worker, or the user's machine for MCP. The page never runs user code.

With the simulator in the worker (#51), closures are used where they were created, so the `toString`/`new Function` hop and the lost-closure bugs go away for source compiles. The global registry is replaced by a behaviour table owned by each compile, so circuits can't collide and nothing registers on import. eval-synth still reads function source to generate Verilog; that's inherent to writing behaviour in JS, and it must fail loudly on anything it can't translate (#429).

## Rejected

- **Behaviour inside the IR** (as source strings or bytecode). It would put executable content into the object the page holds, stores and shares, and one careless `new Function` would break the sandbox boundary.
- **A behaviour DSL** instead of JS. Safer to serialise and synthesise, but a new language for users to learn, and JS behaviour is part of what makes the library approachable.

## What would change it

Running behaviour outside a JS engine (for example compiling the simulator to WASM) would need a serialisable form, and a restricted expression language would be back on the table.

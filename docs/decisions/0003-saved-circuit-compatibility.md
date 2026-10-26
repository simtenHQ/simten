# 0003. Compatibility policy for saved circuits

**Status:** Accepted. Tracked in #437.

## Context

Share links and game drafts store source code, not IR. Renaming anything that source refers to breaks every old link and draft that uses it.

## Decision

- **Frozen:** `circuit`, `bit`, `bus`, every std component name and its port names, and the `@simten/core/circuit` and `@simten/core/std` import paths. These don't change.
- **Everything else can change before 1.0**, including internal names, the IR shape, package layout and the sandbox protocol. There's no compatibility shim for old open tabs; a refresh fixes them.
- **If the frozen surface ever has to change,** shares and drafts get a format version and are migrated when loaded.
- A test compiles every game level stub, every reference solution and a sample of stored share sources, so a breaking rename fails CI rather than players' links.

## Rejected

- **Storing IR instead of source.** Old IR would need migrating on every IR change, and source is what people want back when they open a link.
- **Supporting old sandbox protocol versions.** Costs code forever to cover a few tabs left open across a deploy.

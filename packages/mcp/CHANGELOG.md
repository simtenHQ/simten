# @simten/mcp

## 0.1.1

### Patch Changes

- fix(show_circuit): drop server-side execution pre-flight, always await render-ack including fresh-open connect (#139)

  `show_circuit` previously ran a server-side execution pre-flight that rejected circuits using npm imports (because the MCP process can't resolve `esm.sh`). Removed the pre-flight; the tool now always awaits the browser's render acknowledgement, which is the real source of truth for whether a circuit rendered. Fresh-open connections (no tab yet → browser launches → first render) now go through the same await path as warm reconnects.

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0

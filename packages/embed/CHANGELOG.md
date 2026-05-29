# @simten/embed

## 0.1.3

### Patch Changes

- c7c5e67: fix: re-export `CircuitLayout` type from package entry

  The README documents `import { type CircuitLayout } from '@simten/embed'` and the `CircuitEmbed` component's `layout` prop is typed `CircuitLayout<C>`, but the entry was only re-exporting `CircuitCanvasProps` from `@simten/ui/canvas` — leaving `CircuitLayout` reachable only via the deeper `@simten/ui/canvas` path. Consumers following the README got `TS2305: Module '"@simten/embed"' has no exported member 'CircuitLayout'`. Re-exported now so the documented import works.

- cc6b76e: docs(readme): include `react react-dom` in the install command

  The install line previously read `npm install @simten/embed @simten/core`, which works under npm 7+ (auto-installs declared peers) but breaks under pnpm with strict-peer-dependencies (the default) and under yarn. React and react-dom are declared peer dependencies; the install line now lists them explicitly, matching `@simten/ui`'s README.

- c7c5e67: docs(readme): add `@types/react @types/react-dom` to the install line for TypeScript consumers

  The install line was correct at runtime but omitted the TS-side dev deps. A TypeScript consumer (the target audience) following the readme verbatim got implicit-any errors on every React-typed prop until they figured out to install the types. Added them explicitly as a dev-deps line right after the main install.

- Updated dependencies [c7c5e67]
  - @simten/core@0.2.2
  - @simten/ui@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [2649b7c]
  - @simten/core@0.2.1
  - @simten/ui@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @simten/core@0.2.0
  - @simten/ui@0.1.1

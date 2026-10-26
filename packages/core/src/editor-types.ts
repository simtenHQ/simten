/**
 * Input for `dist/bundle.d.ts`, the flattened types the Monaco editor loads as
 * `@simten/core`. Editor source sees the builder and the whole standard
 * library, so the bundle carries both. Not a package entry point.
 */

export * from './index.js';
export * from './std/index.js';

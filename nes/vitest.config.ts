import { defineConfig } from 'vitest/config';

// The board runs ~2 s per frame and CI runners are slower again, so tests
// that run frames take well over vitest's 5 s default.
export default defineConfig({
  test: { testTimeout: 60_000 },
});

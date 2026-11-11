import { defineConfig } from 'vitest/config';

// The board, APU included, runs a frame in ~30 s here, and CI runners are a
// few times slower, so tests that run frames take far over vitest's default.
export default defineConfig({
  test: { testTimeout: 300_000 },
});

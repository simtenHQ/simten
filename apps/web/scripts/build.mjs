/**
 * vite build wrapper that kills the process after prerender finishes.
 *
 * The `tanstackStart({ prerender, sitemap })` step starts a Vite preview
 * server (via @cloudflare/vite-plugin → wrangler/miniflare) to crawl pages
 * during build. Once prerender writes `pages.json`, the build content is
 * complete on disk — but the preview server doesn't tear down cleanly,
 * leaving the Node event loop occupied. The process hangs indefinitely.
 *
 * This wrapper watches stdout for the "writing pages data" log line and
 * issues SIGTERM (then SIGKILL) once it lands. CI builds need this to
 * actually terminate; local builds previously needed a manual Ctrl-C.
 */

import { spawn } from 'node:child_process';

const SITEMAP_DONE_MARKER = '[sitemap] Writing pages data';
const SIGTERM_GRACE_MS = 1500;
const SIGKILL_GRACE_MS = 4000;

const args = ['build', ...process.argv.slice(2)];
const child = spawn('vite', args, {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: process.env,
});

let prerenderDone = false;
let exitTimer;

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!prerenderDone && chunk.toString().includes(SITEMAP_DONE_MARKER)) {
    prerenderDone = true;
    exitTimer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), SIGKILL_GRACE_MS);
    }, SIGTERM_GRACE_MS);
  }
});

child.on('exit', (code, signal) => {
  if (exitTimer) clearTimeout(exitTimer);
  // SIGTERM after a successful prerender is our intended exit — treat as success.
  if (prerenderDone && (signal === 'SIGTERM' || signal === 'SIGKILL')) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});

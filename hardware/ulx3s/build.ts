#!/usr/bin/env tsx
/**
 * CLI shim over the generic pipeline for the Snake/HDMI project.
 *
 *   tsx hardware/ulx3s/build.ts           — build only, writes snake.bit
 *   tsx hardware/ulx3s/build.ts --flash   — build + flash via openFPGALoader
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from './lib/pipeline.js';
import { project as snakeProject } from './projects/snake/index.js';

async function main() {
  const argv = process.argv.slice(2);
  const flash = argv.includes('--flash');
  const fullRebuild = argv.includes('--full-rebuild');

  console.log('Building Snake/HDMI bitstream');

  const result = await runPipeline({
    project: snakeProject,
    flash,
    fullRebuild,
    verbose: true,
  });

  if (!result.ok) {
    console.error(`\nFAILED at stage ${result.error?.stage}: ${result.error?.message}`);
    if (result.error?.suggestion) console.error(`  suggestion: ${result.error.suggestion}`);
    if (result.error?.stderr_tail) {
      console.error('  stderr_tail:');
      console.error('    ' + result.error.stderr_tail.split('\n').slice(-20).join('\n    '));
    }
    process.exit(1);
  }

  if (result.synth) {
    console.log(`\nSynth: ${result.synth.cached ? 'CACHED (ecpbram fast path)' : 'full rebuild'}`);
    console.log(`  Bitstream: ${result.synth.bitstream_kb} KB`);
    if (result.synth.timing_achieved_mhz) {
      console.log(
        `  Timing: ${result.synth.timing_achieved_mhz} MHz (target ${result.synth.timing_target_mhz})`,
      );
    }
    if (result.synth.utilization) {
      const u = result.synth.utilization;
      console.log(
        `  Utilization: LUT=${u.lut} FF=${u.ff} BRAM=${u.bram}${u.io !== undefined ? ` IO=${u.io}` : ''}`,
      );
    }
  }

  console.log(`\nBitstream written to ${resolve(snakeProject.projectDir, snakeProject.bitFile)}`);

  if (result.flash) {
    console.log(`Flashed in ${result.flash.flash_duration_ms} ms.`);
  }

  for (const w of result.warnings) console.log('WARNING: ' + w);
}

const isMainModule =
  (import.meta as { main?: boolean }).main ??
  (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

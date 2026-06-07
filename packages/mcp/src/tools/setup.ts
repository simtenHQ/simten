/**
 * setup_project — make a folder ready for `verify_circuit`.
 *
 * `check_circuit` and `simulate_circuit` run in-process against the bundled
 * `@simten/core` and need no setup. `verify_circuit` shells out to `tsx` and
 * resolves the testbench's imports from the project, so an empty folder needs:
 * an ESM `package.json`, plus `@simten/core` + `fast-check` + `tsx` installed.
 *
 * This tool does that once, proactively — the alternative is the user
 * discovering each requirement through a failed-verify error chain.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  detectPackageManager,
  ensurePackageJson,
  ensureTsconfig,
  runInstall,
  isProjectReady,
  installCommand,
  RUNTIME_DEPS,
  DEV_DEPS,
  type PackageManager,
} from '../lib/project-setup.js';

const DESCRIPTION = `Make the current folder ready to RUN verify_circuit. check_circuit and simulate_circuit need no setup; verify_circuit does, because it runs the testbench on the host via tsx and resolves @simten/core + fast-check from this project.

Call this once before a project's first verify_circuit (or whenever it reports "setup_required") — it is NOT needed just to check, simulate, or show circuits, including the get_started examples. It is idempotent — safe to re-run. It writes an ESM package.json (never clobbering an explicit CommonJS one), a minimal tsconfig for editor IntelliSense, a circuits/ dir, and installs @simten/core, fast-check, and tsx with your package manager.

The result reports the extension to use for circuit/testbench files: ".ts" normally, ".mts" only if you already have a type:commonjs package.json.`;

export function registerSetupTool(server: McpServer): void {
  server.tool(
    'setup_project',
    DESCRIPTION,
    {
      dir: z.string().optional().describe('Project root to set up (default: the MCP working directory)'),
      packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun']).optional()
        .describe('Override the package manager (default: detect from lockfile, else npm)'),
    },
    async ({ dir, packageManager }) => {
      const root = dir ? resolve(dir) : process.cwd();
      const pm: PackageManager = packageManager ?? detectPackageManager(root);

      const steps: string[] = [];

      // 1. package.json (decides the file extension; never clobbers commonjs).
      const pkgPlan = ensurePackageJson(root);
      steps.push(`package.json: ${pkgPlan.action}${pkgPlan.note ? ` — ${pkgPlan.note}` : ''}`);

      // 2. tsconfig for editor IntelliSense.
      steps.push(`tsconfig.json: ${ensureTsconfig(root) ? 'created' : 'unchanged'}`);

      // 3. circuits/ dir.
      const circuitsDir = resolve(root, 'circuits');
      if (!existsSync(circuitsDir)) {
        mkdirSync(circuitsDir, { recursive: true });
        steps.push('circuits/: created');
      } else {
        steps.push('circuits/: unchanged');
      }

      // 4. Install — skip if already resolvable.
      let installNote: string;
      if (isProjectReady(root)) {
        installNote = 'dependencies already installed; skipped';
      } else {
        const prod = await runInstall(root, pm, RUNTIME_DEPS, { dev: false });
        const dev = prod.ok ? await runInstall(root, pm, DEV_DEPS, { dev: true }) : null;
        if (prod.ok && dev?.ok && isProjectReady(root)) {
          installNote = `installed ${[...RUNTIME_DEPS, ...DEV_DEPS].join(', ')} with ${pm}`;
        } else {
          // Offline / install failure: report the manual command as fallback.
          const failed = !prod.ok ? prod : dev;
          return errorResult(
            `Project files are set up, but the install failed (${pm}). Run this manually in ${root}, then retry verify_circuit:\n  ${installCommand(pm)}`,
            { steps, stderr_tail: (failed?.stderr ?? '').slice(-1500) },
          );
        }
      }
      steps.push(`install: ${installNote}`);

      const ready = isProjectReady(root);
      const summary = {
        ready,
        root,
        packageManager: pm,
        circuitExtension: pkgPlan.ext,
        steps,
        next: ready
          ? `Ready. Write circuits as circuits/<name>.circuit${pkgPlan.ext} and testbenches as circuits/<name>.verify${pkgPlan.ext}, then verify_circuit.`
          : 'Not ready — see steps; install may have partially failed.',
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        isError: !ready,
      };
    },
  );
}

function errorResult(error: string, extra?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error, ...extra }, null, 2) }],
    isError: true,
  };
}

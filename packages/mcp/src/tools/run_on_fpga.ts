/**
 * run_on_fpga MCP tool — drives the full flash + UART capture loop on a
 * connected ULX3S FPGA.
 *
 * Shells out to hardware/ulx3s/run_on_fpga.ts (tsx) and parses the JSON block
 * from stdout. This keeps the CLI as the single source of truth while giving
 * Claude a structured return value.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const BEGIN = '--- BEGIN JSON ---';
const END = '--- END JSON ---';

interface RunResult {
  success: boolean;
  stage: string;
  duration_ms: number;
  [key: string]: unknown;
}

function findRepoRoot(): string {
  // Prefer explicit env var; else walk up from cwd looking for hardware/ulx3s.
  const envRoot = process.env.SIMTEN_REPO_ROOT;
  if (envRoot && existsSync(resolve(envRoot, 'hardware/ulx3s/run_on_fpga.ts'))) {
    return envRoot;
  }
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'hardware/ulx3s/run_on_fpga.ts'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to cwd; error will surface from the spawn failing.
  return process.cwd();
}

function extractJson(stdout: string): { result?: RunResult; parseError?: string } {
  const start = stdout.lastIndexOf(BEGIN);
  const end = stdout.lastIndexOf(END);
  if (start < 0 || end < 0 || end < start) {
    return { parseError: 'no JSON block found in CLI stdout' };
  }
  const raw = stdout.slice(start + BEGIN.length, end).trim();
  try {
    return { result: JSON.parse(raw) as RunResult };
  } catch (e) {
    return { parseError: `JSON parse error: ${(e as Error).message}` };
  }
}

interface RunArgs {
  project: string;
  firmware?: string;
  timeout_ms?: number;
  match?: string;
  no_flash?: boolean;
  full_rebuild?: boolean;
}

async function invokeCli(
  args: RunArgs,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const root = findRepoRoot();
  const cliArgs = ['hardware/ulx3s/run_on_fpga.ts', `--project=${args.project}`];
  if (args.firmware) cliArgs.push(`--firmware=${args.firmware}`);
  if (args.timeout_ms !== undefined) cliArgs.push(`--timeout=${args.timeout_ms}`);
  if (args.match) cliArgs.push(`--match=${args.match}`);
  if (args.no_flash) cliArgs.push('--no-flash');
  if (args.full_rebuild) cliArgs.push('--full-rebuild');

  return new Promise((res) => {
    const proc = spawn('tsx', cliArgs, {
      cwd: root,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => (stdout += c.toString('utf8')));
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf8')));
    proc.on('close', (code) => res({ stdout, stderr, exitCode: code ?? -1 }));
    proc.on('error', (e) => res({ stdout, stderr: stderr + '\n' + e.message, exitCode: -1 }));
  });
}

export function registerRunOnFpgaTool(server: McpServer): void {
  server.tool(
    'run_on_fpga',
    'Build, flash, and UART-capture a project on a connected ULX3S FPGA. Known projects at the time of writing: cpu (RV32I CPU, requires firmware), snake (HDMI hardware Snake), uart_test (standalone UART). New projects can be added by dropping a descriptor in hardware/ulx3s/projects/ and registering it in projects/index.ts — they become callable here without editing this tool. The CLI will reject unknown names with a clear error listing what is registered. Returns a structured RunResult covering every stage (compile, synth, flash, run, match). Kills any active picocom before flashing.',
    {
      project: z
        .string()
        .min(1)
        .describe(
          'Project name as registered in hardware/ulx3s/projects/index.ts (e.g. "cpu", "snake", "uart_test", or any newer one).',
        ),
      firmware: z
        .string()
        .optional()
        .describe('Path to firmware source (.c or .rs) — required for cpu; relative to repo root.'),
      timeout_ms: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('UART capture timeout in ms (default: 5000).'),
      match: z
        .string()
        .optional()
        .describe('Regex matched against UART output; capture early-exits on hit.'),
      no_flash: z
        .boolean()
        .optional()
        .describe('Build only, skip flashing (rarely useful from MCP).'),
      full_rebuild: z
        .boolean()
        .optional()
        .describe('Skip bitstream cache, force full synth + PnR.'),
    },
    async (args) => {
      const { stdout, stderr, exitCode } = await invokeCli(args);
      const { result, parseError } = extractJson(stdout);
      if (parseError || !result) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: `run_on_fpga CLI did not produce a JSON block: ${parseError ?? 'unknown'}`,
                  exit_code: exitCode,
                  stderr_tail: stderr.slice(-2000),
                  stdout_tail: stdout.slice(-1000),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    },
  );
}

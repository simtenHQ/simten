/**
 * run_on_fpga MCP tool — drives the full flash + UART capture loop on a
 * connected ULX3S FPGA.
 *
 * Shells out to hardware/ulx3s/run_on_fpga.ts (tsx) and parses the JSON block
 * from stdout. This keeps the CLI as the single source of truth while giving
 * Claude a structured return value.
 *
 * Registered only inside the Simten repo (see lib/repo-root.ts).
 */

import { spawn } from 'node:child_process';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const BEGIN = '--- BEGIN JSON ---';
const END = '--- END JSON ---';

interface RunResult {
  success: boolean;
  stage: string;
  duration_ms: number;
  [key: string]: unknown;
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

const inputSchema = z.strictObject({
  project: z
    .string()
    .min(1)
    .describe(
      'Project name as registered in hardware/ulx3s/projects/index.ts (e.g. "cpu", "snake", "uart_test", or any newer one).',
    ),
  firmware: z
    .string()
    .optional()
    .describe('Path to firmware source (.c or .rs), required for cpu; relative to the repo root.'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('UART capture timeout in ms (default: 5000).'),
  match: z
    .string()
    .optional()
    .describe('Regex matched against UART output; capture exits early on a hit.'),
  noFlash: z.boolean().optional().describe('Build only, skip flashing.'),
  wifiHost: z
    .string()
    .optional()
    .describe(
      "Flash over Wi-Fi via the board's ESP32 at this host/IP (needs esp32ecp5 uftpd on the ESP32) instead of USB-JTAG. UART capture still uses USB.",
    ),
  fullRebuild: z.boolean().optional().describe('Skip the bitstream cache, force full synth + PnR.'),
});

type RunArgs = z.infer<typeof inputSchema>;

/** The CLI's arguments for a tool call. */
function cliArgs(args: RunArgs): string[] {
  const out = ['hardware/ulx3s/run_on_fpga.ts', `--project=${args.project}`];
  if (args.firmware) out.push(`--firmware=${args.firmware}`);
  if (args.timeoutMs !== undefined) out.push(`--timeout=${args.timeoutMs}`);
  if (args.match) out.push(`--match=${args.match}`);
  if (args.noFlash) out.push('--no-flash');
  if (args.wifiHost) out.push(`--wifi=${args.wifiHost}`);
  if (args.fullRebuild) out.push('--full-rebuild');
  return out;
}

function invokeCli(
  root: string,
  args: RunArgs,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((res) => {
    const proc = spawn('tsx', cliArgs(args), { cwd: root, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
    });
    proc.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf8');
    });
    proc.on('close', (code) => res({ stdout, stderr, exitCode: code ?? -1 }));
    proc.on('error', (e) => res({ stdout, stderr: `${stderr}\n${e.message}`, exitCode: -1 }));
  });
}

/** Register run_on_fpga, running the CLI from the Simten repo at `root`. */
export function registerRunOnFpgaTool(server: McpServer, root: string): void {
  server.registerTool(
    'run_on_fpga',
    {
      description:
        'Build, flash, and UART-capture a project on a connected ULX3S FPGA. Known projects at the time of writing: cpu (RV32I CPU, requires firmware), snake (HDMI hardware Snake), uart_test (standalone UART). New projects can be added by dropping a descriptor in hardware/ulx3s/projects/ and registering it in projects/index.ts; they become callable here without editing this tool. The CLI rejects unknown names with an error listing what is registered. Returns a structured RunResult covering every stage (compile, synth, flash, run, match). Kills any active picocom before flashing.',
      inputSchema,
    },
    async (args) => {
      const { stdout, stderr, exitCode } = await invokeCli(root, args);
      const { result, parseError } = extractJson(stdout);
      if (parseError || !result) {
        const payload = {
          success: false,
          error: `run_on_fpga CLI did not produce a JSON block: ${parseError ?? 'unknown'}`,
          exit_code: exitCode,
          stderr_tail: stderr.slice(-2000),
          stdout_tail: stdout.slice(-1000),
        };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
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

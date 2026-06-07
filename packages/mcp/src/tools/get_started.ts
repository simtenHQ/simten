/**
 * get_started — the front door for a fresh session.
 *
 * A new user who installs the MCP is met with nothing: every other tool wants
 * a circuit file that doesn't exist yet. This tool fills that gap — a short
 * orientation plus the bundled example catalog (canonical in
 * `@simten/core/examples/catalog`, shared with the web editor), and a way to
 * drop any example into `circuits/` ready for `show_circuit`. Everything here
 * runs in-process: no `setup_project`, no npm install.
 *
 * Intent-gated, not mandatory: the server instructions route "what is this /
 * show me a demo" here and tell the agent to skip it when the user asked for
 * a specific circuit of their own.
 *
 * The catalog stores examples in editor style (import-free, globals injected).
 * Files the MCP writes must follow the server's own contract — imports from
 * `@simten/core` and exported top-level circuits so a testbench can import
 * them — so `materializeExample` adds the import header (derived from which
 * stdlib names the source actually uses) and exports each `circuit()` const.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXAMPLES, type Example } from '@simten/core/examples/catalog';
import * as std from '@simten/core/std';

const DESCRIPTION = `Start here when the user is new to simten, asks what it is, or wants a demo. With no arguments: a short orientation plus the menu of bundled example circuits (Snake, a RISC-V computer, a systolic array, an ALU, ...). With example:"<id>": writes that example to circuits/<id>.circuit.ts, ready for show_circuit — works in an empty folder, no setup or install needed. If the user asked for a specific circuit of their own, skip this tool and build it.`;

// Names injected by the editor/check scope that a written file must import
// from @simten/core/circuit instead. `circuit` is always used; the rest are
// included when the source references them.
const BUILDER_NAMES = ['circuit', 'bit', 'bus', 'reg', 'mem'];

// Runtime export names of @simten/core/std (types are erased; STDLIB_CIRCUITS
// and friends only match if the source actually mentions them, which examples
// don't). Computed once.
const STD_NAMES = Object.keys(std).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));

/** Strip comments so prose like "The RAM holds..." doesn't pull in imports. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Turn editor-style example source (import-free, nothing exported) into a
 * standalone module per the server contract: import header + exported
 * top-level circuits. Word-boundary matching on comment-stripped source can
 * never under-import; a stray match in a string literal could at worst add an
 * unused import, which is harmless.
 */
export function materializeExample(example: Example): string {
  const scannable = stripComments(example.code);
  const used = (name: string) => new RegExp(`\\b${name}\\b`).test(scannable);

  const builders = BUILDER_NAMES.filter(used);
  const parts = STD_NAMES.filter(used).sort();

  const header = [
    `// ${example.title} — bundled simten example ("${example.id}").`,
    `import { ${builders.join(', ')} } from '@simten/core/circuit';`,
    ...(parts.length ? [`import {\n  ${parts.join(', ')},\n} from '@simten/core/std';`] : []),
  ].join('\n');

  const body = example.code.replace(/^const (\w+) = circuit\(/gm, 'export const $1 = circuit(');
  return `${header}\n${body.startsWith('\n') ? body : `\n${body}`}`;
}

/** The no-argument response: orientation + example menu. */
export function buildOrientation(): string {
  const menu = EXAMPLES.map(
    (e) => `- ${e.id} (${e.category}) — ${e.title}: ${e.description}`,
  ).join('\n');

  return `SIMTEN IN 30 SECONDS
Simten is hardware design in TypeScript. You write circuits as code — gates, registers, memories, up to a full RISC-V CPU — then simulate them instantly, paint them on a live browser canvas, prove them correct against a declared oracle, and synthesize the same TypeScript onto a real FPGA.

THE WORKFLOW
1. A circuit is a file: circuits/<name>.circuit.ts, written with the circuit() API. get_grammar shows how; list_components catalogs every part.
2. check_circuit validates it; simulate_circuit runs it and returns signal traces. In-process, no setup.
3. show_circuit paints it on an interactive canvas in the browser — drillable down to the gates.
4. verify_circuit proves it correct against an oracle (get_verify_api explains testbenches). This is the only step that needs setup_project first.
5. The same circuit exports to Verilog and runs on a ULX3S FPGA (run_on_fpga).

BUNDLED EXAMPLES
Load one with get_started({ example: "<id>" }) — it is written to circuits/<id>.circuit.ts, then show_circuit paints it. No setup, works in an empty folder.

${menu}

Every example also runs in the browser with nothing installed: https://simten.dev/circuit?example=<id>

These examples are maintained and tested in the simten repo — viewing one needs no verification. The verify contract applies once you modify or extend one.`;
}

export function registerGetStartedTool(server: McpServer): void {
  server.tool(
    'get_started',
    DESCRIPTION,
    {
      example: z.string().optional()
        .describe(`Example id to write to circuits/<id>.circuit.ts (one of: ${EXAMPLES.map((e) => e.id).join(', ')}). Omit to get the orientation and example menu.`),
      dir: z.string().optional()
        .describe('Project root to write the example under (default: the MCP working directory)'),
    },
    async ({ example, dir }) => {
      if (!example) {
        return { content: [{ type: 'text' as const, text: buildOrientation() }] };
      }

      const match = EXAMPLES.find((e) => e.id === example);
      if (!match) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            error: `Unknown example "${example}".`,
            available: EXAMPLES.map((e) => ({ id: e.id, title: e.title })),
          }, null, 2) }],
          isError: true,
        };
      }

      const root = dir ? resolve(dir) : process.cwd();
      const circuitsDir = resolve(root, 'circuits');
      const filePath = resolve(circuitsDir, `${match.id}.circuit.ts`);

      // Never clobber: the file may hold the user's edits to a previous load.
      if (existsSync(filePath)) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({
          written: false,
          path: filePath,
          note: 'File already exists (possibly with local edits) — left untouched. show_circuit it as-is, or pass dir to write elsewhere.',
        }, null, 2) }] };
      }

      mkdirSync(circuitsDir, { recursive: true });
      writeFileSync(filePath, materializeExample(match), 'utf8');

      return { content: [{ type: 'text' as const, text: JSON.stringify({
        written: true,
        path: filePath,
        example: { id: match.id, title: match.title, description: match.description },
        next: `show_circuit({ filePath: "${filePath}" }) paints it on the canvas; simulate_circuit runs it headless. This bundled example is maintained and tested in the simten repo — no need to verify it just to view it. If the user modifies or extends it, the normal verify contract applies.`,
        webAlternative: `https://simten.dev/circuit?example=${match.id}`,
      }, null, 2) }] };
    },
  );
}

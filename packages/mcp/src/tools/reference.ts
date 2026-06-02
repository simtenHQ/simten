/**
 * Reference tools — get_grammar + list_components.
 *
 * Clients cap an MCP server's `instructions` field (Claude Code truncates at
 * 2KB; see https://code.claude.com/docs/en/mcp.md). The circuit-builder API
 * (~2KB) and the component catalog (~10KB) can't fit there — they'd be cut,
 * leaving the agent to guess part names and ports. So instead of baking that
 * reference into the always-injected instructions, we expose it on demand via
 * these tools: tool *results* aren't capped, so the agent gets the full text.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@simten/core/api';
import { getFactoryOptionSignatures, annotatePrimitivesWithOptions } from '../lib/primitive-params.js';

// Static reference, built once. The grammar is the circuit() builder API +
// worked examples; the component list is every primitive with its ports and
// constructor options (e.g. `Register ctor({ width?, value? })`) — ports alone
// don't reveal factory options.
const grammar = getGrammarHandler();
const components = annotatePrimitivesWithOptions(
  getPrimitivesHandler({ compact: true }, getLibrary()),
  getFactoryOptionSignatures(),
);

export function registerReferenceTools(server: McpServer): void {
  server.tool(
    'get_grammar',
    'Return the circuit-builder API: how to write a `circuit()` module — inputs/outputs, nodes, connect — with worked examples. Call this before writing a circuit.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: grammar }] }),
  );

  server.tool(
    'list_components',
    'Return the full catalog of available components from `@simten/core/std`, each with its ports and constructor options (e.g. `Register({ width })`). Call this to discover exact part names and parameters instead of guessing.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: components }] }),
  );
}

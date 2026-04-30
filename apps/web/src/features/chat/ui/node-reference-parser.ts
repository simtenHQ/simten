/**
 * Node Reference Parser
 *
 * Extract node IDs from message text for auto-highlighting.
 * Instead of explicit HIGHLIGHT_NODES actions, the LLM mentions
 * nodes naturally and the UI infers highlighting.
 */

// ============================================================================
// Node ID Extraction
// ============================================================================

/**
 * Pattern to match node references in text.
 * Matches:
 * - Simple node names: xor1, and1, reg_out
 * - Port references: xor1.out, and1.a, register.q
 * - Quoted node names: "xor1", 'and1'
 */
const NODE_PATTERN = /(?:["'])?([a-z_][a-z0-9_]*)(?:\.([a-z_][a-z0-9_]*))?(?:["'])?/gi;

/**
 * Words to exclude from node matching (common English words).
 */
const EXCLUDED_WORDS = new Set([
  // Articles and pronouns
  'a', 'an', 'the', 'it', 'is', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if',
  'in', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  // Common words
  'and', 'are', 'but', 'can', 'for', 'has', 'its', 'may', 'not', 'out', 'own',
  'see', 'set', 'the', 'was', 'way', 'who', 'you', 'add', 'all', 'any', 'bit',
  'bus', 'fix', 'get', 'let', 'new', 'now', 'one', 'run', 'try', 'two', 'use',
  // Technical but generic
  'input', 'output', 'node', 'port', 'wire', 'signal', 'value', 'clock', 'data',
  'type', 'name', 'line', 'code', 'file', 'error', 'check', 'then', 'this',
  'that', 'with', 'from', 'have', 'will', 'your', 'when', 'what', 'which',
  'would', 'could', 'should', 'there', 'their', 'them', 'these', 'those',
  // Circuit terms
  'circuit', 'component', 'register', 'gate', 'cycle', 'depth',
]);

/**
 * Extract potential node references from message text.
 * Returns raw matches without validation against actual circuit.
 */
export function extractPotentialNodeRefs(text: string): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = NODE_PATTERN.exec(text)) !== null) {
    const nodeName = match[1].toLowerCase();
    const portName = match[2]?.toLowerCase();

    // Skip excluded words
    if (EXCLUDED_WORDS.has(nodeName)) {
      continue;
    }

    // Build reference
    const ref = portName ? `${nodeName}.${portName}` : nodeName;

    // Deduplicate
    if (!seen.has(ref)) {
      seen.add(ref);
      matches.push(ref);
    }
  }

  return matches;
}

// ============================================================================
// Node Validation
// ============================================================================

export interface CircuitNodeChecker {
  /** Check if a node exists in the circuit */
  hasNode: (nodeId: string) => boolean;
  /** Get all node IDs in the circuit */
  getAllNodeIds: () => string[];
}

/**
 * Extract node references from text and validate against the circuit.
 * Only returns nodes that actually exist in the circuit.
 */
export function extractNodeReferences(
  text: string,
  circuit: CircuitNodeChecker
): string[] {
  const potentialRefs = extractPotentialNodeRefs(text);
  const allNodeIds = circuit.getAllNodeIds();
  const nodeIdSet = new Set(allNodeIds.map((id) => id.toLowerCase()));

  return potentialRefs.filter((ref) => {
    // Check exact match
    if (nodeIdSet.has(ref)) {
      return true;
    }

    // Check node part of port reference (e.g., "xor1" from "xor1.out")
    const nodePart = ref.split('.')[0];
    return nodeIdSet.has(nodePart);
  });
}

/**
 * Extract unique node IDs (without port suffixes) from references.
 */
export function extractUniqueNodeIds(references: string[]): string[] {
  const nodeIds = new Set<string>();

  for (const ref of references) {
    const nodePart = ref.split('.')[0];
    nodeIds.add(nodePart);
  }

  return Array.from(nodeIds);
}

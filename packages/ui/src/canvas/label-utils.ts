import type { Circuit } from "@turing-incomplete/core/dsl";

/**
 * Extract clean label from node ID (removes timestamps and prefixes).
 */
export function extractCleanLabel(nodeId: string): string {
  if (nodeId.includes('.')) {
    return extractCleanLabel(nodeId.split('.').pop() || nodeId);
  }
  const parts = nodeId.split('_');
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{10,}$/.test(parts[i])) {
      const nameParts = parts.slice(0, i);
      if (nameParts.length > 1 && /^[A-Z]/.test(nameParts[0])) {
        return nameParts.slice(1).join('_') || nameParts[0];
      }
      return nameParts.join('_') || nodeId;
    }
  }
  return nodeId;
}

/**
 * Clean up node labels for display.
 */
export function cleanCircuitLabels(circuit: Circuit): Circuit {
  return {
    ...circuit,
    nodes: circuit.nodes.map(node => ({
      ...node,
      label: extractCleanLabel(node.label || node.id),
    })),
  };
}

import { useState, useEffect, useMemo } from "react";
import type { ElkNode, ElkExtendedEdge, ElkPort } from "elkjs/lib/elk.bundled.js";
import type { Circuit } from "@turing-incomplete/core/dsl";
import type { MetadataState } from "../editor/types";

// Lazy-load ELK to avoid instantiating Worker in non-browser runtimes (e.g. Cloudflare Workers SSR)
let elkInstance: InstanceType<typeof import("elkjs/lib/elk.bundled.js").default> | null = null;
async function getElk() {
  if (!elkInstance) {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    elkInstance = new ELK();
  }
  return elkInstance;
}

/** Node size constants by component type */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  Switch:         { width: 80, height: 48 },
  Button:         { width: 80, height: 48 },
  Input:          { width: 100, height: 48 },
  Led:            { width: 80, height: 48 },
  Output:         { width: 80, height: 48 },
  HexDisplay:     { width: 80, height: 60 },
  SevenSegment:   { width: 80, height: 60 },
  Screen:         { width: 180, height: 180 },
  RasterDisplay:  { width: 180, height: 180 },
  Console:        { width: 200, height: 160 },
  Register:       { width: 100, height: 60 },
  RAM:            { width: 100, height: 60 },
  ROM:            { width: 100, height: 60 },
  DualPortRAM:    { width: 120, height: 80 },
};

const DEFAULT_DIMENSIONS = { width: 100, height: 60 };

function getDimensions(componentRef: string) {
  return NODE_DIMENSIONS[componentRef] ?? DEFAULT_DIMENSIONS;
}

export interface ElkLayoutOptions {
  direction?: "RIGHT" | "DOWN" | "LEFT" | "UP";
  spacing?: number;
}

/**
 * Synchronous fallback layout (3-column: inputs | impl | outputs).
 * Used as initial render before ELK resolves.
 */
function fallbackLayout(circuit: Circuit): MetadataState {
  const metadata: MetadataState = { components: {}, connections: {} };
  if (!circuit?.nodes) return metadata;

  const inputNodes: string[] = [];
  const implNodes: string[] = [];
  const outputNodes: string[] = [];

  for (const node of circuit.nodes) {
    const ref = node.componentRef;
    if (ref === 'Switch' || ref === 'Input' || ref === 'Button') {
      inputNodes.push(node.id);
    } else if (ref === 'Led' || ref === 'Output') {
      outputNodes.push(node.id);
    } else {
      implNodes.push(node.id);
    }
  }

  const SPACING_X = 160;
  const SPACING_Y = 70;
  const START_X = 30;
  const START_Y = 40;

  const maxRows = Math.max(inputNodes.length, implNodes.length, outputNodes.length, 1);
  const totalHeight = (maxRows - 1) * SPACING_Y;

  const inputStartY = START_Y + (totalHeight - (inputNodes.length - 1) * SPACING_Y) / 2;
  inputNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = { id: nodeId, position: { x: START_X, y: inputStartY + i * SPACING_Y } };
  });

  const implCols = Math.ceil(implNodes.length / 3);
  const implStartY = START_Y + (totalHeight - (Math.min(implNodes.length, 3) - 1) * SPACING_Y) / 2;
  implNodes.forEach((nodeId, i) => {
    const col = Math.floor(i / 3);
    const row = i % 3;
    metadata.components[nodeId] = {
      id: nodeId,
      position: { x: START_X + SPACING_X + col * SPACING_X, y: implStartY + row * SPACING_Y },
    };
  });

  const outputX = START_X + SPACING_X * (1 + Math.max(implCols, 1));
  const outputStartY = START_Y + (totalHeight - (outputNodes.length - 1) * SPACING_Y) / 2;
  outputNodes.forEach((nodeId, i) => {
    metadata.components[nodeId] = { id: nodeId, position: { x: outputX, y: outputStartY + i * SPACING_Y } };
  });

  return metadata;
}

/**
 * Compute ELK layout for a circuit. Returns a MetadataState with node positions.
 */
export async function computeElkLayout(
  circuit: Circuit,
  options?: ElkLayoutOptions,
): Promise<MetadataState> {
  const direction = options?.direction ?? "RIGHT";
  const spacing = options?.spacing ?? 50;

  // Build node map for quick port lookup
  const nodeMap = new Map(circuit.nodes.map(n => [n.id, n]));

  // Build ELK nodes with ports
  const elkNodes: ElkNode[] = circuit.nodes.map(node => {
    const dims = getDimensions(node.componentRef);

    const inputPorts: ElkPort[] = node.inputs.map((p, i) => ({
      id: `${node.id}__in__${p.name}`,
      properties: {
        "port.side": "WEST",
        "port.index": String(i),
      },
    }));

    const outputPorts: ElkPort[] = node.outputs.map((p, i) => ({
      id: `${node.id}__out__${p.name}`,
      properties: {
        "port.side": "EAST",
        "port.index": String(i),
      },
    }));

    return {
      id: node.id,
      width: dims.width,
      height: dims.height,
      ports: [...inputPorts, ...outputPorts],
      properties: {
        "portConstraints": "FIXED_ORDER",
      },
    };
  });

  // Build ELK edges
  const elkEdges: ElkExtendedEdge[] = [];
  for (const conn of circuit.connections) {
    const sourceNode = nodeMap.get(conn.source.nodeId);
    const targetNode = nodeMap.get(conn.target.nodeId);
    if (!sourceNode || !targetNode) continue;

    elkEdges.push({
      id: conn.id,
      sources: [`${conn.source.nodeId}__out__${conn.source.portName}`],
      targets: [`${conn.target.nodeId}__in__${conn.target.portName}`],
    });
  }

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.spacing.nodeNode": String(spacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing * 1.5),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const elk = await getElk();
  const laid = await elk.layout(graph);

  const metadata: MetadataState = { components: {}, connections: {} };
  for (const child of laid.children ?? []) {
    metadata.components[child.id] = {
      id: child.id,
      position: { x: child.x ?? 0, y: child.y ?? 0 },
    };
  }

  return metadata;
}

/**
 * React hook for ELK layout. Returns the current layout metadata and a ready flag.
 * Starts with a synchronous fallback and replaces with ELK once resolved.
 */
export function useElkLayout(
  circuit: Circuit | null,
  options?: ElkLayoutOptions,
): { metadata: MetadataState; isLayoutReady: boolean } {
  // Synchronous fallback for immediate render
  const fallback = useMemo(() => {
    if (!circuit) return { components: {}, connections: {} } as MetadataState;
    return fallbackLayout(circuit);
  }, [circuit]);

  const [elkMetadata, setElkMetadata] = useState<MetadataState | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Serialize options to avoid re-running on reference changes
  const direction = options?.direction ?? "RIGHT";
  const spacing = options?.spacing ?? 50;

  useEffect(() => {
    if (!circuit) {
      setElkMetadata(null);
      setIsLayoutReady(false);
      return;
    }

    let cancelled = false;
    setIsLayoutReady(false);

    computeElkLayout(circuit, { direction, spacing }).then(result => {
      if (!cancelled) {
        setElkMetadata(result);
        setIsLayoutReady(true);
      }
    });

    return () => { cancelled = true; };
  }, [circuit, direction, spacing]);

  return {
    metadata: elkMetadata ?? fallback,
    isLayoutReady,
  };
}

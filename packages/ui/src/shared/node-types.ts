import { SmoothStepEdge, type NodeTypes, type EdgeTypes } from "@xyflow/react";

// Embed-weight node components (no store dependencies)
import { InputNode } from "../editor/components/nodes/InputNode";
import { OutputNode } from "../editor/components/nodes/OutputNode";
import { LogicGateNode } from "../editor/components/nodes/LogicGateNode";
import { EmbedConsoleNode } from "../embed/EmbedConsoleNode";
import { EmbedScreenNode } from "../embed/EmbedScreenNode";

// Full-weight node components (rich rendering for editor & inspector)
import { NumericInputNode } from "../editor/components/nodes/NumericInputNode";
import { ScreenNode } from "../editor/components/nodes/ScreenNode";
import { RasterDisplayNode } from "../editor/components/nodes/RasterDisplayNode";
import { RegisterNode } from "../editor/components/nodes/RegisterNode";
import { RAMNode } from "../editor/components/nodes/RAMNode";
import { ROMNode } from "../editor/components/nodes/ROMNode";
import { ConsoleNode } from "../editor/components/nodes/ConsoleNode";
import { RV32IInstrMemNode } from "../editor/components/nodes/RV32IInstrMemNode";


/**
 * Node type map for embed / auto-layout contexts.
 * Maps RAM/ROM/Register to LogicGateNode fallbacks,
 * Screen/Console to lightweight embed variants.
 */
export const EMBED_NODE_TYPES: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  numericInputNode: InputNode,
  registerNode: LogicGateNode,
  ramNode: LogicGateNode,
  romNode: LogicGateNode,
  rv32iInstrMemNode: LogicGateNode,
  consoleNode: EmbedConsoleNode,
  screenNode: EmbedScreenNode,
  rasterDisplayNode: EmbedScreenNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/**
 * Edge type map for embed / auto-layout contexts.
 * Maps the "orthogonal" type (set by projection.ts) to ReactFlow's built-in
 * SmoothStepEdge — orthogonal routing without the interactive waypoint editor.
 */
export const EDGE_TYPES: EdgeTypes = {
  orthogonal: SmoothStepEdge,
};

/**
 * Full node type map for editor & inspector contexts.
 * Uses rich node components (Screen, RAM, ROM, Register, NumericInput, Console).
 */
export const FULL_NODE_TYPES: NodeTypes = {
  inputNode: InputNode,
  numericInputNode: NumericInputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  screenNode: ScreenNode,
  rasterDisplayNode: RasterDisplayNode,
  registerNode: RegisterNode,
  ramNode: RAMNode,
  romNode: ROMNode,
  rv32iInstrMemNode: RV32IInstrMemNode,
  consoleNode: ConsoleNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as NodeTypes;

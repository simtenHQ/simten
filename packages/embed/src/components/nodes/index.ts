/**
 * Re-export canonical node components from @turing-incomplete/ui/nodes.
 * This allows external consumers to import from @turing-incomplete/embed/nodes
 * while the source of truth lives in the ui package.
 */
export {
  BaseNode,
  type PortConfig,
  type BaseNodeProps,
  InputNode,
  OutputNode,
  LogicGateNode,
  EmbedConsoleNode,
  EmbedScreenNode,
  CompositeBadge,
  type NodeData,
} from "@turing-incomplete/ui/nodes";

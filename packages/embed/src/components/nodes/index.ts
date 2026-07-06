/**
 * Re-export canonical node components from @simten/ui/nodes.
 * This allows external consumers to import from @simten/embed/nodes
 * while the source of truth lives in the ui package.
 */
export {
  BaseNode,
  type BaseNodeProps,
  CompositeBadge,
  EmbedConsoleNode,
  EmbedScreenNode,
  InputNode,
  LogicGateNode,
  type NodeData,
  OutputNode,
  type PortConfig,
} from '@simten/ui/nodes';

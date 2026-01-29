# Visual Editor Guide

**Version:** 1.0.0
**Audience:** Users and Developers

## Table of Contents

**Part 1: User Guide**
1. [Overview](#overview)
2. [Working with Nodes](#working-with-nodes)
3. [Connecting Components](#connecting-components)
4. [Edge Waypoints](#edge-waypoints)
5. [Layout Tips](#layout-tips)

**Part 2: Developer API**
6. [Architecture](#architecture)
7. [Customizing Edges](#customizing-edges)
8. [Store API Reference](#store-api-reference)
9. [Extending the Editor](#extending-the-editor)

---

# Part 1: User Guide

## Overview

The visual editor provides an intuitive interface for building and simulating circuits. Components are represented as nodes, and connections between them are shown as edges (wires).

### Key Features

- **Drag-and-drop components** from the palette
- **Orthogonal routing** (Manhattan-style wires)
- **Waypoint customization** for clean layouts
- **Live simulation** with visual feedback
- **Time-travel debugging** with timeline controls

---

## Working with Nodes

### Adding Components

1. **From Palette**: Click and drag a component from the left sidebar onto the canvas
2. **Position**: Drop the component where you want it placed
3. **Select**: Click on a component to select it (blue outline)
4. **Move**: Drag selected components to reposition them
5. **Delete**: Select a component and press Delete key

### Component Types

**Primitives** (built-in, executable behavior):
- Logic Gates: And, Or, Not, Xor, etc.
- Sequential: Register, DFlipFlop
- Memory: RAM, ROM
- I/O: Switch, Led, Button, Input
- Display: HexDisplay, SevenSegment, Screen

**Composites** (user-defined, structural):
- Any circuit you define in DSL
- Appears in the component palette after definition
- Expandable to see internal structure

See [Component Model](../SPECIFICATIONS/component-model.md) for details on primitives vs composites.

### Node Interactions

**Double-click:** Open component properties (if configurable)
**Right-click:** Context menu (delete, duplicate, view definition)
**Hover:** Shows component name and type

---

## Connecting Components

### Creating Connections

1. **Click** on an output port (right side of component)
2. **Drag** to the target input port (left side of component)
3. **Release** to create the connection

### Connection Rules

- **One output → many inputs**: Allowed (fan-out)
- **Many outputs → one input**: NOT allowed (short circuit)
- **Type matching**: Bit → Bit, Bus[8] → Bus[8]
- **No self-loops**: Cannot connect a component to itself (combinational loop)

### Visual Feedback

- **Valid target**: Port highlights green
- **Invalid target**: Port highlights red
- **Connection hover**: Edge highlights and cursor changes
- **Selected**: Edge becomes thicker and brighter

### Deleting Connections

- **Click on edge** to select it
- **Press Delete** key
- Or **right-click** on edge → Delete

---

## Edge Waypoints

### What are Waypoints?

Waypoints are control points that let you customize how wires route between components. Instead of automatic paths, you can add waypoints to:
- Route around obstacles
- Create cleaner, more organized layouts
- Reduce visual clutter

### Orthogonal Routing

All edges use **orthogonal (Manhattan) routing**:
- Wires only travel horizontally or vertically
- No diagonal or curved segments
- Clean, circuit-diagram-like appearance
- Professional schematic style

### Adding Waypoints

**Double-click** anywhere on an edge to add a waypoint at that position.

```
Before:                      After:
[A] ─────────→ [B]          [A] ────→ ● ──→ [B]
                                     ↑
                                  waypoint
```

### Moving Waypoints

**Click and drag** the circular waypoint handle to move it.

- **Visual indicator**: Waypoint circles match edge color
- **Hover effect**: Handle grows larger on hover
- **Real-time update**: Path recalculates as you drag

### Deleting Waypoints

**Right-click** on a waypoint handle to remove it.

The edge will recalculate its path without that waypoint.

### Cursor Indicators

- **Crosshair**: Hovering over edge (can add waypoint)
- **Grab**: Hovering over waypoint handle
- **Grabbing**: Dragging a waypoint

### Persistence

Waypoint positions are automatically saved and restored when you reload the page.

---

## Layout Tips

### Best Practices

1. **Start simple**: Use automatic routing initially
2. **Add waypoints sparingly**: Only where needed for clarity
3. **Align components**: Use grid alignment for cleaner appearance
4. **Route around nodes**: Don't let wires cross through components
5. **Minimize bends**: Fewer waypoints = cleaner diagrams
6. **Group related components**: Keep connected components close together
7. **Left-to-right flow**: Inputs on left, outputs on right

### Common Patterns

**Fan-out (one output → many inputs):**
```
        ┌→ [Node 1]
[Source]┼→ [Node 2]
        └→ [Node 3]
```

**Bus routing:**
```
[A] ════════════→ [B]
    (thick line = multi-bit bus)
```

**Feedback loops:**
```
[A] ──→ [B]
 ↑      ↓
 └──────┘
(requires waypoints for clean layout)
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete | Delete selected node or edge |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+C | Copy selected |
| Ctrl+V | Paste |
| Arrow keys | Nudge selected node |

---

## Troubleshooting

### Problem: Waypoint won't move
**Solution**: Click directly on the waypoint handle (small circle)

### Problem: Can't add waypoint
**Solution**: Double-click on the edge itself, not on empty space

### Problem: Edge looks jagged
**Solution**: Remove unnecessary waypoints (right-click to delete)

### Problem: Lost waypoints after reload
**Solution**: Check browser console for errors - waypoints should persist automatically

### Problem: Can't connect components
**Solution**: Check type compatibility (Bit vs Bus), ensure no cycles

---

# Part 2: Developer API

## Architecture

### Component Hierarchy

```
Visual Editor
 └─ ReactFlowProvider
     └─ Canvas
         └─ ReactFlow
             ├─ Nodes (InputNode, OutputNode, ComponentNode)
             └─ Edges (OrthogonalEdge)
```

### State Management

```
IR Store (Logic)              Metadata Store (Visual)
├─ nodes                      ├─ nodes
│  ├─ id                      │  ├─ position
│  ├─ type                    │  └─ selected
│  └─ ports                   └─ edges
└─ connections                   ├─ color
   ├─ from                       ├─ animated
   └─ to                         └─ waypoints ⭐
```

**Key Principle:**
- **IR Store** contains circuit logic (what connects to what)
- **Metadata Store** contains visual presentation (where things are, how they look)
- **Projection Layer** transforms IR + metadata → ReactFlow format

### Core Files

| File | Purpose |
|------|---------|
| `types/visual.ts` | Type definitions for visual metadata |
| `stores/metadata-store.ts` | Visual state management |
| `stores/ir-store.ts` | Circuit logic state |
| `utils/projection.ts` | IR → ReactFlow transformation |
| `components/edges/OrthogonalEdge.tsx` | Edge rendering component |
| `components/Canvas.tsx` | Main canvas with ReactFlow |

### Data Flow

```
User Action (e.g., drag waypoint)
    ↓
Metadata Store Update (waypoints array)
    ↓
Projection (projectToEdges)
    ↓
ReactFlow Edge Update
    ↓
OrthogonalEdge Re-render
```

---

## Customizing Edges

### Edge Metadata

```typescript
interface ConnectionMetadata {
  color?: string;        // Edge color (default: gray)
  animated?: boolean;    // Animated flow (default: false)
  waypoints?: Position[]; // Array of waypoint coordinates
}

interface Position {
  x: number;  // Flow coordinates (not screen pixels)
  y: number;
}
```

### Custom Edge Colors

```typescript
import { useMetadataStore } from '@/stores/metadata-store';

const updateConnectionColor = useMetadataStore(
  (state) => state.updateConnection
);

// Set edge color
updateConnectionColor('connection-123', {
  color: '#ff0000'  // Red
});
```

### Custom Edge Animation

```typescript
updateConnectionColor('connection-123', {
  animated: true  // Enables animated flow
});
```

### Programmatic Waypoints

```typescript
import { useMetadataStore } from '@/stores/metadata-store';

const updateConnectionWaypoints = useMetadataStore(
  (state) => state.updateConnectionWaypoints
);

// Set waypoints programmatically
updateConnectionWaypoints('connection-123', [
  { x: 100, y: 200 },
  { x: 300, y: 200 },
  { x: 300, y: 400 },
]);
```

---

## Store API Reference

### Metadata Store Actions

#### `updateConnection(id, metadata)`

Update visual metadata for a connection.

```typescript
updateConnection(connectionId: string, metadata: Partial<ConnectionMetadata>): void
```

**Example:**
```typescript
updateConnection('edge-1', {
  color: '#00ff00',
  animated: true
});
```

#### `updateConnectionWaypoints(id, waypoints)`

Replace all waypoints for a connection.

```typescript
updateConnectionWaypoints(connectionId: string, waypoints: Position[]): void
```

**Example:**
```typescript
updateConnectionWaypoints('edge-1', [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 }
]);
```

#### `addConnectionWaypoint(id, position, index?)`

Add a single waypoint at a specific position.

```typescript
addConnectionWaypoint(
  connectionId: string,
  position: Position,
  index?: number
): void
```

**Example:**
```typescript
// Add at end
addConnectionWaypoint('edge-1', { x: 150, y: 150 });

// Insert at index 1
addConnectionWaypoint('edge-1', { x: 150, y: 150 }, 1);
```

#### `removeConnectionWaypoint(id, index)`

Remove a waypoint by index.

```typescript
removeConnectionWaypoint(connectionId: string, index: number): void
```

**Example:**
```typescript
removeConnectionWaypoint('edge-1', 0);  // Remove first waypoint
```

#### `moveConnectionWaypoint(id, index, position)`

Update a specific waypoint's position.

```typescript
moveConnectionWaypoint(
  connectionId: string,
  index: number,
  position: Position
): void
```

**Example:**
```typescript
moveConnectionWaypoint('edge-1', 0, { x: 120, y: 180 });
```

### Metadata Store Selectors

```typescript
// Get all connection metadata
const connections = useMetadataStore((state) => state.connections);

// Get specific connection metadata
const connectionMeta = useMetadataStore((state) =>
  state.connections[connectionId]
);

// Get waypoints for a connection
const waypoints = useMetadataStore((state) =>
  state.connections[connectionId]?.waypoints ?? []
);
```

---

## Extending the Editor

### Creating Custom Edge Types

1. **Define Edge Component:**

```typescript
// components/edges/CustomEdge.tsx
import { EdgeProps, getSmoothStepPath } from 'reactflow';

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      stroke={data?.color ?? '#b1b1b7'}
      strokeWidth={2}
    />
  );
}
```

2. **Register Edge Type:**

```typescript
// components/Canvas.tsx
import { CustomEdge } from './edges/CustomEdge';

const edgeTypes = {
  orthogonal: OrthogonalEdge,
  custom: CustomEdge,  // Add your custom type
};

<ReactFlow
  edgeTypes={edgeTypes}
  // ...
/>
```

3. **Use Custom Edge:**

```typescript
// In projection.ts or metadata
const edge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'custom',  // Use your custom edge
  data: { color: '#ff0000' }
};
```

### Adding Waypoint Interactions

The `OrthogonalEdge` component handles waypoint interactions:

- **Double-click detection**: Uses `onEdgeDoubleClick` event
- **Waypoint dragging**: Custom drag handlers on waypoint circles
- **Context menu**: Right-click on waypoints for deletion

To extend waypoint behavior:

```typescript
// In OrthogonalEdge.tsx
const handleWaypointDrag = (index: number, event: React.MouseEvent) => {
  // Custom logic here
  const newPosition = screenToFlowPosition(event.clientX, event.clientY);
  moveWaypoint(id, index, newPosition);
};
```

### Custom Routing Algorithms

The current implementation uses orthogonal routing. To add custom routing:

1. **Create routing function:**

```typescript
// utils/routing.ts
export function customRoute(
  source: Position,
  target: Position,
  waypoints: Position[]
): string {
  // Return SVG path string
  return `M ${source.x},${source.y} ...`;
}
```

2. **Use in Edge component:**

```typescript
const pathData = customRoute(
  { x: sourceX, y: sourceY },
  { x: targetX, y: targetY },
  waypoints
);
```

### Styling Edges

Edges can be styled via:

1. **Inline styles** (in Edge component)
2. **CSS classes** (in global styles)
3. **Metadata properties** (color, animated, etc.)

**Example CSS:**

```css
.react-flow__edge-path {
  stroke: #b1b1b7;
  stroke-width: 2;
  fill: none;
}

.react-flow__edge-path:hover {
  stroke: #555;
  stroke-width: 3;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: #1a192b;
  stroke-width: 3;
}
```

---

## Related Documents

- [Component Model](../SPECIFICATIONS/component-model.md) - Component architecture
- [Getting Started](../getting-started.md) - User introduction
- [DSL Specification](../SPECIFICATIONS/DSL-and-IR-specification.md) - Circuit definition language

---

## Future Enhancements

**Planned features:**
- Auto-layout algorithms (force-directed, hierarchical)
- Smart routing (avoid overlaps automatically)
- Edge bundling (group parallel edges)
- Snap-to-grid for waypoints
- Keyboard shortcuts for waypoint manipulation
- Undo/redo for waypoint changes
- Copy/paste edges with waypoints
- Import/export edge styling

**API extensions:**
- `optimizeWaypoints(connectionId)` - Remove redundant waypoints
- `autoRouteConnection(connectionId, algorithm)` - Apply routing algorithm
- `getEdgePath(connectionId)` - Get computed SVG path
- `setEdgeType(connectionId, type)` - Change edge rendering type

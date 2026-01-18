# Edge Customization API

## Developer Guide for Extending Edge Functionality

This guide explains how to extend, modify, or build upon the orthogonal edge implementation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Component Tree                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  VisualEditor                                                │
│    └─ ReactFlowProvider                                      │
│        └─ Canvas                                             │
│            └─ ReactFlow                                      │
│                ├─ Nodes (InputNode, OutputNode, etc.)       │
│                └─ Edges (OrthogonalEdge)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        State Layer                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  IR Store (Logic)          Metadata Store (Visual)          │
│  ├─ components             ├─ components                     │
│  │   └─ positions           │   ├─ position                 │
│  └─ connections            │   └─ selected                  │
│      ├─ source             └─ connections                   │
│      ├─ target                 ├─ color                     │
│      └─ ports                  ├─ animated                  │
│                                 └─ waypoints ⭐              │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Projection Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  projectToNodes(ir, metadata) → ReactFlow Nodes             │
│  projectToEdges(ir, metadata) → ReactFlow Edges             │
│                                  └─ includes waypoints       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Files Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `types/visual.ts` | Type definitions | `ConnectionMetadata`, `Position` |
| `stores/metadata-store.ts` | State management | `useMetadataStore`, waypoint actions |
| `utils/projection.ts` | Data transformation | `projectToEdges()` |
| `components/edges/OrthogonalEdge.tsx` | Edge rendering | `OrthogonalEdge` component |
| `components/Canvas.tsx` | Main canvas | Edge type registration |

## API Reference

### Store Actions

#### `updateConnectionWaypoints(id, waypoints)`
Replace all waypoints for a connection.

```typescript
import { useMetadataStore } from '@/features/visual-editor/stores/metadata-store';

const updateConnectionWaypoints = useMetadataStore(
  (state) => state.updateConnectionWaypoints
);

// Example: Set waypoints programmatically
updateConnectionWaypoints('connection-123', [
  { x: 100, y: 200 },
  { x: 300, y: 200 },
  { x: 300, y: 400 },
]);
```

#### `addConnectionWaypoint(id, waypoint)`
Append a single waypoint to the end.

```typescript
const addConnectionWaypoint = useMetadataStore(
  (state) => state.addConnectionWaypoint
);

addConnectionWaypoint('connection-123', { x: 250, y: 300 });
```

#### `removeConnectionWaypoint(id, waypointIndex)`
Remove a waypoint by its index.

```typescript
const removeConnectionWaypoint = useMetadataStore(
  (state) => state.removeConnectionWaypoint
);

removeConnectionWaypoint('connection-123', 0); // Remove first waypoint
```

#### `getConnectionMetadata(id)`
Read current metadata including waypoints.

```typescript
const getConnectionMetadata = useMetadataStore(
  (state) => state.getConnectionMetadata
);

const metadata = getConnectionMetadata('connection-123');
console.log(metadata?.waypoints); // Array of positions
```

### Path Computation

#### `computeOrthogonalPath(sourceX, sourceY, targetX, targetY, waypoints)`
Internal function that computes the SVG path string.

**Algorithm**:
1. Start at source position
2. If no waypoints: create simple 3-segment path (H-V-H)
3. If waypoints exist:
   - Route to each waypoint using alternating H-V or V-H pattern
   - Route from last waypoint to target

**Example Usage**:
```typescript
const path = computeOrthogonalPath(0, 0, 100, 100, [
  { x: 50, y: 0 },
  { x: 50, y: 100 },
]);
// Returns: "M 0 0 L 50 0 L 50 0 L 50 100 L 100 100 L 100 100"
```

## Extension Examples

### Example 1: Auto-Add Waypoint on Long Connections

```typescript
// In Canvas.tsx or custom hook
import { useEffect } from 'react';
import { useIRStore, useMetadataStore } from '../stores';

export function useAutoWaypoints() {
  const connections = useIRStore((state) => state.connections);
  const components = useIRStore((state) => state.components);
  const componentMetadata = useMetadataStore((state) => state.components);
  const updateConnectionWaypoints = useMetadataStore(
    (state) => state.updateConnectionWaypoints
  );

  useEffect(() => {
    Object.entries(connections).forEach(([id, connection]) => {
      const source = componentMetadata[connection.sourceComponentId];
      const target = componentMetadata[connection.targetComponentId];

      if (!source || !target) return;

      const distance = Math.sqrt(
        Math.pow(target.position.x - source.position.x, 2) +
        Math.pow(target.position.y - source.position.y, 2)
      );

      // If connection is longer than 500px, add a midpoint waypoint
      if (distance > 500) {
        const midpoint = {
          x: (source.position.x + target.position.x) / 2,
          y: (source.position.y + target.position.y) / 2,
        };

        updateConnectionWaypoints(id, [midpoint]);
      }
    });
  }, [connections, componentMetadata]);
}
```

### Example 2: Snap Waypoints to Grid

```typescript
// Add to OrthogonalEdge.tsx
const GRID_SIZE = 20;

function snapToGrid(position: Position): Position {
  return {
    x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
  };
}

// Modify handleWaypointDrag
const handleWaypointDrag = useCallback(
  (waypointIndex: number, event: React.MouseEvent) => {
    // ... existing code ...

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();

      const deltaX = moveEvent.clientX - startClientX;
      const deltaY = moveEvent.clientY - startClientY;

      const newPosition = {
        x: startWaypoint.x + deltaX,
        y: startWaypoint.y + deltaY,
      };

      // Apply grid snapping
      const snappedPosition = snapToGrid(newPosition);

      const newWaypoints = [...waypoints];
      newWaypoints[waypointIndex] = snappedPosition;

      updateConnectionMetadata(id, {
        ...getConnectionMetadata(id),
        id,
        waypoints: newWaypoints,
      });
    };

    // ... rest of code ...
  },
  [waypoints, id, updateConnectionMetadata, getConnectionMetadata]
);
```

### Example 3: Custom Edge Type with Smart Routing

```typescript
// Create SmartOrthogonalEdge.tsx
import { OrthogonalEdge } from './OrthogonalEdge';
import type { EdgeProps } from '@xyflow/react';

export function SmartOrthogonalEdge(props: EdgeProps) {
  // If no waypoints exist, calculate optimal path avoiding nodes
  const waypoints = useMemo(() => {
    if (props.data?.waypoints?.length > 0) {
      return props.data.waypoints;
    }

    // Custom pathfinding logic here
    const calculatedWaypoints = calculateOptimalPath(
      props.sourceX,
      props.sourceY,
      props.targetX,
      props.targetY,
      getAllNodeBounds()
    );

    return calculatedWaypoints;
  }, [props]);

  // Pass calculated waypoints to base component
  return <OrthogonalEdge {...props} data={{ waypoints }} />;
}

function calculateOptimalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  obstacles: Bounds[]
): Position[] {
  // Implement A* or similar pathfinding
  // Return array of waypoint positions
  return [];
}

// Register in Canvas.tsx
const edgeTypes = {
  orthogonal: OrthogonalEdge,
  smartOrthogonal: SmartOrthogonalEdge,
};
```

### Example 4: Waypoint Constraints

```typescript
// Add constraints to waypoint dragging
interface WaypointConstraints {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  snapToAxis?: 'horizontal' | 'vertical';
}

function applyConstraints(
  position: Position,
  constraints: WaypointConstraints
): Position {
  let { x, y } = position;

  if (constraints.minX !== undefined) x = Math.max(x, constraints.minX);
  if (constraints.maxX !== undefined) x = Math.min(x, constraints.maxX);
  if (constraints.minY !== undefined) y = Math.max(y, constraints.minY);
  if (constraints.maxY !== undefined) y = Math.min(y, constraints.maxY);

  if (constraints.snapToAxis === 'horizontal') y = position.y; // Lock Y
  if (constraints.snapToAxis === 'vertical') x = position.x; // Lock X

  return { x, y };
}

// Use in handleWaypointDrag
const constrainedPosition = applyConstraints(newPosition, {
  minX: 0,
  minY: 0,
  snapToAxis: event.shiftKey ? 'horizontal' : undefined,
});
```

### Example 5: Waypoint Presets

```typescript
// Create preset waypoint patterns
type WaypointPreset = 'direct' | 'staircase' | 'detour';

function generateWaypointPreset(
  preset: WaypointPreset,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): Position[] {
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  switch (preset) {
    case 'direct':
      return [{ x: midX, y: sourceY }, { x: midX, y: targetY }];

    case 'staircase':
      const quarterX = sourceX + (targetX - sourceX) * 0.25;
      const threeQuarterX = sourceX + (targetX - sourceX) * 0.75;
      return [
        { x: quarterX, y: sourceY },
        { x: quarterX, y: midY },
        { x: threeQuarterX, y: midY },
        { x: threeQuarterX, y: targetY },
      ];

    case 'detour':
      const offset = 100;
      return [
        { x: sourceX, y: sourceY + offset },
        { x: targetX, y: sourceY + offset },
      ];

    default:
      return [];
  }
}

// Use with context menu or toolbar
function applyPreset(connectionId: string, preset: WaypointPreset) {
  const updateConnectionWaypoints = useMetadataStore.getState().updateConnectionWaypoints;
  const connection = useIRStore.getState().connections[connectionId];
  const metadata = useMetadataStore.getState();

  const source = metadata.components[connection.sourceComponentId];
  const target = metadata.components[connection.targetComponentId];

  const waypoints = generateWaypointPreset(
    preset,
    source.position.x,
    source.position.y,
    target.position.x,
    target.position.y
  );

  updateConnectionWaypoints(connectionId, waypoints);
}
```

## Testing Custom Extensions

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMetadataStore } from './metadata-store';

describe('Custom waypoint extensions', () => {
  beforeEach(() => {
    useMetadataStore.getState().clearAll();
  });

  it('adds waypoint with constraints', () => {
    const { result } = renderHook(() => useMetadataStore());

    act(() => {
      const position = { x: 150, y: 250 };
      const constrained = applyConstraints(position, {
        maxX: 100,
        minY: 200,
      });

      result.current.addConnectionWaypoint('conn-1', constrained);
    });

    const metadata = result.current.getConnectionMetadata('conn-1');
    expect(metadata?.waypoints?.[0]).toEqual({ x: 100, y: 250 });
  });

  it('generates waypoint preset', () => {
    const waypoints = generateWaypointPreset('staircase', 0, 0, 400, 400);
    expect(waypoints).toHaveLength(4);
    expect(waypoints[0]).toEqual({ x: 100, y: 0 });
  });
});
```

## Performance Considerations

### Optimize for Many Waypoints

```typescript
// Debounce waypoint updates during drag
import { useMemo } from 'react';
import { debounce } from 'lodash'; // or implement your own

const debouncedUpdateWaypoint = useMemo(
  () =>
    debounce((id: string, waypoints: Position[]) => {
      updateConnectionMetadata(id, {
        ...getConnectionMetadata(id),
        id,
        waypoints,
      });
    }, 16), // ~60fps
  []
);
```

### Virtualize Waypoint Handles

```typescript
// Only render waypoints in viewport
function getVisibleWaypoints(
  waypoints: Position[],
  viewportBounds: Bounds
): Position[] {
  return waypoints.filter(
    (wp) =>
      wp.x >= viewportBounds.left &&
      wp.x <= viewportBounds.right &&
      wp.y >= viewportBounds.top &&
      wp.y <= viewportBounds.bottom
  );
}
```

## Best Practices

1. **Always use the store actions** - Don't mutate state directly
2. **Debounce expensive operations** - Path computation, store updates
3. **Validate waypoint positions** - Ensure they're within valid bounds
4. **Handle edge cases** - Empty waypoints, single waypoint, etc.
5. **Test thoroughly** - Unit tests for path computation, integration tests for interactions
6. **Document extensions** - Help future developers understand your customizations

## Common Pitfalls

1. **Forgetting coordinate systems** - Waypoints are in flow coordinates, not screen coordinates
2. **Memory leaks** - Always clean up event listeners in drag handlers
3. **Performance** - Don't update store on every mousemove without debouncing
4. **State consistency** - Ensure waypoints and IR state stay in sync
5. **Edge cases** - Handle undefined metadata gracefully

# Orthogonal Edge with Waypoints

## Overview

The `OrthogonalEdge` component provides Manhattan/step routing for connections in the visual editor, replacing the default curved edges. It includes support for user-controllable waypoints that persist in the metadata store.

## Features

### 1. Orthogonal Routing
- Edges now use step-based routing (horizontal and vertical segments only)
- No curved connections - all paths are orthogonal
- Automatic path calculation between source and target

### 2. Waypoint System
- **Add Waypoints**: Double-click on any edge to add a waypoint at that position
- **Move Waypoints**: Click and drag waypoint handles to customize the routing path
- **Delete Waypoints**: Right-click on any waypoint handle to remove it
- **Persistence**: All waypoints are stored in the metadata store and persist across sessions

### 3. Visual Feedback
- Waypoint handles appear as circles with the same color as the edge
- Handles scale up on hover for better visibility
- Cursor changes to indicate drag state
- Tooltip shows interaction instructions

## Architecture

### Data Flow

```
User Interaction
    ↓
OrthogonalEdge Component
    ↓
Metadata Store (waypoints array)
    ↓
Projection Utils (projectToEdges)
    ↓
ReactFlow Edge Rendering
```

### Files Modified/Created

1. **`/src/features/visual-editor/types/visual.ts`**
   - Extended `ConnectionMetadata` interface to include `waypoints?: Position[]`

2. **`/src/features/visual-editor/stores/metadata-store.ts`**
   - Added `updateConnectionWaypoints(id, waypoints)`
   - Added `addConnectionWaypoint(id, waypoint)`
   - Added `removeConnectionWaypoint(id, waypointIndex)`

3. **`/src/features/visual-editor/utils/projection.ts`**
   - Updated `projectToEdges()` to:
     - Set edge type to 'orthogonal'
     - Include waypoints in edge data

4. **`/src/features/visual-editor/components/edges/OrthogonalEdge.tsx`** (NEW)
   - Custom edge component
   - Waypoint rendering and interaction logic
   - Orthogonal path computation

5. **`/src/features/visual-editor/components/Canvas.tsx`**
   - Registered custom edge type: `edgeTypes = { orthogonal: OrthogonalEdge }`

## Usage

### For End Users

1. **Create connections as normal** - they will automatically use orthogonal routing

2. **Customize routing**:
   - Double-click on an edge to add a waypoint
   - Drag waypoints to adjust the path
   - Right-click waypoints to remove them

3. **Waypoints persist** - your custom routing is saved and will be restored when you reload

### For Developers

#### Accessing Waypoints in Code

```typescript
import { useMetadataStore } from '../stores/metadata-store';

const getConnectionMetadata = useMetadataStore((state) => state.getConnectionMetadata);
const metadata = getConnectionMetadata(connectionId);
const waypoints = metadata?.waypoints || [];
```

#### Programmatically Setting Waypoints

```typescript
import { useMetadataStore } from '../stores/metadata-store';

const updateConnectionWaypoints = useMetadataStore((state) => state.updateConnectionWaypoints);

// Set waypoints for a connection
updateConnectionWaypoints(connectionId, [
  { x: 100, y: 200 },
  { x: 300, y: 200 },
  { x: 300, y: 400 },
]);
```

## Path Computation Algorithm

The orthogonal path is computed as follows:

1. **Without waypoints**: Simple 3-segment path
   - Horizontal from source to midpoint
   - Vertical from midpoint height to target height
   - Horizontal to target

2. **With waypoints**: Multi-segment path
   - Route from source to first waypoint (alternating H-V or V-H)
   - Route through each waypoint in sequence
   - Route from last waypoint to target

The algorithm alternates between horizontal-first and vertical-first routing to create more natural-looking paths.

## Future Enhancements

Potential improvements:
- Auto-routing algorithm to suggest optimal waypoint positions
- Collision avoidance with nodes
- Snap-to-grid for waypoints
- Undo/redo support for waypoint operations
- Visual preview while dragging waypoints
- Keyboard shortcuts for waypoint manipulation

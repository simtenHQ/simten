# Edge Waypoints User Guide

## What are Waypoints?

Waypoints are control points that allow you to customize how wires (edges) are routed between components in the visual editor. Instead of having a simple automatic path, you can add waypoints to bend the wire around obstacles or create cleaner layouts.

## Visual Changes

All edges in the visual editor now use **orthogonal routing** (Manhattan routing):
- Wires only travel horizontally or vertically
- No diagonal or curved segments
- Clean, circuit-diagram-like appearance

## How to Use Waypoints

### Adding a Waypoint

**Double-click** anywhere on an edge (wire) to add a waypoint at that position.

The edge will now route through that waypoint.

### Moving a Waypoint

**Click and drag** the circular waypoint handle to move it to a new position.

The edge path will update in real-time as you drag.

### Deleting a Waypoint

**Right-click** on a waypoint handle to remove it.

The edge will recalculate its path without that waypoint.

## Visual Indicators

- **Waypoint Handles**: Small circles that match the color of the edge
- **Hover Effect**: Handles grow larger when you hover over them
- **Cursor Changes**:
  - Crosshair when hovering over an edge (indicates you can add a waypoint)
  - Grab cursor when hovering over a waypoint handle
  - Grabbing cursor when dragging a waypoint

## Tips for Better Layouts

1. **Use waypoints sparingly**: Start with the automatic routing and only add waypoints where needed

2. **Create clean paths**: Use waypoints to route around nodes rather than through them

3. **Align waypoints**: Try to keep waypoints aligned horizontally or vertically for cleaner appearance

4. **Minimize bends**: Fewer waypoints usually means cleaner, more readable diagrams

## Persistence

Your waypoint positions are automatically saved and will be restored when you reload the page.

## Examples

### Before (Automatic Routing)
```
[Node A] ─────┐
              │
              └─→ [Node B]
```

### After (With Waypoint)
```
[Node A] ────→ ● ─────┐
               ↑       │
               └───────┘
                       ↓
                   [Node B]
```

(The ● represents a waypoint you can drag)

## Keyboard Shortcuts

Currently, waypoint operations are mouse-only:
- Double-click to add
- Drag to move
- Right-click to delete

## Troubleshooting

**Problem**: Waypoint won't move
- **Solution**: Make sure you're clicking directly on the waypoint handle (the small circle)

**Problem**: Can't add waypoint
- **Solution**: Make sure you're double-clicking on the edge itself, not on empty space

**Problem**: Edge looks jagged
- **Solution**: Remove unnecessary waypoints by right-clicking on them

**Problem**: Lost my waypoints after reload
- **Solution**: This shouldn't happen - waypoints are persisted. Check browser console for errors.

## Technical Notes

- Waypoints are stored in flow coordinates
- Each edge can have unlimited waypoints
- Waypoints are stored in the metadata layer, separate from the logical circuit definition
- The routing algorithm alternates between horizontal-first and vertical-first patterns for more natural appearance

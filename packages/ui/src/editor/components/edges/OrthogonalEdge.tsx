/**
 * OrthogonalEdge Component
 *
 * Custom edge component that renders orthogonal (step/Manhattan) routing with
 * draggable waypoints and draggable segments. Waypoints are stored in the metadata
 * store for persistence.
 *
 * Interaction modes:
 * - Click edge: Select edge (shows blue highlight)
 * - Alt+Click edge: Add waypoint at click position
 * - Drag segment: Move segment perpendicular to its orientation
 * - Drag waypoint: Move waypoint freely
 * - Right-click waypoint: Delete waypoint
 * - Delete key (waypoint selected): Delete waypoint
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
} from '@xyflow/react';
import { useMetadataStore } from '../../stores';
import type { Position } from '../../types';

interface OrthogonalEdgeData extends Record<string, unknown> {
  waypoints?: Position[];
}

// Grid snapping configuration (in pixels)
const GRID_SIZE = 10;

/**
 * Snaps a coordinate to the nearest grid point
 */
function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snaps a position to the nearest grid point
 */
function snapPositionToGrid(position: Position, gridSize: number = GRID_SIZE): Position {
  return {
    x: snapToGrid(position.x, gridSize),
    y: snapToGrid(position.y, gridSize),
  };
}

/**
 * Represents a segment of the orthogonal path
 */
interface PathSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  orientation: 'horizontal' | 'vertical';
  // Index information for waypoint manipulation
  beforeWaypointIndex: number; // -1 if before first waypoint
  afterWaypointIndex: number; // waypoints.length if after last waypoint
}

/**
 * Computes an orthogonal path through waypoints
 * Waypoints are treated as exact bend/corner points
 */
function computeOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Position[] = []
): string {
  const pathSegments: string[] = [];

  // Start at source
  pathSegments.push(`M ${sourceX} ${sourceY}`);

  if (waypoints.length === 0) {
    // Simple orthogonal path without waypoints - horizontal then vertical
    const midX = (sourceX + targetX) / 2;
    pathSegments.push(`L ${midX} ${sourceY}`);
    pathSegments.push(`L ${midX} ${targetY}`);
    pathSegments.push(`L ${targetX} ${targetY}`);
  } else {
    // Draw straight lines to each waypoint in order
    // Waypoints are exact bend points the user controls
    let currentX = sourceX;
    let currentY = sourceY;

    waypoints.forEach((waypoint) => {
      // Draw orthogonal path to this waypoint
      // First horizontal, then vertical
      if (currentX !== waypoint.x) {
        pathSegments.push(`L ${waypoint.x} ${currentY}`);
        currentX = waypoint.x;
      }
      if (currentY !== waypoint.y) {
        pathSegments.push(`L ${currentX} ${waypoint.y}`);
        currentY = waypoint.y;
      }
    });

    // Draw orthogonal path from last waypoint to target
    if (currentX !== targetX) {
      pathSegments.push(`L ${targetX} ${currentY}`);
    }
    if (currentY !== targetY) {
      pathSegments.push(`L ${targetX} ${targetY}`);
    }
  }

  return pathSegments.join(' ');
}

/**
 * Parses the orthogonal path into individual segments for interaction
 */
function parsePathSegments(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Position[] = []
): PathSegment[] {
  const segments: PathSegment[] = [];

  if (waypoints.length === 0) {
    // Simple orthogonal path without waypoints
    const midX = (sourceX + targetX) / 2;

    segments.push({
      startX: sourceX,
      startY: sourceY,
      endX: midX,
      endY: sourceY,
      orientation: 'horizontal',
      beforeWaypointIndex: -1,
      afterWaypointIndex: 0,
    });

    segments.push({
      startX: midX,
      startY: sourceY,
      endX: midX,
      endY: targetY,
      orientation: 'vertical',
      beforeWaypointIndex: -1,
      afterWaypointIndex: 0,
    });

    segments.push({
      startX: midX,
      startY: targetY,
      endX: targetX,
      endY: targetY,
      orientation: 'horizontal',
      beforeWaypointIndex: -1,
      afterWaypointIndex: 0,
    });
  } else {
    // Path with waypoints
    let currentX = sourceX;
    let currentY = sourceY;
    let waypointIndex = -1;

    waypoints.forEach((waypoint, wpIdx) => {
      // Horizontal segment to waypoint
      if (currentX !== waypoint.x) {
        segments.push({
          startX: currentX,
          startY: currentY,
          endX: waypoint.x,
          endY: currentY,
          orientation: 'horizontal',
          beforeWaypointIndex: waypointIndex,
          afterWaypointIndex: wpIdx,
        });
        currentX = waypoint.x;
      }

      // Vertical segment to waypoint
      if (currentY !== waypoint.y) {
        segments.push({
          startX: currentX,
          startY: currentY,
          endX: currentX,
          endY: waypoint.y,
          orientation: 'vertical',
          beforeWaypointIndex: waypointIndex,
          afterWaypointIndex: wpIdx,
        });
        currentY = waypoint.y;
      }

      waypointIndex = wpIdx;
    });

    // Path from last waypoint to target
    if (currentX !== targetX) {
      segments.push({
        startX: currentX,
        startY: currentY,
        endX: targetX,
        endY: currentY,
        orientation: 'horizontal',
        beforeWaypointIndex: waypointIndex,
        afterWaypointIndex: waypoints.length,
      });
      currentX = targetX;
    }

    if (currentY !== targetY) {
      segments.push({
        startX: currentX,
        startY: currentY,
        endX: currentX,
        endY: targetY,
        orientation: 'vertical',
        beforeWaypointIndex: waypointIndex,
        afterWaypointIndex: waypoints.length,
      });
    }
  }

  return segments;
}

/**
 * OrthogonalEdge Component
 * Renders an orthogonal edge with draggable waypoint handles and draggable segments
 */
export function OrthogonalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const updateConnectionMetadata = useMetadataStore((state) => state.setConnectionMetadata);
  const getConnectionMetadata = useMetadataStore((state) => state.getConnectionMetadata);

  // Track which segment is being hovered and which waypoint is selected
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);

  // Ensure id is a string and style is properly typed
  const edgeId = String(id);
  const baseStyle = (style as React.CSSProperties | undefined) || {};

  // Apply selection styling
  const edgeStyle = selected
    ? {
        ...baseStyle,
        stroke: '#3b82f6', // Blue color when selected
        strokeWidth: 3, // Thicker when selected
      }
    : baseStyle;

  // Get waypoints from metadata
  const waypoints = useMemo(() => {
    const metadata = getConnectionMetadata(edgeId);
    return metadata?.waypoints || (data as OrthogonalEdgeData)?.waypoints || [];
  }, [edgeId, data, getConnectionMetadata]);

  // Compute the SVG path
  const edgePath = useMemo(
    () => computeOrthogonalPath(sourceX, sourceY, targetX, targetY, waypoints),
    [sourceX, sourceY, targetX, targetY, waypoints]
  );

  // Parse path into segments for interaction
  const pathSegments = useMemo(
    () => parsePathSegments(sourceX, sourceY, targetX, targetY, waypoints),
    [sourceX, sourceY, targetX, targetY, waypoints]
  );

  // Handle waypoint drag - using flow coordinates
  const handleWaypointDrag = useCallback(
    (waypointIndex: number, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startWaypoint = waypoints[waypointIndex];

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();

        // Calculate delta in screen space
        const deltaX = moveEvent.clientX - startClientX;
        const deltaY = moveEvent.clientY - startClientY;

        // Apply delta to waypoint position (waypoints are in flow coordinates)
        const rawPosition = {
          x: startWaypoint.x + deltaX,
          y: startWaypoint.y + deltaY,
        };

        // Snap to grid
        const snappedPosition = snapPositionToGrid(rawPosition);

        const newWaypoints = [...waypoints];
        newWaypoints[waypointIndex] = snappedPosition;

        // Update metadata store
        const metadata = getConnectionMetadata(edgeId);
        updateConnectionMetadata(edgeId, {
          ...metadata,
          id: edgeId,
          waypoints: newWaypoints,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
      };

      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [waypoints, edgeId, updateConnectionMetadata, getConnectionMetadata]
  );

  // Handle single click on edge to add waypoint (only when Alt key is held)
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent<SVGLineElement>) => {
      // Only add waypoint if Alt/Option key is held, otherwise allow normal selection
      if (!event.altKey) {
        return; // Let React Flow handle the click for selection
      }

      event.stopPropagation();
      event.preventDefault();

      // Get the SVG element and calculate position
      const svg = event.currentTarget.ownerSVGElement;
      if (!svg) return;

      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;

      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const transformedPoint = point.matrixTransform(ctm.inverse());

      // Create new waypoint at click position (snapped to grid)
      const rawWaypoint: Position = {
        x: transformedPoint.x,
        y: transformedPoint.y,
      };
      const newWaypoint = snapPositionToGrid(rawWaypoint);

      const newWaypoints = [...waypoints, newWaypoint];

      // Update metadata store
      const metadata = getConnectionMetadata(edgeId);
      updateConnectionMetadata(edgeId, {
        ...metadata,
        id: edgeId,
        waypoints: newWaypoints,
      });

      // Select the newly created waypoint
      setSelectedWaypointIndex(newWaypoints.length - 1);
    },
    [waypoints, edgeId, updateConnectionMetadata, getConnectionMetadata]
  );

  // Handle segment drag - creates/updates waypoints to move the segment
  const handleSegmentDrag = useCallback(
    (segmentIndex: number, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const segment = pathSegments[segmentIndex];
      const startClientX = event.clientX;
      const startClientY = event.clientY;

      // Determine which axis this segment can move along
      const isHorizontal = segment.orientation === 'horizontal';
      const fixedCoord = isHorizontal ? segment.startY : segment.startX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();

        // Calculate delta in screen space
        const deltaX = moveEvent.clientX - startClientX;
        const deltaY = moveEvent.clientY - startClientY;

        // Apply constraint based on segment orientation
        const delta = isHorizontal ? deltaY : deltaX;
        const rawNewCoord = fixedCoord + delta;
        // Snap coordinate to grid
        const newCoord = snapToGrid(rawNewCoord);

        // Create new waypoints array
        let newWaypoints = [...waypoints];

        // Strategy: Update or create waypoints at the segment boundaries
        const { beforeWaypointIndex, afterWaypointIndex } = segment;

        if (beforeWaypointIndex === -1 && afterWaypointIndex === waypoints.length) {
          // Segment connects source to target directly (no waypoints)
          // Create two new waypoints at the segment boundaries
          if (isHorizontal) {
            // Horizontal segment: create waypoints at start and end
            newWaypoints = [
              snapPositionToGrid({ x: segment.startX, y: newCoord }),
              snapPositionToGrid({ x: segment.endX, y: newCoord }),
            ];
          } else {
            // Vertical segment: create waypoints at start and end
            newWaypoints = [
              snapPositionToGrid({ x: newCoord, y: segment.startY }),
              snapPositionToGrid({ x: newCoord, y: segment.endY }),
            ];
          }
        } else if (beforeWaypointIndex === -1) {
          // Segment is before the first waypoint
          // Update the first waypoint or insert a new one
          const firstWaypoint = newWaypoints[0];
          if (isHorizontal) {
            newWaypoints[0] = snapPositionToGrid({ ...firstWaypoint, y: newCoord });
            // Insert a waypoint at the start if needed
            if (segment.startX !== sourceX) {
              newWaypoints.unshift(snapPositionToGrid({ x: segment.startX, y: newCoord }));
            }
          } else {
            newWaypoints[0] = snapPositionToGrid({ ...firstWaypoint, x: newCoord });
            if (segment.startY !== sourceY) {
              newWaypoints.unshift(snapPositionToGrid({ x: newCoord, y: segment.startY }));
            }
          }
        } else if (afterWaypointIndex === waypoints.length) {
          // Segment is after the last waypoint
          const lastWaypoint = newWaypoints[newWaypoints.length - 1];
          if (isHorizontal) {
            newWaypoints[newWaypoints.length - 1] = snapPositionToGrid({ ...lastWaypoint, y: newCoord });
            // Add a waypoint at the end if needed
            if (segment.endX !== targetX) {
              newWaypoints.push(snapPositionToGrid({ x: segment.endX, y: newCoord }));
            }
          } else {
            newWaypoints[newWaypoints.length - 1] = snapPositionToGrid({ ...lastWaypoint, x: newCoord });
            if (segment.endY !== targetY) {
              newWaypoints.push(snapPositionToGrid({ x: newCoord, y: segment.endY }));
            }
          }
        } else {
          // Segment is between two waypoints
          // Update the adjacent waypoints
          if (isHorizontal) {
            if (beforeWaypointIndex >= 0) {
              newWaypoints[beforeWaypointIndex] = snapPositionToGrid({
                ...newWaypoints[beforeWaypointIndex],
                y: newCoord
              });
            }
            if (afterWaypointIndex < newWaypoints.length) {
              newWaypoints[afterWaypointIndex] = snapPositionToGrid({
                ...newWaypoints[afterWaypointIndex],
                y: newCoord
              });
            }
          } else {
            if (beforeWaypointIndex >= 0) {
              newWaypoints[beforeWaypointIndex] = snapPositionToGrid({
                ...newWaypoints[beforeWaypointIndex],
                x: newCoord
              });
            }
            if (afterWaypointIndex < newWaypoints.length) {
              newWaypoints[afterWaypointIndex] = snapPositionToGrid({
                ...newWaypoints[afterWaypointIndex],
                x: newCoord
              });
            }
          }
        }

        // Update metadata store
        const metadata = getConnectionMetadata(edgeId);
        updateConnectionMetadata(edgeId, {
          ...metadata,
          id: edgeId,
          waypoints: newWaypoints,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        setHoveredSegmentIndex(null);
      };

      document.body.style.cursor = isHorizontal ? 'ns-resize' : 'ew-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [pathSegments, waypoints, edgeId, updateConnectionMetadata, getConnectionMetadata, sourceX, sourceY, targetX, targetY]
  );

  // Handle waypoint click to select
  const handleWaypointClick = useCallback(
    (waypointIndex: number, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setSelectedWaypointIndex(waypointIndex);
    },
    []
  );

  // Handle waypoint deletion (right-click or delete key)
  const handleWaypointDelete = useCallback(
    (waypointIndex: number) => {
      const newWaypoints = waypoints.filter((_wp: Position, index: number) => index !== waypointIndex);

      // Update metadata store
      const metadata = getConnectionMetadata(edgeId);
      updateConnectionMetadata(edgeId, {
        ...metadata,
        id: edgeId,
        waypoints: newWaypoints,
      });

      // Clear selection
      setSelectedWaypointIndex(null);
    },
    [waypoints, edgeId, updateConnectionMetadata, getConnectionMetadata]
  );

  // Handle waypoint right-click
  const handleWaypointContextMenu = useCallback(
    (waypointIndex: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleWaypointDelete(waypointIndex);
    },
    [handleWaypointDelete]
  );

  // Handle delete key to remove selected waypoint
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedWaypointIndex !== null) {
        handleWaypointDelete(selectedWaypointIndex);
      }
    },
    [selectedWaypointIndex, handleWaypointDelete]
  );

  // Set up keyboard listener
  React.useEffect(() => {
    if (selectedWaypointIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedWaypointIndex, handleKeyDown]);

  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
      />

      {/* Draggable segment overlays with visual feedback */}
      {pathSegments.map((segment, segmentIndex) => {
        const isHovered = hoveredSegmentIndex === segmentIndex;
        const isHorizontal = segment.orientation === 'horizontal';

        return (
          <g key={`segment-${segmentIndex}`}>
            {/* Visual feedback when hovering - highlight the segment */}
            {isHovered && (
              <line
                x1={segment.startX}
                y1={segment.startY}
                x2={segment.endX}
                y2={segment.endY}
                stroke={edgeStyle.stroke || '#3b82f6'}
                strokeWidth={4}
                opacity={0.6}
                pointerEvents="none"
                style={{
                  transition: 'all 0.1s ease-out',
                }}
              />
            )}

            {/* Invisible hit area for interaction */}
            <line
              x1={segment.startX}
              y1={segment.startY}
              x2={segment.endX}
              y2={segment.endY}
              stroke="transparent"
              strokeWidth={16}
              onMouseEnter={() => setHoveredSegmentIndex(segmentIndex)}
              onMouseLeave={() => setHoveredSegmentIndex(null)}
              onMouseDown={(e) => {
                // Check if it's a drag or a click by tracking mouse movement
                const startX = e.clientX;
                const startY = e.clientY;
                let hasMoved = false;

                const handleMove = (moveEvent: MouseEvent) => {
                  const deltaX = Math.abs(moveEvent.clientX - startX);
                  const deltaY = Math.abs(moveEvent.clientY - startY);
                  if (deltaX > 3 || deltaY > 3) {
                    hasMoved = true;
                    document.removeEventListener('mousemove', handleMove);
                    handleSegmentDrag(segmentIndex, e);
                  }
                };

                const handleUp = () => {
                  document.removeEventListener('mousemove', handleMove);
                  document.removeEventListener('mouseup', handleUp);
                  if (!hasMoved) {
                    // It was a click, not a drag
                    handleEdgeClick(e);
                  }
                };

                document.addEventListener('mousemove', handleMove);
                document.addEventListener('mouseup', handleUp);
              }}
              style={{
                cursor: isHovered
                  ? (isHorizontal ? 'ns-resize' : 'ew-resize')
                  : 'pointer', // Changed from 'crosshair' to 'pointer' for selection
              }}
            />
          </g>
        );
      })}

      {/* Waypoint handles - only show selected waypoint */}
      {selectedWaypointIndex !== null && waypoints[selectedWaypointIndex] && (
        <EdgeLabelRenderer>
          <div
            key={`waypoint-${edgeId}-${selectedWaypointIndex}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${waypoints[selectedWaypointIndex].x}px, ${waypoints[selectedWaypointIndex].y}px)`,
              pointerEvents: 'all',
            }}
            className="waypoint-handle"
          >
            <div
              onMouseDown={(e) => handleWaypointDrag(selectedWaypointIndex, e)}
              onClick={(e) => handleWaypointClick(selectedWaypointIndex, e)}
              onContextMenu={(e) => handleWaypointContextMenu(selectedWaypointIndex, e)}
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#ffffff',
                border: `2px solid ${edgeStyle.stroke || '#3b82f6'}`,
                borderRadius: '50%',
                cursor: 'grab',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.3)';
                e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
              }}
              title="Drag to move, right-click or Delete to remove"
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

# Hierarchical Navigation Implementation Guide

## Executive Summary

This document provides the implementation roadmap for hierarchical component navigation in the Turing Incomplete visual editor. Based on industry analysis (Logisim, Digital, Quartus), we recommend a **two-phase approach**:

1. **MVP (Phase 1)**: Subcircuit navigation (Logisim-style)
2. **Enhancement (Phase 2)**: Optional in-place expansion

**Core Principle**: The DSL represents WHAT exists (structural/behavioral truth), while expansion/visualization state is ephemeral UI state.

---

## Current Architecture Analysis

### What We Have Now

Based on the codebase analysis:

```typescript
// Current IR Store (ir-store.ts)
interface IRState {
  components: Record<string, Component>;  // Component instances
  connections: Record<string, Connection>; // Wiring
}

// Current Metadata Store (metadata-store.ts, inferred)
interface MetadataState {
  components: Record<string, ComponentMetadata>;  // Visual metadata
  connections: Record<string, ConnectionMetadata>; // Wire routing
}

interface ComponentMetadata {
  id: string;
  position: {x: number, y: number};  // Canvas position
  selected?: boolean;  // Selection state
  // NO expansion state yet!
}

// Current Component Library Store
interface ComponentLibrary {
  primitives: Map<string, Circuit>;   // Built-in components
  standard: Map<string, Circuit>;     // Standard library
  user: Map<string, Circuit>;         // User-defined components
}
```

**Key Observation**: The architecture already separates structural truth (IR) from visual metadata. We need to extend this pattern for hierarchical navigation.

---

## Phase 1: Subcircuit Navigation (MVP)

### Goal
Enable users to "enter" a component instance to view/edit its internals, similar to Logisim.

### User Experience

```
Initial State: Main Canvas
┌───────────────────────────────────┐
│ [< Main]                          │  <- Breadcrumb navigation
│                                   │
│  ┌──────────┐                     │
│  │   CPU    │                     │  <- Component instance
│  │  (black  │                     │     (shows as box with ports)
│  │   box)   │                     │
│  └──────────┘                     │
│                                   │
│  [Double-click CPU to view inside]│
└───────────────────────────────────┘

After Double-Click: CPU Canvas
┌───────────────────────────────────┐
│ [< Main] > [CPU]                  │  <- Breadcrumb shows hierarchy
│                                   │
│  ┌─────┐    ┌──────────┐         │
│  │ ALU │───>│ Register │         │  <- CPU's internal components
│  └─────┘    │   File   │         │
│             └──────────┘         │
│                                   │
│  [This is the CPU's definition]   │
└───────────────────────────────────┘
```

### Data Model Changes

#### 1. Add Canvas Navigation State

```typescript
// New: Editor State (editor-store.ts or metadata-store.ts)
interface EditorState {
  // Navigation
  currentCanvasId: string;  // Which component definition we're viewing
  // "Main" is the top-level canvas, otherwise component name

  breadcrumb: string[];  // Navigation stack ["Main", "CPU", "ALU"]

  // Canvas states (one per component definition)
  canvasStates: Map<string, CanvasState>;
}

interface CanvasState {
  componentId: string;  // Which component this canvas represents

  // Per-instance metadata (same as current system)
  nodePositions: Map<string, {x: number, y: number}>;
  nodeSelections: Map<string, boolean>;

  // Viewport state
  viewport: {
    zoom: number;
    pan: {x: number, y: number};
  };
}
```

#### 2. Extend Component Library with Internal Structure

```typescript
// Already exists: Circuit type from ir-v0.1.ts
interface Circuit {
  name: string;

  // Inputs/outputs (interface ports)
  inputs: Array<{ name: string; width: number }>;
  outputs: Array<{ name: string; width: number }>;

  // Internal structure (what we see when we "enter" the component)
  internals?: {
    nodes: Array<{
      id: string;
      type: string;  // References another component
      // Position is NOT here (it's in CanvasState)
    }>;

    wires: Array<{
      from: { nodeId: string; portIndex: number };
      to: { nodeId: string; portIndex: number };
    }>;
  };
}
```

**Key Insight**: The `Circuit` definition already supports hierarchical structure via `internals`. We just need to:
1. Render the correct canvas based on `currentCanvasId`
2. Handle double-click to navigate into components
3. Maintain breadcrumb navigation

---

### Implementation Steps

#### Step 1: Create Editor Navigation Store

Create `/src/features/visual-editor/stores/editor-navigation-store.ts`:

```typescript
/**
 * Editor Navigation Store
 *
 * Manages hierarchical navigation state (which canvas is visible).
 * Keeps DSL/IR unchanged while providing multi-level editing.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface CanvasViewport {
  zoom: number;
  pan: {x: number, y: number};
}

interface EditorNavigationState {
  // Current canvas being viewed
  currentCanvasId: string;  // "Main" or component name

  // Navigation stack (for breadcrumb)
  breadcrumb: string[];

  // Viewport state per canvas (preserved when switching)
  canvasViewports: Map<string, CanvasViewport>;
}

interface EditorNavigationActions {
  // Navigate to a component definition canvas
  navigateToComponent: (componentName: string) => void;

  // Navigate back to previous canvas
  navigateBack: () => void;

  // Navigate to specific breadcrumb level
  navigateToBreadcrumb: (index: number) => void;

  // Reset to main canvas
  navigateToMain: () => void;

  // Update viewport for current canvas
  updateViewport: (viewport: Partial<CanvasViewport>) => void;

  // Get viewport for specific canvas
  getViewport: (canvasId: string) => CanvasViewport;
}

export interface EditorNavigationStore extends EditorNavigationState, EditorNavigationActions {}

const DEFAULT_VIEWPORT: CanvasViewport = {
  zoom: 1,
  pan: {x: 0, y: 0},
};

const initialState: EditorNavigationState = {
  currentCanvasId: 'Main',
  breadcrumb: ['Main'],
  canvasViewports: new Map([['Main', DEFAULT_VIEWPORT]]),
};

export const useEditorNavigationStore = create<EditorNavigationStore>()(
  immer((set, get) => ({
    ...initialState,

    navigateToComponent: (componentName) => {
      set((state) => {
        // Add to breadcrumb if not already there
        if (state.currentCanvasId !== componentName) {
          state.breadcrumb.push(componentName);
          state.currentCanvasId = componentName;

          // Initialize viewport for new canvas if needed
          if (!state.canvasViewports.has(componentName)) {
            state.canvasViewports.set(componentName, {...DEFAULT_VIEWPORT});
          }
        }
      });
    },

    navigateBack: () => {
      set((state) => {
        if (state.breadcrumb.length > 1) {
          state.breadcrumb.pop();
          state.currentCanvasId = state.breadcrumb[state.breadcrumb.length - 1];
        }
      });
    },

    navigateToBreadcrumb: (index) => {
      set((state) => {
        if (index >= 0 && index < state.breadcrumb.length) {
          state.breadcrumb = state.breadcrumb.slice(0, index + 1);
          state.currentCanvasId = state.breadcrumb[index];
        }
      });
    },

    navigateToMain: () => {
      set((state) => {
        state.currentCanvasId = 'Main';
        state.breadcrumb = ['Main'];
      });
    },

    updateViewport: (viewport) => {
      set((state) => {
        const currentViewport = state.canvasViewports.get(state.currentCanvasId);
        if (currentViewport) {
          Object.assign(currentViewport, viewport);
        } else {
          state.canvasViewports.set(state.currentCanvasId, {
            ...DEFAULT_VIEWPORT,
            ...viewport,
          });
        }
      });
    },

    getViewport: (canvasId) => {
      return get().canvasViewports.get(canvasId) || {...DEFAULT_VIEWPORT};
    },
  }))
);
```

---

#### Step 2: Add Breadcrumb Navigation Component

Create `/src/features/visual-editor/components/BreadcrumbNavigation.tsx`:

```typescript
/**
 * Breadcrumb Navigation Component
 *
 * Shows current location in component hierarchy and allows navigation.
 */

import React from 'react';
import { useEditorNavigationStore } from '../stores/editor-navigation-store';

export function BreadcrumbNavigation() {
  const breadcrumb = useEditorNavigationStore((state) => state.breadcrumb);
  const navigateToBreadcrumb = useEditorNavigationStore((state) => state.navigateToBreadcrumb);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
      {breadcrumb.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-400">/</span>
          )}
          <button
            onClick={() => navigateToBreadcrumb(index)}
            className={`
              px-2 py-1 rounded text-sm font-medium transition-colors
              ${index === breadcrumb.length - 1
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            {item}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
```

---

#### Step 3: Modify Canvas to Support Hierarchy

Update `Canvas.tsx` to render the correct component definition based on navigation state:

```typescript
// Canvas.tsx modifications

export function Canvas() {
  // ... existing code ...

  // NEW: Get current canvas ID from navigation store
  const currentCanvasId = useEditorNavigationStore((state) => state.currentCanvasId);
  const navigateToComponent = useEditorNavigationStore((state) => state.navigateToComponent);

  // NEW: Get the component definition we're currently viewing
  const resolveComponent = useComponentLibraryStore((state) => state.resolveComponent);
  const currentComponentDef = currentCanvasId === 'Main'
    ? null
    : resolveComponent(currentCanvasId);

  // NEW: Filter IR to show only nodes/connections for current canvas
  const visibleIR = useMemo(() => {
    if (currentCanvasId === 'Main') {
      // Show top-level IR (what user has placed on main canvas)
      return { components: irComponents, connections: irConnections };
    } else {
      // Show internals of the component definition
      if (!currentComponentDef?.internals) {
        return { components: {}, connections: {} };
      }

      // Convert component definition's internals to IR format
      const components: Record<string, Component> = {};
      const connections: Record<string, Connection> = {};

      currentComponentDef.internals.nodes.forEach((node) => {
        // Create component instances from definition nodes
        components[node.id] = {
          id: node.id,
          type: node.type,
          // ... other fields
        };
      });

      currentComponentDef.internals.wires.forEach((wire, idx) => {
        connections[`wire-${idx}`] = {
          id: `wire-${idx}`,
          sourceComponentId: wire.from.nodeId,
          sourcePortIndex: wire.from.portIndex,
          targetComponentId: wire.to.nodeId,
          targetPortIndex: wire.to.portIndex,
        };
      });

      return { components, connections };
    }
  }, [currentCanvasId, currentComponentDef, irComponents, irConnections]);

  // NEW: Handle double-click on component to navigate into it
  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const component = irComponents[node.id];
      if (!component) return;

      // Check if this component has a definition with internals
      const componentDef = resolveComponent(component.type);
      if (componentDef?.internals) {
        // Navigate to this component's canvas
        navigateToComponent(component.type);
      }
    },
    [irComponents, resolveComponent, navigateToComponent]
  );

  // ... rest of Canvas implementation ...

  return (
    <div className="relative h-full w-full flex flex-col" onDrop={onDrop} onDragOver={onDragOver}>
      {/* NEW: Breadcrumb navigation */}
      <BreadcrumbNavigation />

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}  // NEW!
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          // ... rest of props ...
        >
          {/* ... Background, Controls, etc. ... */}
        </ReactFlow>
      </div>

      {/* ... Selection info, keyboard shortcuts ... */}
    </div>
  );
}
```

---

#### Step 4: Update Component Palette for Context

Update the component palette to show different components based on current canvas:

```typescript
// ComponentPalette.tsx modifications

export function ComponentPalette() {
  const currentCanvasId = useEditorNavigationStore((state) => state.currentCanvasId);

  // Show different components based on context
  const availableComponents = useMemo(() => {
    if (currentCanvasId === 'Main') {
      // Main canvas: show all top-level components (primitives + user components)
      return [...getAllPrimitiveNames(), ...getAllUserNames()];
    } else {
      // Inside a component: show primitives + other components (for building internals)
      return [...getAllPrimitiveNames(), ...getAllStandardNames(), ...getAllUserNames()];
    }
  }, [currentCanvasId]);

  // ... rest of palette implementation ...
}
```

---

### Phase 1 Summary

**What Users Can Do**:
- View main canvas with component instances as black boxes
- Double-click a component to view its internals
- Navigate back using breadcrumb
- Edit internals of components in isolation
- Components remain as black boxes by default

**What's NOT Implemented Yet**:
- In-place expansion (Phase 2)
- Visual grouping of expanded components
- Simultaneous multi-level view

**Data Flow**:
```
User double-clicks CPU component
  ↓
Canvas calls onNodeDoubleClick(event, cpuNode)
  ↓
Check if CPU has internals (componentDef.internals exists)
  ↓
Call navigateToComponent("CPU")
  ↓
EditorNavigationStore updates currentCanvasId to "CPU"
  ↓
Canvas re-renders with CPU's internal nodes/wires
  ↓
User sees ALU, RegisterFile, ControlUnit on canvas
```

---

## Phase 2: In-Place Expansion (Enhancement)

### Goal
Allow users to expand a component instance **on the current canvas** to see its internals without navigating away.

### User Experience

```
Before Expansion:
┌───────────────────────────────────┐
│ [< Main]                          │
│                                   │
│  ┌──────────┐                     │
│  │   CPU    │                     │  <- Right-click for menu
│  │          │                     │     "Expand In Place"
│  └──────────┘                     │
│                                   │
└───────────────────────────────────┘

After Expansion:
┌───────────────────────────────────┐
│ [< Main]                          │
│                                   │
│  ┌─ CPU ───────────────────────┐ │
│  │ ┌─────┐    ┌──────────┐    │ │  <- Expanded view shows
│  │ │ ALU │───>│ Register │    │ │     internals with border
│  │ └─────┘    │   File   │    │ │
│  │            └──────────┘    │ │
│  └────────────────────────────┘ │
│                                   │
│  [Right-click to collapse]        │
└───────────────────────────────────┘
```

### Data Model Changes

```typescript
// Extend ComponentMetadata with expansion state
interface ComponentMetadata {
  id: string;
  position: {x: number, y: number};
  selected?: boolean;

  // Phase 2: Expansion state
  expanded?: boolean;
  expandedLayout?: {
    // Auto-generated or manual positions for internal nodes
    internalNodePositions: Map<string, {x: number, y: number}>;
    boundingBox: {width: number, height: number};
  };
}
```

### Implementation (Deferred to Phase 2)

This is NOT required for MVP. Key challenges:
1. **Layout management**: Where do expanded internals appear?
2. **Wire routing**: How do wires connect to expanded internals?
3. **Visual grouping**: How to show hierarchy boundaries?
4. **Interaction**: Click inside expanded area vs click component?

**Recommendation**: Implement Phase 1 first, gather user feedback, then tackle Phase 2.

---

## DSL Implications

### Critical Rule: DSL Never Contains Expansion State

**DSL Example (Correct)**:
```
component Main {
  node cpu: CPU
  node ram: RAM
  wire cpu.mem_addr -> ram.addr
}

component CPU {
  node alu: ALU
  node regfile: RegisterFile
  wire alu.out -> regfile.in
}
```

**This DSL is INVARIANT** to:
- Whether CPU is expanded or collapsed on Main canvas
- Whether user is viewing Main canvas or CPU canvas
- User's viewport zoom/pan settings

**DSL represents**:
- WHAT components exist
- HOW they're connected
- WHAT their types are

**DSL does NOT represent**:
- WHERE components appear on canvas (that's metadata)
- WHETHER components are expanded (that's UI state)
- HOW wires are routed (that's visual metadata)

---

### Metadata File (Optional Persistence)

If you want to save canvas layouts, create a **separate** metadata file:

```json
// project-name.canvas.json (OPTIONAL, not required for simulation)
{
  "version": "0.1.0",
  "canvases": {
    "Main": {
      "nodes": {
        "cpu-123": {"x": 100, "y": 200},
        "ram-456": {"x": 300, "y": 200}
      },
      "viewport": {"zoom": 1.0, "pan": {"x": 0, "y": 0}}
    },
    "CPU": {
      "nodes": {
        "alu-789": {"x": 50, "y": 100},
        "regfile-012": {"x": 250, "y": 100}
      },
      "viewport": {"zoom": 1.2, "pan": {"x": -50, "y": 0}}
    }
  }
}
```

**Key Points**:
- Canvas metadata is OPTIONAL (simulation doesn't need it)
- Canvas metadata is SEPARATE from DSL
- If missing, use auto-layout
- Expansion state is NOT saved (too ephemeral)

---

## Migration Path for Existing Code

### Current State
You already have:
- ✅ IR store with components and connections
- ✅ Metadata store with positions and selections
- ✅ Component library with primitives/standard/user components
- ✅ Canvas rendering with ReactFlow
- ✅ Simulation engine

### What Needs to Change

#### 1. Add Navigation Store
**NEW FILE**: `/src/features/visual-editor/stores/editor-navigation-store.ts`
- Manages `currentCanvasId` and `breadcrumb`
- Stores per-canvas viewport state

#### 2. Add Breadcrumb Component
**NEW FILE**: `/src/features/visual-editor/components/BreadcrumbNavigation.tsx`
- Renders breadcrumb navigation
- Handles click to navigate up hierarchy

#### 3. Modify Canvas Component
**MODIFY**: `/src/features/visual-editor/components/Canvas.tsx`
- Add `useEditorNavigationStore` hook
- Filter IR based on `currentCanvasId`
- Add `onNodeDoubleClick` handler
- Render `<BreadcrumbNavigation />` above ReactFlow

#### 4. Update IR Store (Optional)
**MODIFY**: `/src/features/visual-editor/stores/ir-store.ts`
- Add method to get internals of a component instance
- Helper to resolve component definition from type

#### 5. Ensure Circuit Definitions Have Internals
**VERIFY**: Component library has proper `Circuit.internals` structure
- For primitives: `internals` is undefined (they're atomic)
- For user components: `internals` contains nodes/wires

---

## Testing Strategy

### Unit Tests

```typescript
// editor-navigation-store.test.ts
describe('EditorNavigationStore', () => {
  it('should start at Main canvas', () => {
    const store = useEditorNavigationStore.getState();
    expect(store.currentCanvasId).toBe('Main');
    expect(store.breadcrumb).toEqual(['Main']);
  });

  it('should navigate to component', () => {
    const store = useEditorNavigationStore.getState();
    store.navigateToComponent('CPU');
    expect(store.currentCanvasId).toBe('CPU');
    expect(store.breadcrumb).toEqual(['Main', 'CPU']);
  });

  it('should navigate back', () => {
    const store = useEditorNavigationStore.getState();
    store.navigateToComponent('CPU');
    store.navigateBack();
    expect(store.currentCanvasId).toBe('Main');
    expect(store.breadcrumb).toEqual(['Main']);
  });

  it('should navigate to breadcrumb index', () => {
    const store = useEditorNavigationStore.getState();
    store.navigateToComponent('CPU');
    store.navigateToComponent('ALU');
    store.navigateToBreadcrumb(0);  // Back to Main
    expect(store.currentCanvasId).toBe('Main');
    expect(store.breadcrumb).toEqual(['Main']);
  });
});
```

### Integration Tests

```typescript
// Canvas.integration.test.tsx
describe('Canvas Hierarchical Navigation', () => {
  it('should render Main canvas by default', () => {
    render(<Canvas />);
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('should navigate into component on double-click', async () => {
    const user = userEvent.setup();
    render(<Canvas />);

    // Add a CPU component to main canvas
    const cpuNode = screen.getByText('CPU');

    // Double-click to navigate
    await user.dblClick(cpuNode);

    // Should now see CPU canvas
    expect(screen.getByText('Main / CPU')).toBeInTheDocument();
  });

  it('should navigate back using breadcrumb', async () => {
    const user = userEvent.setup();
    render(<Canvas />);

    // Navigate into CPU
    await user.dblClick(screen.getByText('CPU'));

    // Click "Main" in breadcrumb
    await user.click(screen.getByText('Main'));

    // Should be back at main canvas
    expect(screen.queryByText('Main / CPU')).not.toBeInTheDocument();
  });
});
```

---

## Performance Considerations

### Concern: Large Hierarchies

**Problem**: If CPU contains 1000s of gates, showing all at once might be slow.

**Solutions**:
1. **Lazy loading**: Only render current canvas (Phase 1 already does this)
2. **Virtualization**: Use react-window for large node lists (future optimization)
3. **LOD (Level of Detail)**: At high zoom-out, show simplified boxes instead of full details

### Concern: Deep Nesting

**Problem**: User navigates many levels deep (Main → CPU → ALU → Adder → FullAdder)

**Solutions**:
1. **Breadcrumb limit**: Show "... → Adder → FullAdder" if too deep
2. **Viewport preservation**: Save zoom/pan per canvas so returning feels natural
3. **Search/jump**: Add "Go To Component" feature to jump anywhere

---

## UI/UX Polishing

### Context Menu on Components

```typescript
// Add right-click menu to component nodes
const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  event.preventDefault();

  const component = irComponents[node.id];
  const componentDef = resolveComponent(component.type);

  showContextMenu({
    x: event.clientX,
    y: event.clientY,
    items: [
      {
        label: 'View Definition',
        onClick: () => navigateToComponent(component.type),
        disabled: !componentDef?.internals,
      },
      // Phase 2:
      // {
      //   label: 'Expand In Place',
      //   onClick: () => setComponentExpanded(node.id, true),
      //   disabled: !componentDef?.internals,
      // },
      {
        label: 'Delete',
        onClick: () => removeComponent(node.id),
      },
    ],
  });
}, [irComponents, resolveComponent, navigateToComponent, removeComponent]);
```

### Visual Indicators

1. **Component has internals**: Show small icon (e.g., folder icon) on component box
2. **Current breadcrumb level**: Highlight current level in breadcrumb
3. **Canvas label**: Show large "Editing: CPU" text on canvas when not at Main
4. **Back button**: Add large "← Back to Main" button for easy navigation

### Keyboard Shortcuts

- `Escape`: Navigate back to previous canvas
- `Cmd+Enter`: Navigate into selected component
- `Cmd+Up`: Navigate to parent canvas
- `Cmd+Home`: Jump to Main canvas

---

## Comparison with Industry Tools

| Tool | Navigation Style | Pros | Cons |
|------|------------------|------|------|
| **Logisim** | Separate subcircuit tabs | Clean, simple | Can't see multiple levels |
| **Digital** | New tab per component | Familiar tab model | Many tabs = clutter |
| **Quartus** | In-place expansion | Visual continuity | Complex layout management |
| **Turing Incomplete (Phase 1)** | Breadcrumb navigation | Clean + visual continuity | Can't expand in-place yet |
| **Turing Incomplete (Phase 2)** | Hybrid (navigate + expand) | Best of both worlds | More complex implementation |

---

## Recommendations

### For MVP (Implement Now)

1. **Implement Phase 1** (subcircuit navigation)
   - Add `EditorNavigationStore`
   - Add `BreadcrumbNavigation` component
   - Modify `Canvas` to filter IR by current canvas
   - Add double-click handler to navigate

2. **Visual polish**
   - Show icon on components with internals
   - Highlight current breadcrumb level
   - Add keyboard shortcuts (Escape to go back)

3. **Testing**
   - Unit tests for navigation store
   - Integration tests for canvas navigation
   - Manual testing with complex hierarchies

### For Future (Phase 2)

1. **In-place expansion** (after user feedback)
2. **Auto-layout** for expanded components
3. **Search/jump** to component by name
4. **Hierarchy tree panel** (like VS Code file explorer)

---

## FAQ

### Q: Why not just flatten everything?
**A**: Because users want different abstraction levels for different tasks. When debugging, they want to drill down. When building high-level systems, they want black boxes.

### Q: Why not show everything expanded by default?
**A**: Canvas clutter. A CPU with 1000s of gates would be unusable if all expanded.

### Q: Should expansion state be saved?
**A**: No (for MVP). It's too ephemeral and context-dependent. Phase 2 might add user preferences for default expansion levels.

### Q: How does simulation work with hierarchy?
**A**: Simulation ALWAYS flattens to primitives (IR flattening pass). Hierarchy is purely for authoring/visualization, not execution.

### Q: Can I edit a component while it's instantiated elsewhere?
**A**: Yes! Edits to a component definition affect ALL instances. This is a feature (DRY principle).

### Q: What if I have recursive components (A contains B, B contains A)?
**A**: DSL should detect this and error. Simulation cannot handle infinite recursion.

---

## Next Steps

1. **Review this document** with team/user
2. **Prototype Phase 1** in a branch
3. **User test** with simple hierarchy (Main → HalfAdder → And/Xor)
4. **Iterate** based on feedback
5. **Document DSL syntax** for hierarchical components
6. **Plan Phase 2** after MVP is stable


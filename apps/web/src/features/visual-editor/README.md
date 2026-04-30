# Visual Editor - Phase 1 Implementation

A ReactFlow-based visual circuit editor for building and simulating digital logic systems.

## Architecture

### Three-Store Pattern

The application uses three separate Zustand stores with Immer middleware:

1. **IR Store** (`ir-store.ts`) - Logic and circuit structure
   - Components (Switch, LED, AND gate)
   - Connections between components
   - Component state (values)
   - No visual information

2. **Metadata Store** (`metadata-store.ts`) - Visual layout
   - Component positions
   - Component dimensions
   - Connection styling
   - No logic information

3. **UI Store** (`ui-store.ts`) - Interaction state
   - Drag operations
   - Selection state
   - Simulation status
   - Canvas zoom/pan

### Projection Pattern

The `projectToReactFlow()` function bridges IR + Metadata to ReactFlow:

```
IR State + Metadata State → Projection → ReactFlow Nodes + Edges
```

This maintains strict separation of concerns:
- IR never knows about positions
- Metadata never knows about logic
- ReactFlow is just a view layer

## Phase 1 Components

### Input Components
- **Switch** - User-toggleable input that generates signals

### Output Components
- **LED** - Visual indicator that displays signal state

### Logic Components
- **AND Gate** - Two inputs, one output; output is true only if both inputs are true

## Features

### Component Palette
- Drag components onto canvas
- Click to add at default position
- Visual component cards with icons

### Canvas
- ReactFlow-based infinite canvas
- Drag to reposition components
- Connect ports by dragging between them
- Delete components/connections with Delete key
- Background grid and minimap
- Zoom and pan controls

### Simulation
- Click "Run" to propagate values through circuit
- Wire colors:
  - Green: true/high signal
  - Gray: false/low signal
- Real-time value updates
- LED lights up when receiving true signal

### Controls
- Run button - Execute simulation step
- Clear button - Remove all components
- Component/connection counter

## File Structure

```
src/features/visual-editor/
├── types/
│   ├── ir.ts              # IR type definitions
│   ├── visual.ts          # Visual metadata types
│   ├── ui.ts              # UI state types
│   └── index.ts           # Type exports
├── stores/
│   ├── ir-store.ts        # Logic state management
│   ├── metadata-store.ts  # Visual state management
│   ├── ui-store.ts        # Interaction state management
│   └── index.ts           # Store exports
├── utils/
│   ├── projection.ts      # IR + Metadata → ReactFlow
│   ├── simulator.ts       # Signal propagation engine
│   └── index.ts           # Utility exports
├── components/
│   ├── nodes/
│   │   ├── BaseNode.tsx   # Base component with ports
│   │   ├── InputNode.tsx  # Switch component
│   │   ├── OutputNode.tsx # LED component
│   │   ├── LogicGateNode.tsx # AND gate component
│   │   └── index.ts       # Node exports
│   ├── Canvas.tsx         # ReactFlow canvas
│   ├── ComponentPalette.tsx # Component sidebar
│   ├── SimulationControls.tsx # Top control bar
│   ├── VisualEditor.tsx   # Main container
│   └── index.ts           # Component exports
└── index.ts               # Feature exports
```

## Usage

### Basic Circuit Example

Build a simple circuit: **Switch → AND gate → LED**

1. Click or drag a **Switch** onto the canvas
2. Add a second **Switch**
3. Add an **AND gate**
4. Add an **LED**
5. Connect Switch 1 output → AND gate input 1
6. Connect Switch 2 output → AND gate input 2
7. Connect AND gate output → LED input
8. Toggle the switches
9. Click **Run** to see the LED respond

The LED will only light up when both switches are ON.

## Technical Details

### Dependencies
- `@xyflow/react` - Visual canvas and flow graph
- `zustand` - State management
- `immer` - Immutable state updates
- `nanoid` - ID generation
- `clsx` - Conditional classnames
- `shadcn/ui` - UI components (Button)
- `lucide-react` - Icons

### State Updates
- Stores use Immer middleware for immutable updates
- Component positions update on drag end (not during drag for performance)
- Simulation updates component values in IR store
- Projection automatically recomputes when stores update

### Connection Validation
- Target ports can only have one incoming connection
- Source ports can have multiple outgoing connections
- Connections are validated before creation
- Duplicate connections are prevented

### Simulation Algorithm
- Iterative propagation (max 100 iterations)
- Evaluates all components each iteration
- Stops when no values change
- Works for acyclic circuits (no feedback loops)

## Future Phases

Phase 2+ will add:
- More logic gates (OR, NOT, XOR, NAND, NOR)
- Multi-bit components (buses, splitters, mergers)
- Memory components (flip-flops, registers)
- Complex components (ALU, counters, multiplexers)
- Subcircuits and hierarchical design
- Persistence (save/load circuits)
- Continuous simulation mode
- Waveform visualization

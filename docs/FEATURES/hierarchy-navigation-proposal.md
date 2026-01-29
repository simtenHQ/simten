# Hierarchy Navigation Proposal

**Status:** 🚧 Feature Proposal - Not Yet Implemented
**Priority:** Future Enhancement
**Estimated Scope:** Medium to Large

---

## Overview

This document consolidates planning and design work for hierarchical circuit navigation - a feature that would allow users to "drill down" into composite components to view and edit their internal structure.

**Source Documents** (archived):
- `hierarchy-navigation-implementation.md` - Implementation plan (900 lines)
- `hierarchy-navigation-example.md` - Usage examples (647 lines)
- `hierarchy-visualization-analysis.md` - Design analysis (724 lines)
- `hierarchy-visualization-decision-guide.md` - Decision tree (575 lines)

---

## Problem Statement

### Current Limitation

Users can create composite components in DSL, but cannot:
- View the internal structure of composites in the visual editor
- Navigate into a composite to see/edit its implementation
- Understand what a composite does without reading DSL source
- Debug issues inside composite components

### User Stories

1. **As a learner**, I want to explore how standard library components work by drilling into them
2. **As a circuit designer**, I want to debug a composite by viewing its internal connections
3. **As an educator**, I want to show students the layers of abstraction in a complex design
4. **As a developer**, I want to refactor a composite's internals without affecting its interface

---

## Proposed Solution

### Hierarchical Navigation UI

**Breadcrumb navigation:**
```
Top Level > FullAdder > HalfAdder
```

**Drill-down interaction:**
- Double-click a composite node → zoom into its implementation
- Breadcrumb → jump back to parent level
- Keyboard shortcut (e.g., Ctrl+Enter) → enter selected composite

**Visual hierarchy indicators:**
- Composites have a special icon/color
- Depth level shown in breadcrumb
- "Expand in place" vs "Navigate into" options

### State Management

**Navigation stack:**
```typescript
interface HierarchyState {
  stack: CircuitRef[];        // Breadcrumb trail
  currentCircuit: Circuit;    // Currently viewing
  parentConnections: Map;     // How current circuit connects to parent
}
```

**Context preservation:**
- Remember scroll position when navigating
- Preserve selection state
- Maintain zoom level (or auto-fit)

### Port Mapping

When viewing a composite's internals:
- Parent ports shown as special "boundary" nodes
- Clear visual indication of what connects to parent
- Edit restrictions (can't delete parent ports)

---

## Design Decisions

### Decision 1: Navigation Model

**Options considered:**
1. **Drill-down (selected)** - Replace canvas with composite's internals
2. **Split-pane** - Show parent and child simultaneously
3. **Overlay** - Modal view of composite internals
4. **Tab-based** - Each circuit in a tab

**Rationale for drill-down:**
- Simplest mental model (familiar from file explorers)
- No screen real estate issues
- Clear focus on one level at a time
- Breadcrumb provides context

### Decision 2: Edit Behavior

**Options considered:**
1. **Read-only view (selected for MVP)** - Can view but not edit
2. **Full edit** - Can modify composite internals
3. **Restricted edit** - Can edit connections but not structure

**Rationale for read-only:**
- Simpler to implement (no propagation of changes)
- Reduces risk of breaking circuits
- Can be enhanced later to full edit
- Sufficient for debugging and exploration

### Decision 3: Primitive Handling

**Question:** What happens when you "drill into" a primitive?

**Answer:** Show documentation/behavior explanation (not internal structure)
- Primitives have no internal structure (hardcoded behavior)
- Display: Component description, port documentation, truth table (if applicable)
- Link to primitive implementation (primitives.ts) for advanced users

---

## Implementation Phases

### Phase 1: Read-Only Navigation (MVP)

**Scope:**
- Navigate into composites (read-only)
- Breadcrumb navigation
- View parent port connections
- Show primitive documentation

**Components to build:**
1. Breadcrumb component
2. Navigation state management (Zustand store)
3. Port boundary nodes for parent connections
4. Drill-down interaction (double-click composite)
5. Primitive documentation viewer

**Estimated effort:** 2-3 weeks

### Phase 2: Edit Support

**Scope:**
- Edit composite internals
- Propagate changes to parent circuits using composite
- Validate edits (don't break parent connections)
- Undo/redo for hierarchical edits

**Additional components:**
1. Change propagation system
2. Validation layer
3. Conflict resolution UI
4. Enhanced undo/redo

**Estimated effort:** 3-4 weeks

### Phase 3: Advanced Features

**Scope:**
- Collapse/expand composites in place (without navigation)
- Search across hierarchy
- Jump to component definition
- Multi-level undo
- Refactoring tools (extract circuit, inline composite)

**Estimated effort:** 4-6 weeks

---

## Technical Challenges

### Challenge 1: State Synchronization

**Problem:** When viewing Circuit A inside Circuit B, changes to Circuit A must propagate to all instances

**Solutions considered:**
- Immutable circuit definitions (change creates new version)
- Reference-based sharing (instances point to single definition)
- Copy-on-write (instance gets copy when modified)

**Recommendation:** Reference-based with version tracking

### Challenge 2: Port Path Resolution

**Problem:** Port paths become complex in nested hierarchies

**Example:**
```
Top Level: switch1.out
  → FullAdder: fa1.a
    → HalfAdder: ha1.a
      → Xor: xor1.a (primitive)
```

**Solution:** Hierarchical path representation
```typescript
interface HierarchicalPortPath {
  segments: Array<{
    circuitId: string;
    nodeId: string;
    portName: string;
  }>;
}
```

### Challenge 3: Performance

**Problem:** Large circuits with deep nesting may be slow

**Mitigations:**
- Lazy loading (only load visible level)
- Virtual rendering (for large component lists)
- Memoization of projection layers
- Caching of composite expansions

---

## UI/UX Mockups

### Breadcrumb Navigation

```
┌─────────────────────────────────────────────────────────────┐
│ 🏠 Top Level > CPU > ALU > FullAdder                       │
└─────────────────────────────────────────────────────────────┘
```

### Composite Node Indicator

```
┌─────────────────┐
│  FullAdder 📦  │  ← Icon indicates composite
│ ┌─────┬─────┐  │
│ │  a  │ sum │  │
│ │  b  │     │  │
│ │ cin │cout │  │
│ └─────┴─────┘  │
│ Double-click to │
│    expand      │
└─────────────────┘
```

### Parent Port Boundary Nodes

When inside FullAdder:
```
┌─────────┐
│ ⭘ a     │  ← Parent input (boundary node)
└─────────┘
     │
     ↓
┌─────────┐
│ HalfAdder│
└─────────┘
```

---

## Alternative Approaches Considered

### Approach 1: Inline Expansion

**Description:** Expand composite in place, showing its internals as a subgraph

**Pros:**
- See multiple levels simultaneously
- No navigation required
- Maintains context

**Cons:**
- Cluttered for deep hierarchies
- Screen space limitations
- Harder to edit cleanly

**Decision:** Rejected (too complex visually)

### Approach 2: Tabbed Interface

**Description:** Each circuit level in a separate tab

**Pros:**
- Familiar pattern (like code editors)
- Easy to switch between levels
- Can view multiple levels by opening tabs

**Cons:**
- Loses hierarchical context
- Tab overload with deep nesting
- Harder to understand parent-child relationship

**Decision:** Rejected (poor hierarchy visualization)

### Approach 3: Minimap View

**Description:** Show entire hierarchy as minimap, navigate by clicking

**Pros:**
- See full structure at once
- Easy to jump to any level
- Good for exploration

**Cons:**
- Requires significant screen space
- Hard to use with very large circuits
- Unclear port connections

**Decision:** Could be complementary feature (not primary navigation)

---

## Integration with Existing Features

### Time-Travel Debugging

**Question:** How does hierarchy navigation interact with time-travel?

**Answer:** Navigation is orthogonal to time
- Can navigate hierarchy while viewing past states
- Each level shows its state at the current timeline position
- Breadcrumb shows hierarchy, timeline shows time

### DSL Editor

**Question:** Should DSL editor show hierarchy?

**Answer:** Yes, with syntax folding
- Fold/unfold `impl` blocks
- Breadcrumb navigation in DSL
- Jump to definition (Ctrl+Click on component name)

### Live Simulation

**Question:** Can you simulate while navigating hierarchy?

**Answer:** Yes, but with care
- Simulation runs at top level
- Drill-down shows internal state of composites
- Values propagate correctly through hierarchy

---

## Testing Strategy

### Unit Tests

- Breadcrumb component
- Navigation state management
- Port path resolution
- Composite expansion

### Integration Tests

- Navigate into composite → verify correct circuit shown
- Edit composite (Phase 2) → verify parent updated
- Simulate → verify values propagate through hierarchy

### E2E Tests

- User clicks through multi-level hierarchy
- User navigates back via breadcrumb
- User simulates circuit while navigating

---

## Success Criteria

**Functional:**
- ✅ User can navigate into any composite
- ✅ Breadcrumb shows current position
- ✅ Parent ports clearly indicated
- ✅ Can navigate back to any parent level
- ✅ Primitives show documentation (not internal structure)

**Performance:**
- ✅ Navigation < 200ms (perceived as instant)
- ✅ No lag when viewing large composites (100+ nodes)

**Usability:**
- ✅ Navigation model is intuitive (no user confusion)
- ✅ Clear visual indicators of hierarchy depth
- ✅ Can understand circuit structure by exploration

---

## Open Questions

1. **How to handle composites with many instances?**
   - Edit in one place affects all? Or create local copy?

2. **Should we allow recursive circuits?**
   - Circuit that contains instance of itself (directly or indirectly)
   - If yes, how to prevent infinite navigation loops?

3. **How deep should we allow nesting?**
   - Practical limit: 10 levels?
   - Performance implications of deep nesting

4. **Should breadcrumb be always visible?**
   - Or hide when at top level?

5. **How to handle parameter variations?**
   - Adder(width=8) vs Adder(width=16) - same composite, different params
   - Should they share definition or be separate?

---

## Future Enhancements

Beyond initial implementation:

1. **Refactoring tools:**
   - Extract selection into new composite
   - Inline composite (replace with its internals)
   - Rename composite (update all references)

2. **Multi-view:**
   - Split screen showing parent and child
   - Picture-in-picture for context

3. **Search and navigation:**
   - Search for component across hierarchy
   - "Find usage" - where is this composite used?
   - Dependency graph visualization

4. **Collaboration:**
   - Multiple users viewing different levels
   - Annotation and comments on composites
   - Change tracking

---

## References

**Related Documentation:**
- [Component Model](../SPECIFICATIONS/component-model.md) - Primitives vs composites
- [DSL Specification](../SPECIFICATIONS/DSL-and-IR-specification.md) - Circuit definitions
- [Visual Editor Guide](../GUIDES/visual-editor-guide.md) - Current editor features

**Prior Art:**
- Digital.js - Hierarchical circuit editor
- Logisim - Circuit hierarchy with drill-down
- Verilog module hierarchy in EDA tools
- File explorer navigation patterns

---

## Implementation Status

**Current:** Not implemented
**Next steps:** Prioritize feature, assign to roadmap
**Blockers:** None (all dependencies met)
**Dependencies:** Core editor, DSL parser, IR structure (all complete)

---

## Archived Source Documents

The full detailed analysis (2,846 lines) has been archived. Key decisions and rationale are summarized above. For complete context, see:

- `hierarchy-navigation-implementation.md` - Detailed implementation plan
- `hierarchy-navigation-example.md` - Comprehensive usage examples
- `hierarchy-visualization-analysis.md` - Design alternatives analysis
- `hierarchy-visualization-decision-guide.md` - Decision criteria and rationale

These documents are available in project history but are not part of active documentation to reduce duplication.

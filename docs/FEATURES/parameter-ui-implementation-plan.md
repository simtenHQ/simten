# Parameter UI Implementation Plan

## Overview

This document outlines the complete implementation plan for adding parameter editing capabilities to the visual editor. Users will be able to configure parameterized components (like Splitter, Adder, Mux, etc.) through an intuitive UI.

## Current State

### What Works
- Primitive components are defined with fixed configurations (e.g., Splitter with default 2×4-bit outputs)
- Components can be instantiated and connected
- Simulation works correctly with the default configurations

### What's Missing
- No UI to configure component parameters
- No runtime parameter validation
- No way to create parameterized instances (e.g., Splitter with custom output widths)
- No parameter persistence in saved circuits

## Goals

1. **Primary Goal**: Enable users to configure parameterized components through a visual UI
2. **User Experience**: Make parameter editing intuitive, with clear validation and immediate feedback
3. **Extensibility**: Design the system to easily support new parameterized components
4. **Type Safety**: Ensure parameters are validated and type-safe
5. **Persistence**: Save and restore component parameters correctly

## Implementation Phases

### Phase 1: Core Parameter Infrastructure (2-3 days)

**Goal**: Establish the foundation for parameters in the type system and IR.

#### 1.1 Type System Updates
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/types/circuit.ts`

Add parameter type definitions:
```typescript
export type ParameterType =
  | { kind: 'number'; min?: number; max?: number; default: number }
  | { kind: 'enum'; options: string[]; default: string }
  | { kind: 'widthArray'; default: number[] };

export interface ParameterDefinition {
  name: string;
  type: ParameterType;
  description: string;
  displayName: string;
}
```

**Tasks**:
- [ ] Add parameter type definitions
- [ ] Update `Circuit` type to include `parameters: ParameterDefinition[]`
- [ ] Update `ComponentInstance` to include `parameterValues: Record<string, unknown>`
- [ ] Write tests for type definitions

**Test File**: `src/features/visual-editor/types/circuit.test.ts`

#### 1.2 Primitive Parameter Definitions
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/primitives.ts`

Update primitives to declare their parameters:
```typescript
// Example for Splitter
createPrimitiveCircuit(
  'Splitter',
  [{ name: 'in', portType: busType(8) }],
  [], // outputs will be dynamic
  'Bus splitter - splits a bus into smaller buses',
  // NEW: parameter definitions
  [
    {
      name: 'widths_out',
      type: { kind: 'widthArray', default: [4, 4] },
      description: 'Array of output widths (must sum to input width)',
      displayName: 'Output Widths'
    }
  ]
)
```

**Tasks**:
- [ ] Add parameter support to `createPrimitiveCircuit` helper
- [ ] Add parameter definitions to Splitter
- [ ] Add parameter definitions to Adder (width parameter)
- [ ] Add parameter definitions to Mux (input_count, width parameters)
- [ ] Add parameter definitions to Constant (value parameter)
- [ ] Write tests verifying parameter definitions

**Test File**: `src/features/visual-editor/lib/primitives.test.ts`

#### 1.3 Parameter Validation Library
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/parameter-validator.ts`

Create validation utilities:
```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateParameter(
  value: unknown,
  definition: ParameterDefinition
): ValidationResult;

export function validateParameters(
  values: Record<string, unknown>,
  definitions: ParameterDefinition[]
): ValidationResult;
```

**Tasks**:
- [ ] Implement number validation (min/max bounds)
- [ ] Implement enum validation (valid option check)
- [ ] Implement widthArray validation (sum constraints)
- [ ] Write comprehensive tests for all validators

**Test File**: `src/features/visual-editor/lib/parameter-validator.test.ts`

**Success Criteria for Phase 1**:
- ✅ All type definitions compile without errors
- ✅ At least 5 primitives have parameter definitions
- ✅ All validation tests pass
- ✅ No breaking changes to existing functionality

---

### Phase 2: IR Store Integration (2 days)

**Goal**: Integrate parameters into the IR store and component management.

#### 2.1 Store Updates
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/stores/ir-store.ts`

Add parameter management actions:
```typescript
// New actions
setComponentParameters: (componentId: string, parameters: Record<string, unknown>) => void;
getComponentParameters: (componentId: string) => Record<string, unknown> | undefined;
validateComponentParameters: (componentId: string) => ValidationResult;
```

**Tasks**:
- [ ] Add parameter state to component instances
- [ ] Implement `setComponentParameters` action
- [ ] Implement `getComponentParameters` selector
- [ ] Implement `validateComponentParameters` using validator library
- [ ] Update `addComponent` to initialize parameters with defaults
- [ ] Write tests for all parameter actions

**Test File**: `src/features/visual-editor/stores/ir-store.test.ts`

#### 2.2 Dynamic Port Generation
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/port-generator.ts` (new file)

Create utilities to generate ports based on parameters:
```typescript
export function generatePorts(
  circuit: Circuit,
  parameters: Record<string, unknown>
): { inputs: Port[]; outputs: Port[] };
```

**Example**: For Splitter with `widths_out: [2, 3, 3]`, generate outputs:
- `out0` (2-bit)
- `out1` (3-bit)
- `out2` (3-bit)

**Tasks**:
- [ ] Implement port generation for Splitter
- [ ] Implement port generation for Mux
- [ ] Implement port generation for Decoder
- [ ] Write tests for dynamic port generation
- [ ] Integrate with IR store component creation

**Test File**: `src/features/visual-editor/lib/port-generator.test.ts`

**Success Criteria for Phase 2**:
- ✅ Components can store parameter values
- ✅ Parameters persist correctly in the IR store
- ✅ Dynamic port generation works for parameterized components
- ✅ All store tests pass

---

### Phase 3: Parameter Editor UI (3-4 days)

**Goal**: Build the user-facing parameter editing interface.

#### 3.1 Parameter Editor Component
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/components/ParameterEditor.tsx`

Create the main parameter editing component:
```typescript
interface ParameterEditorProps {
  componentId: string;
  onClose: () => void;
}

export function ParameterEditor({ componentId, onClose }: ParameterEditorProps) {
  // Renders a modal/panel with parameter fields
}
```

**Features**:
- Display all parameters for the selected component
- Show parameter descriptions and constraints
- Validate on change
- Save/Cancel buttons
- Show validation errors inline

**Tasks**:
- [ ] Create ParameterEditor component skeleton
- [ ] Add modal/dialog wrapper (use shadcn/ui Dialog)
- [ ] Implement number parameter field
- [ ] Implement enum parameter field (dropdown/radio)
- [ ] Implement widthArray parameter field (dynamic list)
- [ ] Add validation display (error messages)
- [ ] Add save/cancel actions
- [ ] Style the editor for consistency with the app

**Dependencies**: shadcn/ui components (Dialog, Input, Select, Button)

#### 3.2 Parameter Field Components
**Files**:
- `src/features/visual-editor/components/parameters/NumberField.tsx`
- `src/features/visual-editor/components/parameters/EnumField.tsx`
- `src/features/visual-editor/components/parameters/WidthArrayField.tsx`

Create specialized input components for each parameter type.

**NumberField**:
- Input with number validation
- Show min/max constraints
- Visual indicators for valid/invalid values

**EnumField**:
- Dropdown or radio group
- Show all valid options

**WidthArrayField**:
- Dynamic list of number inputs
- Add/remove width entries
- Show total sum constraint
- Visual feedback for constraint violations

**Tasks**:
- [ ] Implement NumberField component
- [ ] Implement EnumField component
- [ ] Implement WidthArrayField component
- [ ] Add accessibility (ARIA labels, keyboard navigation)
- [ ] Write component tests (interaction testing)

**Test Files**:
- `src/features/visual-editor/components/parameters/NumberField.test.tsx`
- `src/features/visual-editor/components/parameters/EnumField.test.tsx`
- `src/features/visual-editor/components/parameters/WidthArrayField.test.tsx`

#### 3.3 Integration with Canvas
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/components/Canvas.tsx`

Add UI trigger to open parameter editor:
- Right-click context menu: "Edit Parameters"
- Double-click on component (optional)
- Properties panel button (if exists)

**Tasks**:
- [ ] Add "Edit Parameters" to component context menu
- [ ] Wire up to open ParameterEditor
- [ ] Pass component ID to ParameterEditor
- [ ] Handle parameter changes (re-render component, update connections if ports change)

#### 3.4 Visual Feedback
**Goal**: Show when components have non-default parameters.

**Tasks**:
- [ ] Add visual indicator to components with custom parameters (badge, icon, different border)
- [ ] Show parameter values in component tooltip/hover
- [ ] Update component label to reflect parameters (e.g., "Splitter [2,3,3]")

**Success Criteria for Phase 3**:
- ✅ Users can open parameter editor for any parameterized component
- ✅ All parameter types can be edited
- ✅ Validation works and shows clear error messages
- ✅ Changes persist correctly
- ✅ Visual feedback indicates customized components

---

### Phase 4: Simulator Integration (2 days)

**Goal**: Ensure the simulator correctly uses component parameters during evaluation.

#### 4.1 Evaluator Parameter Passing
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/simulator.ts`

Update simulator to pass parameters to evaluators:
```typescript
// When evaluating a component, include parameters as special inputs
const inputs = new Map<string, unknown>();
// ... add regular inputs
// Add parameters with __ prefix
for (const [key, value] of Object.entries(componentParameters)) {
  inputs.set(`__${key}`, value);
}
```

**Tasks**:
- [ ] Update `evaluateComponent` to include parameters
- [ ] Ensure parameters are passed to primitive evaluators
- [ ] Handle parameter changes mid-simulation (reset state if needed)
- [ ] Write tests for parameterized component simulation

**Test File**: `src/features/visual-editor/lib/simulator.test.ts`

#### 4.2 Port Reconfiguration Handling
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/port-reconfiguration.ts` (new file)

Handle what happens when parameters change and ports are added/removed:
```typescript
export function handleParameterChange(
  componentId: string,
  oldParameters: Record<string, unknown>,
  newParameters: Record<string, unknown>
): {
  portsAdded: Port[];
  portsRemoved: Port[];
  connectionsToRemove: Connection[];
};
```

**Logic**:
1. Compare old vs new port configurations
2. Identify added/removed ports
3. Remove connections to removed ports
4. Return changes for IR store to apply

**Tasks**:
- [ ] Implement port diff logic
- [ ] Implement connection cleanup
- [ ] Integrate with parameter setter in IR store
- [ ] Write tests for various parameter change scenarios

**Test File**: `src/features/visual-editor/lib/port-reconfiguration.test.ts`

**Success Criteria for Phase 4**:
- ✅ Simulator correctly uses component parameters
- ✅ Changing parameters during simulation works correctly
- ✅ Port changes are handled gracefully (connections cleaned up)
- ✅ All simulator tests pass

---

### Phase 5: Serialization & Persistence (1-2 days)

**Goal**: Save and load circuits with parameter values.

#### 5.1 Circuit Serialization
**File**: `/Users/charlesharris/Documents/Personal/turing-incomplete/src/features/visual-editor/lib/circuit-serializer.ts`

Update serialization to include parameters:
```typescript
// Ensure ComponentInstance includes parameterValues in JSON
interface SerializedComponent {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>; // NEW
}
```

**Tasks**:
- [ ] Update serialization format to include parameters
- [ ] Update deserialization to restore parameters
- [ ] Validate parameters on load (use validator)
- [ ] Handle legacy circuits (without parameters) gracefully
- [ ] Write serialization round-trip tests

**Test File**: `src/features/visual-editor/lib/circuit-serializer.test.ts`

#### 5.2 Migration Strategy
Handle existing saved circuits that don't have parameter data:
- Apply default parameters on load
- Show notification: "Circuit updated with default parameters"

**Tasks**:
- [ ] Implement migration logic for legacy circuits
- [ ] Write migration tests

**Success Criteria for Phase 5**:
- ✅ Circuits with custom parameters save correctly
- ✅ Circuits with custom parameters load correctly
- ✅ Legacy circuits load with default parameters
- ✅ Serialization round-trips perfectly

---

### Phase 6: Polish & Documentation (1-2 days)

**Goal**: Finalize the feature with polish, docs, and examples.

#### 6.1 User Experience Polish
- [ ] Add loading states to parameter editor
- [ ] Add keyboard shortcuts (Escape to close, Enter to save)
- [ ] Add undo/redo support for parameter changes
- [ ] Improve error messages (user-friendly, actionable)
- [ ] Add tooltips explaining constraints

#### 6.2 Example Circuits
Create example circuits demonstrating parameterized components:
- [ ] Splitter examples (different configurations)
- [ ] Adder examples (4-bit, 16-bit)
- [ ] Mux examples (2-input, 4-input, 8-input)

**Files**: `examples/parameterized-components/`

#### 6.3 Documentation
- [ ] Update user guide with parameter editing instructions
- [ ] Add developer docs for adding new parameterized primitives
- [ ] Document parameter types and validation rules
- [ ] Add troubleshooting guide

**Files**:
- `docs/user-guide/parameter-editing.md`
- `docs/developer-guide/parameterized-primitives.md`

#### 6.4 Testing & QA
- [ ] Manual testing of all parameter types
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Performance testing (large circuits with many parameters)
- [ ] Accessibility testing (keyboard navigation, screen readers)

**Success Criteria for Phase 6**:
- ✅ Feature feels polished and intuitive
- ✅ All documentation is complete and accurate
- ✅ Example circuits demonstrate all parameter capabilities
- ✅ No critical bugs or UX issues

---

## File Structure

### New Files
```
src/features/visual-editor/
├── components/
│   ├── ParameterEditor.tsx          (Phase 3)
│   └── parameters/
│       ├── NumberField.tsx          (Phase 3)
│       ├── EnumField.tsx            (Phase 3)
│       ├── WidthArrayField.tsx      (Phase 3)
│       ├── NumberField.test.tsx     (Phase 3)
│       ├── EnumField.test.tsx       (Phase 3)
│       └── WidthArrayField.test.tsx (Phase 3)
├── lib/
│   ├── parameter-validator.ts       (Phase 1)
│   ├── parameter-validator.test.ts  (Phase 1)
│   ├── port-generator.ts            (Phase 2)
│   ├── port-generator.test.ts       (Phase 2)
│   ├── port-reconfiguration.ts      (Phase 4)
│   ├── port-reconfiguration.test.ts (Phase 4)
│   ├── circuit-serializer.ts        (Phase 5)
│   └── circuit-serializer.test.ts   (Phase 5)
└── types/
    └── circuit.test.ts              (Phase 1)

docs/
├── user-guide/
│   └── parameter-editing.md         (Phase 6)
└── developer-guide/
    └── parameterized-primitives.md  (Phase 6)

examples/
└── parameterized-components/        (Phase 6)
    ├── splitter-examples.json
    ├── adder-examples.json
    └── mux-examples.json
```

### Modified Files
```
src/features/visual-editor/
├── types/
│   └── circuit.ts                   (Phase 1)
├── lib/
│   ├── primitives.ts                (Phase 1)
│   ├── primitives.test.ts           (Phase 1)
│   └── simulator.ts                 (Phase 4)
├── stores/
│   ├── ir-store.ts                  (Phase 2)
│   └── ir-store.test.ts             (Phase 2)
└── components/
    └── Canvas.tsx                    (Phase 3)
```

---

## Testing Strategy

### Unit Tests
- All new utilities have dedicated test files
- Test all parameter types independently
- Test validation logic comprehensively
- Test edge cases (empty arrays, out-of-bounds numbers, etc.)

### Integration Tests
- Test parameter changes affect simulation correctly
- Test serialization/deserialization round-trips
- Test UI interactions (parameter editor open/close/save)

### End-to-End Tests
- Create a circuit with parameterized components
- Edit parameters through UI
- Verify simulation uses new parameters
- Save and reload circuit
- Verify parameters persist

---

## Rollout Strategy

### Development Order
1. **Phase 1** → Establish foundation (types, definitions, validation)
2. **Phase 2** → Store integration (parameters in IR)
3. **Phase 3** → UI implementation (parameter editor)
4. **Phase 4** → Simulator integration (use parameters in evaluation)
5. **Phase 5** → Persistence (save/load)
6. **Phase 6** → Polish and documentation

### Incremental Rollout
- Start with **Splitter** as the first parameterized component (simplest, most useful)
- Add **Constant** (single number parameter, very simple)
- Add **Adder** (single number parameter with constraints)
- Add **Mux** (multiple parameters with interdependencies)
- Generalize to all remaining primitives

### Feature Flags (Optional)
Consider adding a feature flag to enable/disable parameter editing during development:
```typescript
const ENABLE_PARAMETER_EDITING = true; // Toggle during development
```

---

## Success Metrics

### Functionality
- ✅ All parameterized components can be configured via UI
- ✅ Parameters validate correctly
- ✅ Simulation uses custom parameters
- ✅ Parameters persist across save/load

### Code Quality
- ✅ 90%+ test coverage for new code
- ✅ All TypeScript strict mode checks pass
- ✅ No linter warnings
- ✅ Documentation complete

### User Experience
- ✅ Parameter editor is intuitive (minimal learning curve)
- ✅ Validation errors are clear and actionable
- ✅ No performance degradation with parameterized components
- ✅ Accessible to keyboard-only users

---

## Risk Mitigation

### Technical Risks
1. **Port Reconfiguration Complexity**
   - **Risk**: Changing parameters may add/remove ports, breaking existing connections
   - **Mitigation**: Implement robust port diffing and connection cleanup
   - **Fallback**: Warn users before applying parameter changes that affect ports

2. **Performance**
   - **Risk**: Dynamic port generation may slow down large circuits
   - **Mitigation**: Cache generated ports, only regenerate on parameter change
   - **Monitoring**: Add performance tests for circuits with 100+ components

3. **Serialization Breaking Changes**
   - **Risk**: New parameter format may break existing saved circuits
   - **Mitigation**: Implement migration logic, maintain backward compatibility
   - **Testing**: Test with circuits from previous versions

### UX Risks
1. **Complexity Overload**
   - **Risk**: Parameter editor may be overwhelming for beginners
   - **Mitigation**: Progressive disclosure (advanced parameters hidden by default)
   - **Documentation**: Provide clear examples and tutorials

2. **Error Messages**
   - **Risk**: Validation errors may be cryptic
   - **Mitigation**: Write user-friendly error messages with examples
   - **Testing**: Review all error messages with non-technical users

---

## Open Questions

1. **Should parameter changes be undoable?**
   - **Recommendation**: Yes, integrate with existing undo/redo system
   - **Priority**: Medium (Phase 6)

2. **Should we support parameter expressions (e.g., "width * 2")?**
   - **Recommendation**: Not in initial version, consider for future
   - **Complexity**: High, requires expression parser and evaluator

3. **Should parameters be editable during simulation?**
   - **Recommendation**: Allow editing, but reset simulation state on change
   - **UX**: Show warning: "Changing parameters will reset simulation"

4. **Should we support custom parameter types (beyond number/enum/widthArray)?**
   - **Recommendation**: Design system to be extensible, but start with these three
   - **Future**: Consider adding boolean, string, color parameters

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Core Infrastructure | 2-3 days | None |
| Phase 2: IR Store Integration | 2 days | Phase 1 |
| Phase 3: Parameter Editor UI | 3-4 days | Phase 2 |
| Phase 4: Simulator Integration | 2 days | Phase 3 |
| Phase 5: Serialization | 1-2 days | Phase 4 |
| Phase 6: Polish & Documentation | 1-2 days | Phase 5 |
| **Total** | **11-15 days** | Sequential |

### Realistic Schedule
- **If working full-time**: 2-3 weeks
- **If working part-time (50%)**: 4-6 weeks
- **Buffer for unknowns**: Add 20-30% contingency

---

## Next Steps (Immediate Actions)

1. **Review and approve this plan**
2. **Start Phase 1: Core Parameter Infrastructure**
   - Begin with type system updates in `circuit.ts`
   - Add parameter definitions to Splitter primitive
   - Implement basic validation for number and widthArray types
3. **Set up tracking**
   - Create GitHub issues for each phase
   - Use project board to track progress

---

## Notes

- This plan is designed to be implemented incrementally with clear milestones
- Each phase should be reviewed and tested before moving to the next
- The plan is flexible; adjust as you learn more during implementation
- Focus on Splitter as the first parameterized component (highest ROI)
- Prioritize user experience over feature completeness

---

**Document Version**: 1.0
**Created**: 2026-01-20
**Last Updated**: 2026-01-20
**Owner**: Development Team

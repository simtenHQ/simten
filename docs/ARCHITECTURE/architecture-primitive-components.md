# Primitive Component Architecture

## Overview

This document explains how primitive components are defined, created, and managed in the system. It addresses the architectural changes made to eliminate hacky type checking and create a maintainable, extensible system.

## Problem Statement

Previously, we had a fragmented primitive component system:

1. **Old enum-based system** (`ir.ts`): Only 13 primitive types using SCREAMING_SNAKE_CASE naming
2. **New array-based system** (`primitives.ts`): 31+ primitives using PascalCase naming
3. **Hacky workaround**: Individual if statements in `ir-store.ts` checking for HexDisplay, SevenSegment, etc.

This created:
- Type safety issues
- Maintenance burden (adding primitives required updates in multiple places)
- Naming inconsistencies
- Unclear source of truth

## Solution Architecture

### Single Source of Truth: `PRIMITIVE_DEFINITIONS`

All primitive components are defined in a unified registry:

```typescript
// primitives.ts
export const PRIMITIVE_DEFINITIONS: Record<string, PrimitiveDefinition> = {
  And: defineCombinational({
    name: 'And',
    description: 'Logical AND gate',
    category: 'logic-gates',
    icon: '&',
    componentType: 'AND_GATE',
    inputs: [...],
    outputs: [...],
    evaluate: (inputs) => { /* logic */ },
  }),

  HexDisplay: defineCombinational({
    name: 'HexDisplay',
    description: 'Hexadecimal display',
    category: 'display',
    icon: '0xFF',
    componentType: 'HexDisplay',
    inputs: [...],
    outputs: [],
    evaluate: (inputs) => { /* logic */ },
    createComponent: (id) => ({ id, type: 'HexDisplay', value: 0, width: 8 }),
  }),

  // ... all 35+ primitives
};
```

Each definition includes:
- Circuit structure (inputs, outputs, clocks, state)
- Behavior (evaluator function)
- UI metadata (category, icon)
- Component creation logic (initial state)

### Auto-Generated Exports

From `PRIMITIVE_DEFINITIONS`, the system **automatically generates**:

```typescript
// primitives.ts

// Circuit IR definitions (for simulator)
export const PRIMITIVES: Circuit[] = generatePrimitives(PRIMITIVE_DEFINITIONS);

// Evaluator registry (for execution)
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> =
  generateEvaluators(PRIMITIVE_DEFINITIONS);

// Component creator (for IR construction)
export const createPrimitiveComponent = generateCreator(PRIMITIVE_DEFINITIONS);
```

**No manual switch statements!** Each primitive's `createComponent` function handles its own initialization.

### Component Resolution Flow

When adding a component to the IR:

```
User requests component type "HexDisplay"
         ↓
ir-store.ts: addComponent("HexDisplay")
         ↓
1. Check component library (user-defined components)
         ↓ (not found)
2. Call createPrimitiveComponent("HexDisplay")
         ↓
   primitives.ts: lookup in PRIMITIVES array
         ↓
   Found! Create component with { id, type: "HexDisplay", value: 0, width: 8 }
         ↓
Return component to IR store
```

**No more switch statements in ir-store.ts!**
**No more individual if statements for each type!**

## Naming Conventions

We have two naming systems for historical reasons:

### Legacy System (SCREAMING_SNAKE_CASE)
Used in older code and IR types:
- `AND_GATE`, `OR_GATE`, `NOT_GATE`
- `SWITCH`, `LED`, `INPUT`
- `D_FLIP_FLOP`, `REGISTER`, `RAM`

### New System (PascalCase)
Used in `primitives.ts` and new code:
- `And`, `Or`, `Not`
- `Switch`, `Led`, `Input`
- `DFlipFlop`, `Register`, `RAM`
- `HexDisplay`, `SevenSegment` (these were never in legacy system)

### Mapping

The `primitive-metadata.ts` file maps between these systems:

```typescript
export const PRIMITIVE_METADATA: Record<string, PrimitiveMetadata> = {
  // PascalCase name -> legacy ComponentType
  And: { category: '...', icon: '&', componentType: 'AND_GATE' },
  HexDisplay: { category: '...', icon: '🖥', componentType: 'HexDisplay' },
};
```

**New primitives should use PascalCase** (they don't need legacy names).

## Type System Updates

### Before (Hacky)
```typescript
export type PrimitiveComponentType =
  | 'SWITCH' | 'LED' | 'AND_GATE' // ... only 13 types

// In ir-store.ts:
default:
  if (type === 'HexDisplay') {
    return { id, type: 'HexDisplay', value: 0, width: 8 };
  }
  if (type === 'SevenSegment') {
    return { id, type: 'SevenSegment', value: 0 };
  }
  throw new Error(`Unknown component type: ${type}`);
```

### After (Clean)
```typescript
// Legacy type for backward compatibility
export type LegacyPrimitiveComponentType =
  | 'SWITCH' | 'LED' | 'AND_GATE' // ...

// Modern type (allows all primitives)
export type PrimitiveComponentType = string;

// Dynamic lookup from primitives.ts (ES6 import)
import { isPrimitive } from '../lib/primitive-registry';

export function isPrimitiveComponentType(type: ComponentType): boolean {
  return isPrimitive(type); // Checks PRIMITIVES array
}

// In ir-store.ts:
const primitiveComponent = createPrimitiveComponent(id, type, initialValue);
if (primitiveComponent) {
  return primitiveComponent as Component;
}
throw new Error(`Unknown component type: ${type}`);
```

## Adding New Primitives

To add a new primitive component:

### 1. Add ONE definition to `PRIMITIVE_DEFINITIONS`

```typescript
// In primitives.ts, add to PRIMITIVE_DEFINITIONS object:
export const PRIMITIVE_DEFINITIONS: Record<string, PrimitiveDefinition> = {
  // ... existing primitives ...

  MyNewComponent: defineCombinational({
    name: 'MyNewComponent',
    description: 'Description of my component',
    category: 'utilities',
    icon: '🆕',
    componentType: 'MyNewComponent',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const input = inputs.get('in') as boolean;
      return new Map([['out', !input]]);
    },
    // If component needs special initialization:
    createComponent: (id, initialValue) => ({
      id,
      type: 'MyNewComponent',
      value: initialValue ?? 0,
    }),
  }),
};
```

### 2. Add ComponentType enum value

```typescript
// In types/index.ts:
export type ComponentType =
  // ... existing types ...
  | 'MyNewComponent';
```

### 3. That's it!

Everything else is **automatically generated**:
- Circuit IR definition (added to `PRIMITIVES` array)
- Evaluator registration (added to `PRIMITIVE_EVALUATORS` object)
- Component creator (integrated into `createPrimitiveComponent` function)
- Palette metadata (category, icon, componentType)

The component will automatically:
- Be available in the component palette
- Work with `addComponent()`
- Have proper port specifications
- Be recognized as a primitive
- Evaluate correctly in simulation

## The Generator Pattern

The key architectural innovation is the **generator pattern**:

### Definition Phase
You write a single `PrimitiveDefinition` with all component information co-located:
- Identity (name, description)
- Circuit structure (inputs, outputs, clocks, state)
- Behavior (evaluator functions)
- UI metadata (category, icon)
- Initialization logic (createComponent function)

### Generation Phase
Generator functions transform definitions into runtime structures:

```typescript
// primitives.ts
export const PRIMITIVES = generatePrimitives(PRIMITIVE_DEFINITIONS);
export const PRIMITIVE_EVALUATORS = generateEvaluators(PRIMITIVE_DEFINITIONS);
export const createPrimitiveComponent = generateCreator(PRIMITIVE_DEFINITIONS);
```

Each generator extracts what it needs:
- `generatePrimitives()` → Circuit IR (inputs, outputs, clocks, state, metadata)
- `generateEvaluators()` → Name-to-evaluator mapping
- `generateCreator()` → Unified creation function that delegates to each definition's `createComponent`

### Benefits
1. **Single source of truth**: All information about a primitive lives in one definition
2. **No manual synchronization**: Adding a field to definitions updates all generated structures
3. **Type safety**: TypeScript ensures definitions are complete and consistent
4. **No boilerplate**: No switch statements, no manual registry management
5. **Easy refactoring**: Change generation logic once, affects all primitives

## Files and Responsibilities

| File | Responsibility |
|------|----------------|
| `primitives.ts` | **Source of truth** - All primitive definitions, evaluators, circuit specs |
| `ir.ts` | Type definitions, legacy compatibility, helper functions |
| `ir-store.ts` | Component creation orchestration (delegates to `primitives.ts`) |
| `primitive-metadata.ts` | UI metadata (icons, categories) - presentation layer only |
| `simulator.ts` | Uses legacy type checking (will be migrated to new system) |

## Migration Path

The system is designed for gradual migration:

1. **Phase 1 (Complete)**: New primitives use PascalCase, `createPrimitiveComponent()` handles all types
2. **Phase 2 (In Progress)**: Update type checking to use dynamic lookup
3. **Phase 3 (Future)**: Migrate simulator to use new IR v0.1 system completely
4. **Phase 4 (Future)**: Remove legacy SCREAMING_SNAKE_CASE types entirely

## Design Principles

1. **Single Source of Truth**: `primitives.ts` is authoritative for all primitive definitions
2. **Explicit over Implicit**: State initialization is explicit in `createPrimitiveComponent()`
3. **Fail Fast**: Unknown types return `null` / throw errors immediately
4. **Type Safety**: TypeScript ensures compile-time safety where possible
5. **Extensibility**: Adding primitives requires minimal changes
6. **Backward Compatibility**: Legacy code continues to work during migration

## Benefits

### Before (Manual Switch Statements)
- Adding HexDisplay required changes in 3+ files
- Manual switch statement in `createPrimitiveComponent()` with 35+ cases
- Manual entry in `PRIMITIVES` array
- Manual entry in `PRIMITIVE_EVALUATORS` object
- Easy to forget one and get runtime errors
- No clear source of truth

### After (Generator Pattern)
- Adding a primitive requires ONE definition in `PRIMITIVE_DEFINITIONS`
- Plus ONE ComponentType enum entry (for UI compatibility)
- Everything else auto-generated
- Impossible to forget a case - TypeScript enforces completeness
- Single source of truth per primitive
- Clear separation between definition (data) and generation (transformation)

## Testing Strategy

All primitive components should be tested through:

1. **Evaluator tests**: Test behavior logic in isolation (see `primitives.test.ts`)
2. **Component creation tests**: Verify initial state is correct
3. **Integration tests**: Components work in IR store and simulator
4. **Generator tests**: Verify auto-generation produces expected structures

Example tests:

```typescript
// Test evaluator behavior
describe('HexDisplay primitive', () => {
  it('evaluates correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.HexDisplay;
    const inputs = new Map([['in', 42]]);
    const outputs = evaluator.evaluate(inputs);
    expect(outputs).toEqual(new Map()); // Display has no outputs
  });
});

// Test component creation
describe('createPrimitiveComponent', () => {
  it('creates HexDisplay with correct initial state', () => {
    const component = createPrimitiveComponent('test-id', 'HexDisplay');
    expect(component).toEqual({
      id: 'test-id',
      type: 'HexDisplay',
      value: 0,
      width: 8,
    });
  });

  it('returns null for unknown types', () => {
    const component = createPrimitiveComponent('test-id', 'UnknownType');
    expect(component).toBeNull();
  });
});

// Test auto-generation
describe('generatePrimitives', () => {
  it('generates Circuit IR for all definitions', () => {
    const circuits = generatePrimitives(PRIMITIVE_DEFINITIONS);
    expect(circuits.length).toBeGreaterThan(30); // 35+ primitives
    expect(circuits[0]).toHaveProperty('inputs');
    expect(circuits[0]).toHaveProperty('outputs');
    expect(circuits[0]).toHaveProperty('implementation');
  });
});
```

## Related Documents

- [IR v0.1 Specification](./circuit-spec.md)
- [Primitive Interface](../src/features/visual-editor/lib/primitive-interface.ts)
- [Sequential Circuits Implementation](./SEQUENTIAL_CIRCUITS_IMPLEMENTATION.md)

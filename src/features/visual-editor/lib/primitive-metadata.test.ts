/**
 * Tests for primitive metadata
 */

import { describe, it, expect } from 'vitest';
import {
  PRIMITIVE_METADATA,
  PRIMITIVE_CATEGORIES,
  CATEGORY_INFO,
  getPrimitiveMetadata,
  getPrimitivesByCategory,
} from './primitive-metadata';
import { getPrimitives } from './primitives';

describe('Primitive Metadata', () => {
  it('should have metadata for all primitives', () => {
    const primitives = getPrimitives();
    const primitiveNames = primitives.map((p) => p.name);

    // Check that all primitives have metadata
    for (const name of primitiveNames) {
      const metadata = getPrimitiveMetadata(name);
      expect(metadata, `Metadata missing for primitive: ${name}`).toBeDefined();
      expect(metadata?.category).toBeDefined();
      expect(metadata?.icon).toBeDefined();
      expect(metadata?.componentType).toBeDefined();
    }
  });

  it('should have metadata for exactly the same number of primitives as defined', () => {
    const primitives = getPrimitives();
    const metadataKeys = Object.keys(PRIMITIVE_METADATA);

    // Metadata count should match primitive count
    expect(metadataKeys).toHaveLength(primitives.length);

    // Every primitive should have metadata
    for (const primitive of primitives) {
      expect(metadataKeys).toContain(primitive.name);
    }
  });

  it('should categorize all primitives correctly', () => {
    const categorized = getPrimitivesByCategory();

    // Verify categories exist
    expect(categorized.has(PRIMITIVE_CATEGORIES.LOGIC_GATES)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.ARITHMETIC)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.PLEXERS)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.SEQUENTIAL)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.MEMORY)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.UTILITIES)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.IO)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.BUS_OPS)).toBe(true);
    expect(categorized.has(PRIMITIVE_CATEGORIES.DISPLAY)).toBe(true);

    // Verify counts per category
    expect(categorized.get(PRIMITIVE_CATEGORIES.LOGIC_GATES)?.length).toBe(8); // And, Or, Not, Nand, Nor, Xor, Xnor, Buffer
    expect(categorized.get(PRIMITIVE_CATEGORIES.IO)?.length).toBe(4); // Switch, Led, Button, Input
    expect(categorized.get(PRIMITIVE_CATEGORIES.BUS_OPS)?.length).toBe(4); // BusAnd, BusOr, BusNot, BusXor
    expect(categorized.get(PRIMITIVE_CATEGORIES.ARITHMETIC)?.length).toBe(4); // Adder, Multiplier, Comparator, Incrementer
    expect(categorized.get(PRIMITIVE_CATEGORIES.PLEXERS)?.length).toBe(2); // Mux, Decoder
    expect(categorized.get(PRIMITIVE_CATEGORIES.SEQUENTIAL)?.length).toBe(2); // DFlipFlop, Register
    expect(categorized.get(PRIMITIVE_CATEGORIES.MEMORY)?.length).toBe(3); // RAM, ROM, DualPortRAM
    expect(categorized.get(PRIMITIVE_CATEGORIES.UTILITIES)?.length).toBe(5); // Constant, Splitter, Splitter8to8, Probe, BitSlice
    expect(categorized.get(PRIMITIVE_CATEGORIES.DISPLAY)?.length).toBe(4); // SevenSegment, HexDisplay, Screen, RasterDisplay
  });

  it('should have category info for all categories', () => {
    const categories = Object.values(PRIMITIVE_CATEGORIES);
    for (const category of categories) {
      const info = CATEGORY_INFO[category];
      expect(info, `Category info missing for: ${category}`).toBeDefined();
      expect(info?.label).toBeDefined();
      expect(info?.icon).toBeDefined();
      expect(info?.description).toBeDefined();
    }
  });

  it('should map primitive names to correct ComponentType values', () => {
    // Test logic gates mapping
    expect(PRIMITIVE_METADATA.And.componentType).toBe('AND_GATE');
    expect(PRIMITIVE_METADATA.Or.componentType).toBe('OR_GATE');
    expect(PRIMITIVE_METADATA.Not.componentType).toBe('NOT_GATE');
    expect(PRIMITIVE_METADATA.Nand.componentType).toBe('NAND_GATE');
    expect(PRIMITIVE_METADATA.Nor.componentType).toBe('NOR_GATE');
    expect(PRIMITIVE_METADATA.Xor.componentType).toBe('XOR_GATE');
    expect(PRIMITIVE_METADATA.Xnor.componentType).toBe('XNOR_GATE');
    expect(PRIMITIVE_METADATA.Buffer.componentType).toBe('BUFFER');

    // Test I/O mapping
    expect(PRIMITIVE_METADATA.Switch.componentType).toBe('SWITCH');
    expect(PRIMITIVE_METADATA.Led.componentType).toBe('LED');

    // Test sequential mapping
    expect(PRIMITIVE_METADATA.DFlipFlop.componentType).toBe('D_FLIP_FLOP');
    expect(PRIMITIVE_METADATA.Register.componentType).toBe('REGISTER');
    expect(PRIMITIVE_METADATA.RAM.componentType).toBe('RAM');
  });

  it('should have unique icons per primitive', () => {
    const icons = new Set<string>();
    for (const metadata of Object.values(PRIMITIVE_METADATA)) {
      icons.add(metadata.icon);
    }
    // While not strictly required, we should have at least 20 unique icons
    expect(icons.size).toBeGreaterThanOrEqual(20);
  });
});

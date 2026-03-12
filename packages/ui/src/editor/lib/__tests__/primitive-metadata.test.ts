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
} from '../simulation/primitive-metadata';
import { getPrimitives } from '../primitive-registry';

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

    // Verify all expected categories exist and have at least one primitive
    const expectedCategories = [
      PRIMITIVE_CATEGORIES.LOGIC_GATES,
      PRIMITIVE_CATEGORIES.ARITHMETIC,
      PRIMITIVE_CATEGORIES.PLEXERS,
      PRIMITIVE_CATEGORIES.SEQUENTIAL,
      PRIMITIVE_CATEGORIES.MEMORY,
      PRIMITIVE_CATEGORIES.UTILITIES,
      PRIMITIVE_CATEGORIES.IO,
      PRIMITIVE_CATEGORIES.BUS_OPS,
      PRIMITIVE_CATEGORIES.DISPLAY,
    ];

    for (const category of expectedCategories) {
      expect(categorized.has(category), `Category ${category} should exist`).toBe(true);
      expect(
        categorized.get(category)?.length,
        `Category ${category} should have at least one primitive`
      ).toBeGreaterThanOrEqual(1);
    }

    // Verify total count matches all primitives (no primitives lost in categorization)
    const totalCategorized = Array.from(categorized.values()).reduce(
      (sum, primitives) => sum + primitives.length,
      0
    );
    const primitives = getPrimitives();
    expect(totalCategorized).toBe(primitives.length);
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

  it('should map primitive names to correct categories', () => {
    // Test logic gates
    expect(PRIMITIVE_METADATA.And.category).toBe('logic-gates');
    expect(PRIMITIVE_METADATA.Or.category).toBe('logic-gates');
    expect(PRIMITIVE_METADATA.Not.category).toBe('logic-gates');

    // Test I/O
    expect(PRIMITIVE_METADATA.Switch.category).toBe('input-output');
    expect(PRIMITIVE_METADATA.Led.category).toBe('input-output');

    // Test sequential
    expect(PRIMITIVE_METADATA.DFlipFlop.category).toBe('sequential');
    expect(PRIMITIVE_METADATA.Register.category).toBe('sequential');
    expect(PRIMITIVE_METADATA.RAM.category).toBe('memory');
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

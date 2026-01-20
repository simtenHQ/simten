/**
 * IR Store Display Components Test
 *
 * Tests that HexDisplay and SevenSegment components are created correctly
 * with proper initialization values.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useIRStore } from './ir-store';

describe('IR Store - Display Components', () => {
  beforeEach(() => {
    useIRStore.getState().clearAll();
  });

  it('should create HexDisplay with proper initial values', () => {
    const hexId = useIRStore.getState().addComponent('HexDisplay');
    const hex = useIRStore.getState().getComponent(hexId);

    expect(hex).toBeDefined();
    expect(hex?.type).toBe('HexDisplay');
    expect('value' in hex!).toBe(true);
    expect('width' in hex!).toBe(true);
    expect((hex as any).value).toBe(0);
    expect((hex as any).width).toBe(8);
  });

  it('should create SevenSegment with proper initial values', () => {
    const segId = useIRStore.getState().addComponent('SevenSegment');
    const seg = useIRStore.getState().getComponent(segId);

    expect(seg).toBeDefined();
    expect(seg?.type).toBe('SevenSegment');
    expect('value' in seg!).toBe(true);
    expect((seg as any).value).toBe(0);
  });

  it('should update HexDisplay value', () => {
    const hexId = useIRStore.getState().addComponent('HexDisplay');

    // Update the value
    useIRStore.getState().updateComponent(hexId, { value: 255 });

    const hex = useIRStore.getState().getComponent(hexId);
    expect((hex as any).value).toBe(255);
  });

  it('should update SevenSegment value', () => {
    const segId = useIRStore.getState().addComponent('SevenSegment');

    // Update the value
    useIRStore.getState().updateComponent(segId, { value: 15 });

    const seg = useIRStore.getState().getComponent(segId);
    expect((seg as any).value).toBe(15);
  });
});

/**
 * Numeric Event Queue for Fast Simulation
 *
 * Ring buffer event queue with O(1) deduplication using typed arrays.
 * No allocations during simulation - all buffers are pre-allocated.
 */

export class NumericEventQueue {
  /** Ring buffer for node indices */
  private queue: Uint32Array;

  /** Pending flags for O(1) deduplication (1 = in queue, 0 = not in queue) */
  private pending: Uint8Array;

  /** Head index (next to dequeue) */
  private head: number = 0;

  /** Tail index (next to enqueue) */
  private tail: number = 0;

  /** Capacity (equals nodeCount) */
  private readonly capacity: number;

  /**
   * Create a new numeric event queue.
   * @param nodeCount - Maximum number of nodes (queue capacity)
   */
  constructor(nodeCount: number) {
    this.capacity = nodeCount;
    this.queue = new Uint32Array(nodeCount);
    this.pending = new Uint8Array(nodeCount);
  }

  /**
   * Add a node index to the queue (if not already pending).
   * O(1) with no allocations.
   */
  enqueue(nodeIndex: number): void {
    if (this.pending[nodeIndex]) return;
    this.pending[nodeIndex] = 1;
    this.queue[this.tail % this.capacity] = nodeIndex;
    this.tail++;
  }

  /**
   * Add multiple node indices to the queue.
   * Uses typed array for O(n) with no allocations.
   */
  enqueueAll(nodeIndices: Uint32Array): void {
    for (let i = 0; i < nodeIndices.length; i++) {
      this.enqueue(nodeIndices[i]);
    }
  }

  /**
   * Remove and return the next node index from the queue.
   * O(1) with no allocations.
   * @returns The next node index
   */
  dequeue(): number {
    const nodeIndex = this.queue[this.head % this.capacity];
    this.pending[nodeIndex] = 0;
    this.head++;
    return nodeIndex;
  }

  /**
   * Check if the queue is empty.
   */
  isEmpty(): boolean {
    return this.head === this.tail;
  }

  /**
   * Get the current size of the queue.
   */
  size(): number {
    return this.tail - this.head;
  }

  /**
   * Return the current queue contents as a plain array.
   * Only used for tracing/debugging — allocates a new array.
   */
  toArray(): number[] {
    const result: number[] = [];
    for (let i = this.head; i < this.tail; i++) {
      result.push(this.queue[i % this.capacity]);
    }
    return result;
  }

  /**
   * Clear the queue and reset for next tick.
   * O(1) - just resets pointers, pending array cleared on dequeue.
   */
  clear(): void {
    // Reset pointers
    this.head = 0;
    this.tail = 0;
    // Clear pending array (needed for clean state)
    this.pending.fill(0);
  }
}

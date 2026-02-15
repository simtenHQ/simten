/**
 * Event Queue for Event-Driven Simulation
 *
 * A simple queue with deduplication to ensure each node is only
 * evaluated once per propagation wave, even if multiple inputs change.
 */

export class EventQueue {
  private queue: string[] = [];
  private pending: Set<string> = new Set();

  /**
   * Add a node ID to the queue (if not already pending).
   * Deduplication ensures each node is evaluated at most once per propagation.
   */
  enqueue(nodeId: string): void {
    if (!this.pending.has(nodeId)) {
      this.pending.add(nodeId);
      this.queue.push(nodeId);
    }
  }

  /**
   * Add multiple node IDs to the queue.
   */
  enqueueAll(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      this.enqueue(nodeId);
    }
  }

  /**
   * Remove and return the next node ID from the queue.
   * Returns undefined if the queue is empty.
   */
  dequeue(): string | undefined {
    const nodeId = this.queue.shift();
    if (nodeId) {
      this.pending.delete(nodeId);
    }
    return nodeId;
  }

  /**
   * Check if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clear the queue and pending set.
   */
  clear(): void {
    this.queue = [];
    this.pending.clear();
  }

  /**
   * Get the current size of the queue.
   */
  size(): number {
    return this.queue.length;
  }
}

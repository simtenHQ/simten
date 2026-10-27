import { DurableObject } from 'cloudflare:workers';
import { takeFromBudget } from './limits';

/**
 * One global usage counter, addressed by name (`<service>:<UTC day>`, see
 * `budgetName`). Exported from the worker entry and bound as `DAILY_BUDGET`.
 */
export class DailyBudget extends DurableObject {
  take(limit: number): Promise<boolean> {
    return takeFromBudget(this.ctx.storage, limit, Date.now());
  }

  /** The day this counter covers is over; drop its storage. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

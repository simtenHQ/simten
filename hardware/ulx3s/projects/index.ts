/**
 * Project registry. run_on_fpga CLI resolves --project=<name> against this.
 */

import type { Project } from '../lib/types.js';
import { cpuProject } from './cpu.js';
import { snakeProject } from './snake.js';
import { uartTestProject } from './uart_test.js';

export const projects: Record<string, Project> = {
  cpu: cpuProject,
  snake: snakeProject,
  uart_test: uartTestProject,
};

export function listProjects(): string[] {
  return Object.keys(projects).sort();
}

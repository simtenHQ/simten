/**
 * Testing system types for the visual circuit editor
 * Enables users to define test cases with expected inputs/outputs
 */

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

/**
 * Represents a single input or output value in a test case
 */
export interface TestValue {
  /** Component label (e.g., "A", "B", "Sum") */
  label: string;
  /** Expected boolean value */
  value: boolean;
}

/**
 * Comparison result for a single output
 */
export interface OutputComparison {
  label: string;
  expected: boolean;
  actual: boolean;
  passed: boolean;
}

/**
 * Test case definition
 */
export interface TestCase {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  inputs: TestValue[];
  outputs: TestValue[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Result from executing a test case
 */
export interface TestResult {
  testCaseId: string;
  status: TestStatus;
  /** Detailed comparison for each output */
  comparisons?: OutputComparison[];
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Timestamp of test execution */
  executedAt: number;
  /** Execution time in milliseconds */
  duration: number;
}

/**
 * State for the test store
 */
export interface TestState {
  /** All test cases, keyed by ID */
  testCases: Record<string, TestCase>;
  /** Test results, keyed by test case ID */
  results: Record<string, TestResult>;
  /** Whether tests are currently running */
  isRunning: boolean;
  /** ID of currently editing test case (for modal) */
  editingTestId: string | null;
}

/**
 * Actions for the test store
 */
export interface TestActions {
  /** Add a new test case */
  addTestCase: (testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>) => string;
  /** Update an existing test case */
  updateTestCase: (id: string, updates: Partial<Omit<TestCase, 'id' | 'createdAt'>>) => void;
  /** Remove a test case */
  removeTestCase: (id: string) => void;
  /** Toggle test case enabled/disabled */
  toggleTestCase: (id: string) => void;
  /** Duplicate a test case */
  duplicateTestCase: (id: string) => string;
  /** Set test result */
  setTestResult: (testCaseId: string, result: TestResult) => void;
  /** Clear all test results */
  clearResults: () => void;
  /** Set running state */
  setIsRunning: (isRunning: boolean) => void;
  /** Set editing test ID */
  setEditingTestId: (id: string | null) => void;
}

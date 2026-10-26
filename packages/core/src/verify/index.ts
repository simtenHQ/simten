/**
 * `@simten/core/verify`: the verification harness for `.verify.ts` testbenches.
 *
 *   import { simulate } from '@simten/core';
 *   import * as fc from 'fast-check';
 *   import { verify, declareOracle } from '@simten/core/verify';
 *   import { MyCircuit } from './my_circuit.circuit.ts';
 *
 *   declareOracle({ tier: 'B', type: '…', independence_basis: '…' });
 *   verify.check('…', fc.property(…, (x) => { const s = simulate(MyCircuit); … }));
 *   verify.run();
 */

export { declareOracle, describe, VERIFY_JSON_BEGIN, VERIFY_JSON_END, verify } from './harness.js';
export type * from './types.js';

/**
 * Demo: React state management powered by hardware simulation.
 *
 * The shopping cart's entire state logic is a circuit() — a verified
 * state machine with typed inputs, typed outputs, and time-travel.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo, useRef } from "react";
import { circuit, bit, bus } from "@simten/core/circuit";
import { simulate, type SimulationHandle } from "@simten/core/sim";
import type { SimulatorSnapshot } from "@simten/core/simulator";

export const Route = createFileRoute("/demos/circuit-state")({
  component: CircuitStatePage,
});

// ============================================================================
// The state machine — defined as hardware
// ============================================================================

// Actions
const ADD_ITEM = 1;
const REMOVE_ITEM = 2;
const INCREMENT = 3;
const DECREMENT = 4;
const CLEAR_CART = 5;
const APPLY_DISCOUNT = 6;

// Product catalog
const PRODUCTS = [
  { id: 1, name: "Resistor Pack (100)", price: 4, emoji: "🔧" },
  { id: 2, name: "LED Assortment", price: 7, emoji: "💡" },
  { id: 3, name: "Arduino Nano", price: 12, emoji: "🔌" },
  { id: 4, name: "Breadboard", price: 5, emoji: "📟" },
  { id: 5, name: "FPGA Dev Board", price: 89, emoji: "⚡" },
  { id: 6, name: "Logic Analyzer", price: 35, emoji: "📊" },
];

const CartMachine = circuit('CartMachine', {
  in: {
    action: bus(4),      // which action
    item_id: bus(8),     // which product
    discount: bus(8),    // discount percentage (0-100)
  },
  out: {
    total: bus(32),      // total price in cents
    item_count: bus(8),  // total items
    discount_active: bit,
    savings: bus(32),
  },
  state: {
    items: new Map<number, number>(),  // item_id → quantity
    discountPct: 0,
  },
  eval: ({ items, discountPct }) => {
    const itemMap = items as Map<number, number>;
    let total = 0;
    let count = 0;
    for (const [id, qty] of itemMap) {
      const product = PRODUCTS.find(p => p.id === id);
      if (product) {
        total += product.price * qty;
        count += qty;
      }
    }
    const savings = Math.round(total * (discountPct as number) / 100);
    return {
      total: total - savings,
      item_count: count,
      discount_active: (discountPct as number) > 0 ? 1 : 0,
      savings,
    };
  },
  onTick: ({ action, item_id, discount, items, discountPct }) => {
    const itemMap = new Map(items as Map<number, number>);
    const id = item_id as number;

    switch (action as number) {
      case ADD_ITEM: {
        itemMap.set(id, (itemMap.get(id) ?? 0) + 1);
        break;
      }
      case REMOVE_ITEM: {
        itemMap.delete(id);
        break;
      }
      case INCREMENT: {
        if (itemMap.has(id)) itemMap.set(id, (itemMap.get(id) ?? 0) + 1);
        break;
      }
      case DECREMENT: {
        const qty = (itemMap.get(id) ?? 0) - 1;
        if (qty <= 0) itemMap.delete(id);
        else itemMap.set(id, qty);
        break;
      }
      case CLEAR_CART: {
        itemMap.clear();
        return { items: itemMap, discountPct: 0 };
      }
      case APPLY_DISCOUNT: {
        return { items: itemMap, discountPct: discount as number };
      }
    }

    return { items: itemMap, discountPct: discountPct as number };
  },
});

// ============================================================================
// useCircuitState — 7-line state management hook
// ============================================================================

function useCircuitState<T extends Record<string, any>>(
  circuit: ReturnType<typeof component>,
) {
  const sim = useMemo(() => simulate(circuit), [circuit]);
  const [state, setState] = useState(sim.read());
  const [cycle, setCycle] = useState(0);
  const historyRef = useRef<{ snapshot: SimulatorSnapshot; action: string }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const dispatch = useCallback((inputs: Record<string, number>, label: string) => {
    // Save snapshot before action
    historyRef.current = historyRef.current.slice(0, historyIndex + 1);
    historyRef.current.push({ snapshot: sim.snapshot(), action: label });

    sim.set(inputs);
    sim.tick();
    setState(sim.read());
    setCycle(sim.cycle);
    setHistoryIndex(historyRef.current.length - 1);
  }, [sim, historyIndex]);

  const timeTravel = useCallback((index: number) => {
    if (index < 0 || index >= historyRef.current.length) return;
    sim.restore(historyRef.current[index].snapshot);
    sim.tick(); // re-propagate
    setState(sim.read());
    setCycle(index + 1);
    setHistoryIndex(index);
  }, [sim]);

  return { state, dispatch, cycle, history: historyRef.current, historyIndex, timeTravel, sim };
}

// ============================================================================
// Shopping Cart UI
// ============================================================================

function CircuitStatePage() {
  const { state, dispatch, cycle, history, historyIndex, timeTravel, sim } = useCircuitState(CartMachine);

  // Read items from simulation state for display
  const seqState = sim.session.getState().sequentialState;
  let cartItems = new Map<number, number>();
  if (seqState) {
    for (const [key, value] of seqState.currentState) {
      if (key.includes('items') && value instanceof Map) {
        cartItems = value as Map<number, number>;
      }
    }
  }

  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Hardware State Machine</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This shopping cart's state logic is a <code className="text-xs bg-muted px-1 rounded">circuit()</code> —
          a verified state machine with time-travel debugging. Every state transition is a clock tick.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Product catalog */}
          <div className="md:col-span-2">
            <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Products</h2>
            <div className="grid grid-cols-2 gap-3">
              {PRODUCTS.map(product => {
                const qty = cartItems.get(product.id) ?? 0;
                return (
                  <div key={product.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-lg mr-2">{product.emoji}</span>
                        <span className="text-sm font-medium">{product.name}</span>
                      </div>
                      <span className="text-sm font-mono">${product.price}</span>
                    </div>
                    {qty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => dispatch({ action: DECREMENT, item_id: product.id, discount: 0 }, `−1 ${product.name}`)}
                          className="w-7 h-7 rounded bg-muted text-foreground text-sm"
                        >−</button>
                        <span className="font-mono text-sm w-6 text-center">{qty}</span>
                        <button
                          onClick={() => dispatch({ action: INCREMENT, item_id: product.id, discount: 0 }, `+1 ${product.name}`)}
                          className="w-7 h-7 rounded bg-muted text-foreground text-sm"
                        >+</button>
                        <button
                          onClick={() => dispatch({ action: REMOVE_ITEM, item_id: product.id, discount: 0 }, `Remove ${product.name}`)}
                          className="ml-auto text-xs text-red-400 hover:text-red-300"
                        >Remove</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => dispatch({ action: ADD_ITEM, item_id: product.id, discount: 0 }, `Add ${product.name}`)}
                        className="w-full py-1.5 bg-primary text-primary-foreground rounded text-xs"
                      >Add to Cart</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart summary */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Cart State</h2>
            <div className="border border-border rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Items</span>
                <span className="font-mono">{state.item_count}</span>
              </div>
              {state.discount_active ? (
                <>
                  <div className="flex justify-between text-sm mb-1 text-green-400">
                    <span>Savings</span>
                    <span className="font-mono">-${state.savings}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                <span>Total</span>
                <span className="font-mono">${state.total}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => dispatch({ action: APPLY_DISCOUNT, item_id: 0, discount: 15 }, "Apply 15% off")}
                className="flex-1 py-1.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded text-xs"
              >15% Off</button>
              <button
                onClick={() => dispatch({ action: CLEAR_CART, item_id: 0, discount: 0 }, "Clear cart")}
                className="flex-1 py-1.5 bg-red-600/20 text-red-400 border border-red-600/30 rounded text-xs"
              >Clear</button>
            </div>

            {/* Circuit info */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4">
              <div className="text-xs text-muted-foreground mb-1">Clock cycle</div>
              <div className="font-mono text-lg">{cycle}</div>
              <div className="text-xs text-muted-foreground mt-2 mb-1">Circuit outputs</div>
              <div className="font-mono text-xs space-y-0.5">
                <div>total: <span className="text-foreground">{state.total}</span></div>
                <div>item_count: <span className="text-foreground">{state.item_count}</span></div>
                <div>discount_active: <span className="text-foreground">{state.discount_active}</span></div>
                <div>savings: <span className="text-foreground">{state.savings}</span></div>
              </div>
            </div>

            {/* Time travel */}
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full py-1.5 bg-muted text-foreground rounded text-xs mb-2"
            >
              {showTimeline ? 'Hide' : 'Show'} Timeline ({history.length} actions)
            </button>
          </div>
        </div>

        {/* Timeline */}
        {showTimeline && history.length > 0 && (
          <div className="mt-4 border border-border rounded-lg p-4">
            <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Time Travel — click any action to restore that state
            </h2>
            <div className="flex gap-1 flex-wrap">
              {history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => timeTravel(i)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    i === historyIndex
                      ? 'bg-primary text-primary-foreground'
                      : i < historyIndex
                      ? 'bg-muted/80 text-foreground'
                      : 'bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {i + 1}: {entry.action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Code */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h2 className="text-sm font-semibold mb-2">The state machine</h2>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`const CartMachine = circuit('CartMachine', {
  in: { action: bus(4), item_id: bus(8), discount: bus(8) },
  out: { total: bus(32), item_count: bus(8), discount_active: bit, savings: bus(32) },
  state: { items: new Map(), discountPct: 0 },
  eval: ({ items, discountPct }) => {
    // Compute totals from current state
  },
  onTick: ({ action, item_id, discount, items }) => {
    // ADD_ITEM, REMOVE_ITEM, INCREMENT, DECREMENT, CLEAR, APPLY_DISCOUNT
    // Every transition is a clock tick — inspectable, verifiable, time-travelable
  },
})

// React hook — 7 lines
const { state, dispatch } = useCircuitState(CartMachine)
dispatch({ action: ADD_ITEM, item_id: 3 }, "Add Arduino")`}</pre>
        </div>
      </div>
    </div>
  );
}

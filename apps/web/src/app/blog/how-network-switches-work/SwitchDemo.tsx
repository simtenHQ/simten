"use client";

import { useState, useCallback } from "react";
import { useSwitchSimulator } from "./useSwitchSimulator";

/**
 * Pre-defined Ethernet frame: 7 preamble bytes (0x55), 1 SFD (0xD5), 8 data bytes.
 * The parser expects this exact sequence to transition through IDLE → PREAMBLE_SYNC → IN_FRAME.
 */
const PREAMBLE = [0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0xd5];
const PAYLOAD_0 = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]; // packet from port 0
const PAYLOAD_1 = [0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0x07, 0x18]; // packet from port 1

export function SwitchDemo() {
  const {
    sim,
    isRunning,
    setIsRunning,
    speed,
    setSpeed,
    handleReset,
    injectByte,
    clearValid,
  } = useSwitchSimulator();

  const [log, setLog] = useState<string[]>([]);
  const [injecting, setInjecting] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), msg]);
  }, []);

  /**
   * Inject a full frame (preamble + payload) byte-by-byte on the given port,
   * ticking between each byte so the parser FSM advances.
   */
  const injectFrame = useCallback(
    async (port: 0 | 1) => {
      if (!sim.ready) return;
      setInjecting(true);
      const payload = port === 0 ? PAYLOAD_0 : PAYLOAD_1;
      const frame = [...PREAMBLE, ...payload];

      addLog(`Port ${port}: Sending frame (${frame.length} bytes)...`);

      for (let i = 0; i < frame.length; i++) {
        injectByte(port, frame[i]);
        sim.tick();
        if (i < PREAMBLE.length) {
          addLog(
            `  [${i}] Preamble: 0x${frame[i].toString(16).padStart(2, "0")}`
          );
        } else {
          addLog(
            `  [${i}] Data: 0x${frame[i].toString(16).padStart(2, "0")}`
          );
        }
      }
      // Clear valid after frame
      clearValid(port);
      addLog(`Port ${port}: Frame sent. Running forwarding...`);

      // Tick a bunch of times to let forwarding + egress complete
      for (let i = 0; i < 30; i++) {
        sim.tick();
      }
      addLog(`Port ${port}: Forwarding complete.`);
      setInjecting(false);
    },
    [sim, injectByte, clearValid, addLog]
  );

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling network switch circuit...</span>
        </div>
      </div>
    );
  }

  if (sim.error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6">
        <div className="text-red-400 text-sm font-mono">{sim.error}</div>
      </div>
    );
  }

  // Read port values from the simulator
  const portValues = sim.portValues ?? {};
  const getVal = (key: string) => {
    for (const [k, v] of Object.entries(portValues)) {
      if (k.includes(key)) return v as number;
    }
    return 0;
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          2-Port Network Switch
        </span>
        <span className="text-xs text-gray-500">
          Inject frames, watch them cross-over to the opposite port
        </span>
      </div>

      {/* Switch visualization */}
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Port 0 input */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-blue-400">Port 0 (In)</h4>
            <button
              onClick={() => injectFrame(0)}
              disabled={injecting}
              className="w-full px-3 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
            >
              Send Packet
            </button>
            <div className="text-xs text-gray-500 font-mono">
              Payload: 10 20 30 40...
            </div>
          </div>

          {/* Center: switch diagram */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              Crossbar
            </div>
            <svg
              width={120}
              height={80}
              className="text-gray-500"
              viewBox="0 0 120 80"
            >
              {/* Port 0 → Port 1 */}
              <line
                x1={10}
                y1={20}
                x2={110}
                y2={60}
                stroke="currentColor"
                strokeWidth={2}
              />
              {/* Port 1 → Port 0 */}
              <line
                x1={10}
                y1={60}
                x2={110}
                y2={20}
                stroke="currentColor"
                strokeWidth={2}
              />
              {/* Dots at endpoints */}
              <circle cx={10} cy={20} r={4} fill="#3b82f6" />
              <circle cx={10} cy={60} r={4} fill="#a855f7" />
              <circle cx={110} cy={20} r={4} fill="#a855f7" />
              <circle cx={110} cy={60} r={4} fill="#3b82f6" />
            </svg>
            <div className="text-xs text-gray-600">0 &#8594; 1, 1 &#8594; 0</div>
          </div>

          {/* Port 1 input */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-purple-400">
              Port 1 (In)
            </h4>
            <button
              onClick={() => injectFrame(1)}
              disabled={injecting}
              className="w-full px-3 py-2 text-sm font-medium rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40"
            >
              Send Packet
            </button>
            <div className="text-xs text-gray-500 font-mono">
              Payload: A1 B2 C3 D4...
            </div>
          </div>
        </div>

        {/* Output status */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-700/50 bg-gray-950/50 p-3">
            <h5 className="text-xs text-gray-500 mb-1">Port 0 Output</h5>
            <div className="font-mono text-sm text-blue-300">
              Data: 0x{(getVal("p0_out") & 0xff).toString(16).padStart(2, "0")}
            </div>
          </div>
          <div className="rounded-lg border border-gray-700/50 bg-gray-950/50 p-3">
            <h5 className="text-xs text-gray-500 mb-1">Port 1 Output</h5>
            <div className="font-mono text-sm text-purple-300">
              Data: 0x{(getVal("p1_out") & 0xff).toString(16).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {/* Packet log */}
      <div className="border-t border-gray-700/50 px-4 py-3">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Activity Log
        </h4>
        <div className="h-40 overflow-y-auto font-mono text-xs text-gray-400 space-y-0.5 bg-gray-950/50 rounded-lg p-3">
          {log.length === 0 ? (
            <div className="text-gray-600">
              Click &ldquo;Send Packet&rdquo; to inject a frame...
            </div>
          ) : (
            log.map((entry, i) => <div key={i}>{entry}</div>)
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-900/90">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isRunning
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          }`}
        >
          {isRunning ? "Pause" : "Free Run"}
        </button>
        <button
          onClick={sim.tick}
          disabled={isRunning}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
        >
          Step
        </button>
        <button
          onClick={() => {
            handleReset();
            setLog([]);
          }}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Reset
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-400">Speed</label>
          <input
            type="range"
            min={1}
            max={100}
            value={101 - speed}
            onChange={(e) => setSpeed(101 - Number(e.target.value))}
            className="w-20 accent-blue-500"
          />
        </div>
        <span className="text-xs text-gray-400 font-mono tabular-nums">
          Cycle {sim.cycleCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

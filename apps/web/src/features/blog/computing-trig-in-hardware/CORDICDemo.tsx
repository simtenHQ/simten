import { CircuitCanvas } from '@simten/ui/canvas';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCORDICSimulator } from './useCORDICSimulator';

const CORDIC_LAYOUT: Record<string, { x: number; y: number }> = {
  x: { x: 30, y: 30 },
  y: { x: 30, y: 130 },
  z: { x: 30, y: 230 },
  iteration: { x: 30, y: 330 },
  step: { x: 360, y: 180 },
  xDisplay: { x: 750, y: 30 },
  yDisplay: { x: 750, y: 130 },
  zDisplay: { x: 750, y: 230 },
  iterDisplay: { x: 750, y: 330 },
  doneLed: { x: 750, y: 430 },
};

export function CORDICDemo() {
  const { sim, isRunning, setIsRunning, speed, setSpeed, isDone, handleReset } =
    useCORDICSimulator();

  // Read display values from port values
  const getDisplayValue = (name: string): number => {
    if (!sim.portValues) return 0;
    // Try plain key first (TS builder format)
    const displayKey = `${name}Display.in`;
    const plain = sim.portValues.get(displayKey);
    if (plain !== undefined && typeof plain === 'number') return plain;
    const plainQ = sim.portValues.get(`${name}.q`);
    if (plainQ !== undefined && typeof plainQ === 'number') return plainQ;
    // Fallback: legacy node ID format
    for (const [key, value] of sim.portValues) {
      if (key.includes(name) && (key.includes('Display') || key.includes('display'))) {
        return typeof value === 'number' ? value : 0;
      }
    }
    // Fallback: search register outputs
    for (const [key, value] of sim.portValues) {
      if (key.includes(`_${name}_`) && key.endsWith('.q')) {
        return typeof value === 'number' ? value : 0;
      }
    }
    return 0;
  };

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-100/50 dark:bg-gray-900/50 p-8">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling CORDIC circuit...</span>
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-gray-700/50 bg-gray-100 dark:bg-gray-900/80 overflow-hidden">
        {/* Vector status header */}
        <div className="px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rotating (80, 0) by 45&deg;
              </span>
              <div className="font-mono text-gray-500 dark:text-gray-300 mt-1 flex gap-4">
                <span>x = {getDisplayValue('x')}</span>
                <span>y = {getDisplayValue('y')}</span>
                <span>z = {getDisplayValue('z')}</span>
                <span className="text-gray-500">iter = {getDisplayValue('iter')}</span>
              </div>
            </div>
            {isDone && (
              <span className="ml-auto text-xs font-medium text-green-400 bg-green-900/30 px-2 py-1 rounded">
                Done &middot; cos&thinsp;&asymp;&thinsp;{getDisplayValue('x')},
                sin&thinsp;&asymp;&thinsp;{getDisplayValue('y')}
              </span>
            )}
          </div>
        </div>

        {/* Circuit canvas */}
        <CircuitCanvas
          circuit={sim.circuit}
          componentLibrary={sim.componentLibrary ?? undefined}
          portValues={sim.portValues}
          sequentialState={sim.sequentialState}
          onToggleNode={sim.toggleNode}
          onSetNodeValue={sim.setNodeValue}
          height={400}
          layout={CORDIC_LAYOUT}
        />

        {/* Controls bar */}
        <div className="px-4 py-3 border-t border-gray-700/50 flex flex-wrap items-center gap-3 bg-gray-100 dark:bg-gray-900/90">
          <button
            onClick={() => setIsRunning(!isRunning)}
            disabled={isDone}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-gray-900 dark:text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'
            } disabled:opacity-40`}
          >
            {isRunning ? 'Pause' : 'Run'}
          </button>
          <button
            onClick={sim.tick}
            disabled={isRunning || isDone}
            className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Reset
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500 dark:text-gray-400">Speed</label>
            <input
              type="range"
              min={1}
              max={100}
              value={101 - speed}
              onChange={(e) => setSpeed(101 - Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            Cycle {sim.cycleCount.toLocaleString()}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** The canvas's error state: what went wrong, one line per message. */

export function CanvasError({ error }: { error: string }) {
  // A sandbox error can carry several messages, joined with '; '.
  const messages = error.split('; ');
  return (
    <div
      className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 overflow-hidden"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-300">Circuit Error</h4>
          <div className="mt-2 space-y-1.5">
            {messages.map((message) => (
              <div key={message} className="flex items-start gap-2">
                <span className="text-[10px] font-mono text-red-400/60 bg-red-900/30 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  Compile
                </span>
                <span className="text-xs font-mono text-red-300/80 break-all">{message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

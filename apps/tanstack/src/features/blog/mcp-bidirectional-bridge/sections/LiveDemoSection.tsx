
import { useState, useRef, useCallback, useEffect } from "react";
import { useMCPConnection, type ConnectionStatus } from "@/hooks/useMCPConnection";

interface LogEntry {
  id: number;
  timestamp: number;
  direction: "in" | "out";
  type: string;
  summary: string;
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    idle: "bg-gray-500",
    connecting: "bg-yellow-500 animate-pulse",
    connected: "bg-green-500",
    reconnecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  };
  const labels: Record<ConnectionStatus, string> = {
    idle: "No MCP server detected",
    connecting: "Connecting...",
    connected: "Connected to MCP server",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[status]}`} />
      <span className="text-sm text-gray-500 dark:text-gray-400">{labels[status]}</span>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: "in" | "out" }) {
  if (direction === "in") {
    return (
      <span className="text-[10px] font-mono font-semibold text-green-400 bg-green-400/10 border border-green-800/50 px-1.5 py-0.5 rounded">
        MCP&rarr;Browser
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono font-semibold text-blue-400 bg-blue-400/10 border border-blue-800/50 px-1.5 py-0.5 rounded">
      Browser&rarr;MCP
    </span>
  );
}

export function LiveDemoSection() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "claude"; text: string }[]
  >([]);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const idRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (direction: "in" | "out", type: string, summary: string) => {
      setLog((prev) => {
        const next = [
          ...prev,
          {
            id: idRef.current++,
            timestamp: Date.now(),
            direction,
            type,
            summary,
          },
        ];
        // Keep last 50 entries
        return next.slice(-50);
      });
    },
    []
  );

  const { status, isConnected, sendToClaudePrompt } = useMCPConnection({
    onSource: (source) => {
      addLog("in", "source", `Received circuit source (${source.length} chars)`);
      setLastSource(source);
    },
    onTraces: () => {
      addLog("in", "traces", "Received simulation traces");
    },
    onTestResults: () => {
      addLog("in", "test-results", "Received test results");
    },
    onChatMessage: (text) => {
      addLog("in", "chat-message", `Claude: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`);
      setChatMessages((prev) => [...prev, { role: "claude", text }]);
      setIsThinking(false);
    },
    onError: (message) => {
      addLog("in", "error", message);
    },
    getCircuitState: () => {
      addLog("out", "state-response", "Sent circuit state to MCP");
      return null;
    },
  });

  // Auto-scroll log
  useEffect(() => {
    const el = logEndRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // Auto-scroll chat
  useEffect(() => {
    const el = chatEndRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, isThinking]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text || !isConnected) return;
    sendToClaudePrompt(text, { type: "blog_demo" });
    addLog("out", "send-to-claude", `User: "${text.slice(0, 80)}"`);
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    setIsThinking(true);
  };

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Try It Yourself
        </h2>

        <div className="space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            This isn&rsquo;t a diagram. This page is connected to your local
            MCP server right now. If you have Claude Code running with the
            Turing Incomplete MCP server, you&rsquo;ll see a green dot below
            and every WebSocket message will appear in the live log.
          </p>
        </div>

        {/* Connection status */}
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] p-5">
          <div className="flex items-center justify-between">
            <StatusDot status={status} />
            {isConnected && (
              <span className="text-xs text-gray-500 dark:text-gray-600 font-mono">
                ws://localhost:19847
              </span>
            )}
          </div>

          {status === "idle" || status === "disconnected" ? (
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                To see this demo live, start the MCP server in Claude Code:
              </p>
              <pre className="mt-2 text-xs font-mono text-gray-500 dark:text-gray-400 bg-[#0d1117] rounded p-3 overflow-x-auto">
                {`# In Claude Code, add the Turing Incomplete MCP server
# Then call show_circuit to connect this page`}
              </pre>
            </div>
          ) : null}
        </div>

        {/* Live message log */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              WebSocket Message Log
            </span>
            {log.length > 0 && (
              <button
                onClick={() => setLog([])}
                className="text-[10px] text-gray-500 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors font-mono"
              >
                Clear
              </button>
            )}
          </div>
          <div className="h-48 overflow-y-auto p-3 space-y-1.5">
            {log.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-600 font-mono py-4 text-center">
                {isConnected
                  ? "Waiting for messages... Try using Claude Code tools"
                  : "Connect your MCP server to see live messages"}
              </p>
            ) : (
              log.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-xs font-mono"
                >
                  <span className="text-gray-700 shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <DirectionBadge direction={entry.direction} />
                  <span className="text-gray-500">{entry.type}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">
                    {entry.summary}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Mini chat */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#161b22] border-b border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Channel Notification Demo
            </span>
          </div>

          {/* Chat messages */}
          <div className="h-40 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-600 text-center py-6">
                {isConnected
                  ? "Send a message below — it will reach your Claude via a channel notification"
                  : "Connect your MCP server to try the channel demo"}
              </p>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-blue-300"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <span
                    className={`text-xs font-mono mr-2 ${
                      msg.role === "user"
                        ? "text-blue-500"
                        : "text-green-500"
                    }`}
                  >
                    {msg.role === "user" ? "you" : "claude"}
                  </span>
                  {msg.text}
                </div>
              ))
            )}
            {isThinking && (
              <div className="text-sm text-gray-500 dark:text-gray-500 flex items-center gap-2">
                <span className="text-xs font-mono text-green-500 mr-2">claude</span>
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: "0.4s" }} />
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-3 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                isConnected
                  ? "Type a message to send via channel notification..."
                  : "Connect MCP server first..."
              }
              disabled={!isConnected}
              className="flex-1 bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!isConnected || !chatInput.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:bg-gray-800 disabled:text-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        {/* Last circuit pushed */}
        {lastSource && (
          <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-[#0d1117] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#161b22] border-b border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Last circuit pushed by Claude
              </span>
            </div>
            <pre className="p-4 overflow-x-auto max-h-48 overflow-y-auto">
              <code className="text-xs font-mono text-gray-500 dark:text-gray-400 leading-relaxed">
                {lastSource}
              </code>
            </pre>
          </div>
        )}

        <div className="mt-8 space-y-5 text-gray-500 dark:text-gray-300 leading-relaxed">
          <p>
            Everything you see above is happening over a single WebSocket
            connection. The message log shows the raw protocol. The chat input
            sends a{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              send-to-claude
            </code>{" "}
            message to the MCP server, which fires a channel notification to
            Claude, and Claude&rsquo;s response arrives back as a{" "}
            <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded text-sm">
              chat-message
            </code>
            . No API key. No server-side inference. Just the bridge.
          </p>
        </div>
      </div>
    </section>
  );
}

"use client";

import type { McpConnectionStatus } from "@/features/challenges/useChallengeSync";

const DOT_COLOR: Record<McpConnectionStatus, string> = {
  idle: "bg-slate-500",
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400",
  disconnected: "bg-slate-600",
};

const LABEL: Record<McpConnectionStatus, string> = {
  idle: "MCP idle",
  connecting: "Connecting...",
  connected: "MCP connected",
  disconnected: "MCP disconnected",
};

export function McpStatusBadge({ status }: { status: McpConnectionStatus }) {
  // Don't render if disconnected — no MCP server running
  if (status === "disconnected" || status === "idle") return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/80 border border-gray-700/50 px-2.5 py-1 text-xs text-gray-400">
      <div className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[status]}`} />
      {LABEL[status]}
    </div>
  );
}

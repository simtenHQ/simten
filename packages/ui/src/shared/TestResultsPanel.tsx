import { useState, type CSSProperties } from "react";

export interface TestResult {
  name: string;
  dutName?: string;
  status: "passed" | "failed";
  cycles: number;
  failureReason?: string;
  assertionSummary?: {
    total: number;
    passed: number;
    failed: number;
    results: Array<{ cycle: number; passed: boolean; message: string }>;
  };
}

export interface TestResultsPanelProps {
  results: TestResult[];
}

function TestCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const passed = result.status === "passed";

  const cardStyle: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    background: "#1e293b",
    border: `1px solid ${passed ? "#065f46" : "#7f1d1d"}`,
    cursor: result.assertionSummary ? "pointer" : "default",
  };

  const iconStyle: CSSProperties = {
    width: 16,
    height: 16,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
    background: passed ? "#065f46" : "#7f1d1d",
    color: passed ? "#34d399" : "#f87171",
  };

  return (
    <div>
      <div
        style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 8 }}
        onClick={() => result.assertionSummary && setExpanded(!expanded)}
      >
        <span style={iconStyle}>{passed ? "\u2713" : "\u2717"}</span>
        <span style={{ fontWeight: 500, color: "#e2e8f0", fontSize: 12 }}>
          {result.name}
        </span>
        {result.dutName && (
          <span style={{ color: "#64748b", fontSize: 11 }}>
            DUT: {result.dutName}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontFamily: "monospace",
            color: "#64748b",
          }}
        >
          {result.cycles} cycles
        </span>
        {result.assertionSummary && (
          <span style={{ fontSize: 10, color: "#64748b" }}>
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </div>

      {expanded && result.assertionSummary && (
        <div
          style={{
            marginTop: 4,
            marginLeft: 24,
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          {result.failureReason && (
            <div style={{ color: "#f87171", marginBottom: 4 }}>
              {result.failureReason}
            </div>
          )}
          {result.assertionSummary.results
            .filter((a) => !a.passed)
            .map((a, i) => (
              <div key={i} style={{ color: "#f87171", padding: "1px 0" }}>
                cycle {a.cycle}: {a.message}
              </div>
            ))}
          {result.assertionSummary.results.filter((a) => !a.passed).length ===
            0 && (
            <div style={{ color: "#34d399" }}>All assertions passed</div>
          )}
        </div>
      )}
    </div>
  );
}

export function TestResultsPanel({ results }: TestResultsPanelProps) {
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;

  const containerStyle: CSSProperties = {
    background: "#0f172a",
    borderTop: "1px solid #334155",
    fontSize: 12,
    color: "#94a3b8",
  };

  const headerStyle: CSSProperties = {
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #1e293b",
    fontSize: 11,
    fontWeight: 600,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span>Test Results</span>
        <span style={{ fontWeight: 400 }}>
          <span style={{ color: "#34d399" }}>{passed} passed</span>
          {failed > 0 && (
            <span style={{ color: "#f87171", marginLeft: 6 }}>
              {failed} failed
            </span>
          )}
        </span>
      </div>
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
        {results.map((r, i) => (
          <TestCard key={i} result={r} />
        ))}
      </div>
    </div>
  );
}

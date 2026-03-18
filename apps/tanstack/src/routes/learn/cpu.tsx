import { createFileRoute } from "@tanstack/react-router";
import { CPUDebugger } from "@/features/learn/cpu-debugger/CPUDebugger";

export const Route = createFileRoute("/learn/cpu")({
  head: () => ({
    meta: [{ title: "RV32I CPU Debugger | Turing Incomplete" }],
  }),
  component: CPUDebugger,
});

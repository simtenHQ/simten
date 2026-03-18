import { createFileRoute } from "@tanstack/react-router";
import { DualCPUDebugger } from "@/features/learn/dual-cpu/DualCPUDebugger";

export const Route = createFileRoute("/learn/dual-cpu")({
  head: () => ({
    meta: [{ title: "RV32I Dual CPU | Turing Incomplete" }],
  }),
  component: DualCPUDebugger,
});

import { createFileRoute } from "@tanstack/react-router";
import { CPUDebugger } from "@/features/learn/cpu-debugger/CPUDebugger";
import { pageHead, breadcrumbLd } from "@/lib/seo";

export const Route = createFileRoute("/learn/rv32i-cpu")({
  head: () => ({
    ...pageHead({
      title: "RV32I CPU Debugger — RISC-V in the browser",
      description:
        "A working 5-stage pipelined RV32I RISC-V processor, built from logic gates. Write C, C++, or Rust, compile it with the GCC RISC-V toolchain, and step through execution cycle by cycle.",
      path: "/learn/rv32i-cpu",
    }),
    scripts: [
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Learn", path: "/learn" },
        { name: "RV32I CPU Debugger", path: "/learn/rv32i-cpu" },
      ]),
    ],
  }),
  component: () => (
    <div className="h-screen">
      <CPUDebugger />
    </div>
  ),
});

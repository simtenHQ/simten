import { createFileRoute } from '@tanstack/react-router';
import { CPUDebugger } from '@/features/learn/cpu-debugger/CPUDebugger';
import { breadcrumbLd, pageHead } from '@/lib/seo';

export const Route = createFileRoute('/cpu/rv32i')({
  staticData: { skipDefaultChrome: true },
  head: () => ({
    ...pageHead({
      title: 'RV32I CPU Debugger | RISC-V in the browser',
      description:
        'A working 5-stage pipelined RV32I RISC-V processor, built from logic gates. Write C, C++, or Rust, compile it with the GCC RISC-V toolchain, and step through execution cycle by cycle.',
      path: '/cpu/rv32i',
    }),
    scripts: [
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'CPUs', path: '/cpu' },
        { name: 'RV32I', path: '/cpu/rv32i' },
      ]),
    ],
  }),
  component: () => (
    <div className="h-screen">
      <CPUDebugger />
    </div>
  ),
});

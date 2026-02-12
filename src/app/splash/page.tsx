"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Animated NAND gate visualization
function AnimatedCircuit() {
  const [signals, setSignals] = useState({ a: false, b: false, out: true });
  const [step, setStep] = useState(0);

  useEffect(() => {
    const patterns = [
      { a: false, b: false, out: true },
      { a: true, b: false, out: true },
      { a: false, b: true, out: true },
      { a: true, b: true, out: false },
    ];

    const interval = setInterval(() => {
      setStep((s) => (s + 1) % patterns.length);
      setSignals(patterns[(step + 1) % patterns.length]);
    }, 1200);

    return () => clearInterval(interval);
  }, [step]);

  return (
    <svg viewBox="0 0 400 200" className="w-full max-w-md">
      {/* Input A wire */}
      <line
        x1="50"
        y1="60"
        x2="140"
        y2="60"
        stroke={signals.a ? "#22c55e" : "#374151"}
        strokeWidth="3"
        className="transition-all duration-300"
      />
      <circle
        cx="50"
        cy="60"
        r="8"
        fill={signals.a ? "#22c55e" : "#374151"}
        className="transition-all duration-300"
      />
      <text x="30" y="65" fill="#9ca3af" fontSize="14" textAnchor="middle">
        A
      </text>

      {/* Input B wire */}
      <line
        x1="50"
        y1="140"
        x2="140"
        y2="140"
        stroke={signals.b ? "#22c55e" : "#374151"}
        strokeWidth="3"
        className="transition-all duration-300"
      />
      <circle
        cx="50"
        cy="140"
        r="8"
        fill={signals.b ? "#22c55e" : "#374151"}
        className="transition-all duration-300"
      />
      <text x="30" y="145" fill="#9ca3af" fontSize="14" textAnchor="middle">
        B
      </text>

      {/* NAND Gate body */}
      <path
        d="M140 40 L140 160 L200 160 Q260 160 260 100 Q260 40 200 40 Z"
        fill="#1f2937"
        stroke="#4b5563"
        strokeWidth="2"
      />

      {/* NAND bubble */}
      <circle cx="270" cy="100" r="10" fill="#1f2937" stroke="#4b5563" strokeWidth="2" />

      {/* Gate label */}
      <text x="185" y="105" fill="#9ca3af" fontSize="14" textAnchor="middle">
        NAND
      </text>

      {/* Output wire */}
      <line
        x1="280"
        y1="100"
        x2="370"
        y2="100"
        stroke={signals.out ? "#22c55e" : "#374151"}
        strokeWidth="3"
        className="transition-all duration-300"
      />
      <circle
        cx="370"
        cy="100"
        r="8"
        fill={signals.out ? "#22c55e" : "#374151"}
        className="transition-all duration-300"
      />
      <text x="385" y="105" fill="#9ca3af" fontSize="14">
        Out
      </text>

      {/* Signal pulse animation */}
      {signals.a && (
        <circle cx="95" cy="60" r="4" fill="#22c55e" className="animate-ping" />
      )}
      {signals.b && (
        <circle cx="95" cy="140" r="4" fill="#22c55e" className="animate-ping" />
      )}
      {signals.out && (
        <circle cx="325" cy="100" r="4" fill="#22c55e" className="animate-ping" />
      )}
    </svg>
  );
}

// Animated building blocks showing progression
function ProgressionBlocks() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const blocks = [
    { label: "NAND", icon: "⊼", desc: "Start here" },
    { label: "Gates", icon: "◇", desc: "AND, OR, XOR" },
    { label: "Adder", icon: "∑", desc: "Math circuits" },
    { label: "CPU", icon: "⬡", desc: "Full computer" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4">
      {blocks.map((block, i) => (
        <div key={block.label} className="flex items-center">
          <div
            className={`
              flex flex-col items-center p-3 md:p-4 rounded-lg border transition-all duration-500
              ${
                i <= activeIndex
                  ? "border-green-500 bg-green-500/10 scale-105"
                  : "border-gray-700 bg-gray-800/50"
              }
            `}
          >
            <span className="text-2xl md:text-3xl mb-1">{block.icon}</span>
            <span className="text-xs md:text-sm font-medium text-white">{block.label}</span>
            <span className="text-[10px] md:text-xs text-gray-400">{block.desc}</span>
          </div>
          {i < blocks.length - 1 && (
            <div
              className={`
                w-4 md:w-8 h-0.5 mx-1 transition-all duration-500
                ${i < activeIndex ? "bg-green-500" : "bg-gray-700"}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Code preview snippet
function CodePreview() {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 font-mono text-sm max-w-md w-full">
      <div className="flex gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
      </div>
      <pre className="text-gray-300 overflow-x-auto">
        <code>
          <span className="text-purple-400">circuit</span>{" "}
          <span className="text-yellow-300">Inverter</span> {"{"}
          {"\n"}
          {"  "}
          <span className="text-blue-400">input</span> a: Bit{"\n"}
          {"  "}
          <span className="text-blue-400">output</span> out: Bit{"\n"}
          {"\n"}
          {"  "}
          <span className="text-purple-400">impl</span> {"{"}
          {"\n"}
          {"    "}
          <span className="text-blue-400">node</span> nand1: Nand{"\n"}
          {"    "}
          <span className="text-gray-500">connect</span> a{" "}
          <span className="text-green-400">-&gt;</span> nand1.a{"\n"}
          {"    "}
          <span className="text-gray-500">connect</span> a{" "}
          <span className="text-green-400">-&gt;</span> nand1.b{"\n"}
          {"    "}
          <span className="text-gray-500">connect</span> nand1.out{" "}
          <span className="text-green-400">-&gt;</span> out{"\n"}
          {"  "}
          {"}"}
          {"\n"}
          {"}"}
        </code>
      </pre>
    </div>
  );
}

export default function SplashPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">⬡</span>
            <span className="font-semibold">Turing Incomplete</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              className="text-gray-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/"
              className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Try It
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Animated circuit */}
          <div className="mb-8 flex justify-center">
            <AnimatedCircuit />
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Build a computer
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
              from scratch.
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Start with NAND gates. End with a working CPU running real programs.
            <br />
            No magic. No black boxes. Just logic.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/"
              className="px-8 py-4 bg-green-500 text-gray-900 rounded-lg font-semibold text-lg hover:bg-green-400 transition-colors"
            >
              Start Building
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 border border-gray-600 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-colors"
            >
              See How It Works
            </a>
          </div>

          {/* Progression blocks */}
          <ProgressionBlocks />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Write it. See it. Run it.
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <CodePreview />
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Write your circuit</h3>
                  <p className="text-gray-400">
                    Simple DSL designed for hardware. Autocomplete helps you along.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">See it visualized</h3>
                  <p className="text-gray-400">
                    Your circuit appears as a live diagram. Watch signals flow.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Run real programs</h3>
                  <p className="text-gray-400">
                    Build a CPU. Compile C code. Watch it execute instruction by instruction.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Journey */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">The Journey</h2>
          <p className="text-gray-400 mb-12">
            From a single NAND gate to a full computer. Each step builds on the last.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { time: "5 min", label: "First Gate", desc: "Build NOT from NAND" },
              { time: "15 min", label: "Logic", desc: "AND, OR, XOR" },
              { time: "30 min", label: "Arithmetic", desc: "Half & Full Adder" },
              { time: "1 hour", label: "ALU", desc: "Add, subtract, compare" },
              { time: "2 hours", label: "Memory", desc: "Flip-flops, registers" },
              { time: "4 hours", label: "Control", desc: "State machines" },
              { time: "1 day", label: "CPU", desc: "Fetch, decode, execute" },
              { time: "∞", label: "Beyond", desc: "Your imagination" },
            ].map((step) => (
              <div
                key={step.label}
                className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-green-500/50 transition-colors"
              >
                <div className="text-xs text-green-400 mb-1">{step.time}</div>
                <div className="font-semibold mb-1">{step.label}</div>
                <div className="text-sm text-gray-400">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to see what&apos;s really inside?
          </h2>
          <p className="text-gray-400 mb-8">
            No signup required. Just start building.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-green-500 text-gray-900 rounded-lg font-semibold text-lg hover:bg-green-400 transition-colors"
          >
            Start Building
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray-400 text-sm">
            Built for the curious. Open source.
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Discord
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

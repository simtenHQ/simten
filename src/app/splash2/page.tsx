"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Circuit templates with code and visualization data
const TEMPLATES = [
  {
    id: "inverter",
    name: "Inverter (NOT)",
    description: "Flip a signal using a NAND gate",
    code: `circuit Inverter {
  input a: Bit
  output out: Bit

  impl {
    node nand1: Nand
    connect a -> nand1.a
    connect a -> nand1.b
    connect nand1.out -> out
  }
}`,
    inputs: ["a"],
    evaluate: (inputs: Record<string, boolean>) => ({
      out: !(inputs.a && inputs.a),
    }),
  },
  {
    id: "and",
    name: "AND Gate",
    description: "Both inputs must be true",
    code: `circuit And {
  input a: Bit
  input b: Bit
  output out: Bit

  impl {
    node nand1: Nand
    node nand2: Nand
    connect a -> nand1.a
    connect b -> nand1.b
    connect nand1.out -> nand2.a
    connect nand1.out -> nand2.b
    connect nand2.out -> out
  }
}`,
    inputs: ["a", "b"],
    evaluate: (inputs: Record<string, boolean>) => ({
      out: inputs.a && inputs.b,
    }),
  },
  {
    id: "or",
    name: "OR Gate",
    description: "Either input can be true",
    code: `circuit Or {
  input a: Bit
  input b: Bit
  output out: Bit

  impl {
    node not_a: Nand
    node not_b: Nand
    node or_out: Nand

    connect a -> not_a.a
    connect a -> not_a.b
    connect b -> not_b.a
    connect b -> not_b.b
    connect not_a.out -> or_out.a
    connect not_b.out -> or_out.b
    connect or_out.out -> out
  }
}`,
    inputs: ["a", "b"],
    evaluate: (inputs: Record<string, boolean>) => ({
      out: inputs.a || inputs.b,
    }),
  },
  {
    id: "xor",
    name: "XOR Gate",
    description: "Exactly one input must be true",
    code: `circuit Xor {
  input a: Bit
  input b: Bit
  output out: Bit

  impl {
    node nand1: Nand
    node nand2: Nand
    node nand3: Nand
    node nand4: Nand

    connect a -> nand1.a
    connect b -> nand1.b
    connect a -> nand2.a
    connect nand1.out -> nand2.b
    connect nand1.out -> nand3.a
    connect b -> nand3.b
    connect nand2.out -> nand4.a
    connect nand3.out -> nand4.b
    connect nand4.out -> out
  }
}`,
    inputs: ["a", "b"],
    evaluate: (inputs: Record<string, boolean>) => ({
      out: (inputs.a || inputs.b) && !(inputs.a && inputs.b),
    }),
  },
  {
    id: "halfadder",
    name: "Half Adder",
    description: "Add two bits, get sum and carry",
    code: `circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}`,
    inputs: ["a", "b"],
    evaluate: (inputs: Record<string, boolean>) => ({
      sum: (inputs.a || inputs.b) && !(inputs.a && inputs.b),
      carry: inputs.a && inputs.b,
    }),
  },
  {
    id: "fulladder",
    name: "Full Adder",
    description: "Add two bits plus carry-in",
    code: `circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    // First half adder: a + b
    node ha1: HalfAdder
    connect a -> ha1.a
    connect b -> ha1.b

    // Second half adder: ha1.sum + cin
    node ha2: HalfAdder
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    // Carry out = ha1.carry OR ha2.carry
    node or1: Or
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}`,
    inputs: ["a", "b", "cin"],
    evaluate: (inputs: Record<string, boolean>) => {
      const a = inputs.a ? 1 : 0;
      const b = inputs.b ? 1 : 0;
      const cin = inputs.cin ? 1 : 0;
      const total = a + b + cin;
      return {
        sum: (total % 2) === 1,
        cout: total >= 2,
      };
    },
  },
  {
    id: "mux",
    name: "Multiplexer",
    description: "Select between two inputs",
    code: `circuit Mux {
  input a: Bit      // Selected when sel=0
  input b: Bit      // Selected when sel=1
  input sel: Bit
  output out: Bit

  impl {
    node not_sel: Inverter
    connect sel -> not_sel.a

    // a AND (NOT sel)
    node and_a: And
    connect a -> and_a.a
    connect not_sel.out -> and_a.b

    // b AND sel
    node and_b: And
    connect b -> and_b.a
    connect sel -> and_b.b

    // OR the results
    node or1: Or
    connect and_a.out -> or1.a
    connect and_b.out -> or1.b
    connect or1.out -> out
  }
}`,
    inputs: ["a", "b", "sel"],
    evaluate: (inputs: Record<string, boolean>) => ({
      out: inputs.sel ? inputs.b : inputs.a,
    }),
  },
  {
    id: "adder2bit",
    name: "2-Bit Adder",
    description: "Add two 2-bit numbers",
    code: `circuit Adder2Bit {
  input a0: Bit    // A bit 0 (LSB)
  input a1: Bit    // A bit 1
  input b0: Bit    // B bit 0 (LSB)
  input b1: Bit    // B bit 1
  output s0: Bit   // Sum bit 0
  output s1: Bit   // Sum bit 1
  output cout: Bit // Carry out (overflow)

  impl {
    // Add least significant bits
    node fa0: FullAdder
    node zero: Constant(value=0)
    connect a0 -> fa0.a
    connect b0 -> fa0.b
    connect zero.out -> fa0.cin
    connect fa0.sum -> s0

    // Add next bits with carry
    node fa1: FullAdder
    connect a1 -> fa1.a
    connect b1 -> fa1.b
    connect fa0.cout -> fa1.cin
    connect fa1.sum -> s1
    connect fa1.cout -> cout
  }
}`,
    inputs: ["a0", "a1", "b0", "b1"],
    evaluate: (inputs: Record<string, boolean>) => {
      const a = (inputs.a1 ? 2 : 0) + (inputs.a0 ? 1 : 0);
      const b = (inputs.b1 ? 2 : 0) + (inputs.b0 ? 1 : 0);
      const sum = a + b;
      return {
        s0: (sum & 1) === 1,
        s1: (sum & 2) === 2,
        cout: sum >= 4,
      };
    },
  },
  {
    id: "comparator",
    name: "Comparator",
    description: "Compare two bits: equal, less than, greater than",
    code: `circuit Comparator {
  input a: Bit
  input b: Bit
  output eq: Bit   // a == b
  output lt: Bit   // a < b
  output gt: Bit   // a > b

  impl {
    // XNOR for equality
    node xor1: Xor
    connect a -> xor1.a
    connect b -> xor1.b
    node not_xor: Inverter
    connect xor1.out -> not_xor.a
    connect not_xor.out -> eq

    // a < b: (NOT a) AND b
    node not_a: Inverter
    connect a -> not_a.a
    node and_lt: And
    connect not_a.out -> and_lt.a
    connect b -> and_lt.b
    connect and_lt.out -> lt

    // a > b: a AND (NOT b)
    node not_b: Inverter
    connect b -> not_b.a
    node and_gt: And
    connect a -> and_gt.a
    connect not_b.out -> and_gt.b
    connect and_gt.out -> gt
  }
}`,
    inputs: ["a", "b"],
    evaluate: (inputs: Record<string, boolean>) => ({
      eq: inputs.a === inputs.b,
      lt: !inputs.a && inputs.b,
      gt: inputs.a && !inputs.b,
    }),
  },
  {
    id: "decoder",
    name: "2-to-4 Decoder",
    description: "Decode 2 bits into 4 output lines",
    code: `circuit Decoder2to4 {
  input s0: Bit    // Select bit 0
  input s1: Bit    // Select bit 1
  output y0: Bit   // Active when s1=0, s0=0
  output y1: Bit   // Active when s1=0, s0=1
  output y2: Bit   // Active when s1=1, s0=0
  output y3: Bit   // Active when s1=1, s0=1

  impl {
    node not_s0: Inverter
    node not_s1: Inverter
    connect s0 -> not_s0.a
    connect s1 -> not_s1.a

    // y0 = (NOT s1) AND (NOT s0)
    node and0: And
    connect not_s1.out -> and0.a
    connect not_s0.out -> and0.b
    connect and0.out -> y0

    // y1 = (NOT s1) AND s0
    node and1: And
    connect not_s1.out -> and1.a
    connect s0 -> and1.b
    connect and1.out -> y1

    // y2 = s1 AND (NOT s0)
    node and2: And
    connect s1 -> and2.a
    connect not_s0.out -> and2.b
    connect and2.out -> y2

    // y3 = s1 AND s0
    node and3: And
    connect s1 -> and3.a
    connect s0 -> and3.b
    connect and3.out -> y3
  }
}`,
    inputs: ["s0", "s1"],
    evaluate: (inputs: Record<string, boolean>) => {
      const sel = (inputs.s1 ? 2 : 0) + (inputs.s0 ? 1 : 0);
      return {
        y0: sel === 0,
        y1: sel === 1,
        y2: sel === 2,
        y3: sel === 3,
      };
    },
  },
  {
    id: "alu1bit",
    name: "1-Bit ALU",
    description: "AND, OR, XOR, or ADD based on opcode",
    code: `circuit ALU1Bit {
  input a: Bit
  input b: Bit
  input op0: Bit   // Opcode bit 0
  input op1: Bit   // Opcode bit 1
  input cin: Bit   // Carry in (for ADD)
  output out: Bit
  output cout: Bit // Carry out

  impl {
    // Compute all operations
    node and1: And
    connect a -> and1.a
    connect b -> and1.b

    node or1: Or
    connect a -> or1.a
    connect b -> or1.b

    node xor1: Xor
    connect a -> xor1.a
    connect b -> xor1.b

    node add1: FullAdder
    connect a -> add1.a
    connect b -> add1.b
    connect cin -> add1.cin
    connect add1.cout -> cout

    // 4-to-1 mux to select result
    // op=00: AND, op=01: OR
    // op=10: XOR, op=11: ADD
    node mux01: Mux
    connect and1.out -> mux01.a
    connect or1.out -> mux01.b
    connect op0 -> mux01.sel

    node mux23: Mux
    connect xor1.out -> mux23.a
    connect add1.sum -> mux23.b
    connect op0 -> mux23.sel

    node mux_final: Mux
    connect mux01.out -> mux_final.a
    connect mux23.out -> mux_final.b
    connect op1 -> mux_final.sel
    connect mux_final.out -> out
  }
}`,
    inputs: ["a", "b", "op0", "op1", "cin"],
    evaluate: (inputs: Record<string, boolean>) => {
      const op = (inputs.op1 ? 2 : 0) + (inputs.op0 ? 1 : 0);
      const a = inputs.a;
      const b = inputs.b;
      const cin = inputs.cin;

      let out = false;
      let cout = false;

      switch (op) {
        case 0: // AND
          out = a && b;
          break;
        case 1: // OR
          out = a || b;
          break;
        case 2: // XOR
          out = (a || b) && !(a && b);
          break;
        case 3: // ADD
          const sum = (a ? 1 : 0) + (b ? 1 : 0) + (cin ? 1 : 0);
          out = (sum % 2) === 1;
          cout = sum >= 2;
          break;
      }

      return { out, cout };
    },
  },
];

// Interactive input toggle
function InputToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`
        flex items-center gap-3 px-4 py-2 rounded-lg border transition-all
        ${
          value
            ? "border-green-500 bg-green-500/20 text-green-400"
            : "border-gray-600 bg-gray-800 text-gray-400"
        }
        hover:scale-105 active:scale-95
      `}
    >
      <span className="font-mono font-bold">{label}</span>
      <div
        className={`
          w-8 h-5 rounded-full relative transition-colors
          ${value ? "bg-green-500" : "bg-gray-600"}
        `}
      >
        <div
          className={`
            absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all
            ${value ? "left-3.5" : "left-0.5"}
          `}
        />
      </div>
    </button>
  );
}

// Output display
function OutputDisplay({ label, value }: { label: string; value: boolean }) {
  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2 rounded-lg border transition-all
        ${
          value
            ? "border-green-500 bg-green-500/20"
            : "border-gray-600 bg-gray-800"
        }
      `}
    >
      <div
        className={`
          w-3 h-3 rounded-full transition-colors
          ${value ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-gray-600"}
        `}
      />
      <span className={`font-mono ${value ? "text-green-400" : "text-gray-400"}`}>
        {label} = {value ? "1" : "0"}
      </span>
    </div>
  );
}

// Code display with syntax highlighting
function CodeDisplay({ code, highlightedLine }: { code: string; highlightedLine?: number }) {
  const lines = code.split("\n");

  const highlightSyntax = (line: string) => {
    return line
      .replace(
        /\b(circuit|input|output|impl|node|connect)\b/g,
        '<span class="text-purple-400">$1</span>'
      )
      .replace(/\b(Bit|Bus)\b/g, '<span class="text-blue-400">$1</span>')
      .replace(/\b(Nand|And|Or|Xor|Not)\b/g, '<span class="text-yellow-300">$1</span>')
      .replace(/->/g, '<span class="text-green-400">-></span>')
      .replace(/\/\/.*/g, '<span class="text-gray-500">$&</span>');
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-2 text-sm text-gray-400">circuit.dsl</span>
      </div>
      <pre className="p-4 font-mono text-sm overflow-x-auto">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`
              ${highlightedLine === i ? "bg-green-500/20 -mx-4 px-4" : ""}
              transition-colors
            `}
          >
            <span className="text-gray-500 select-none mr-4">
              {String(i + 1).padStart(2, " ")}
            </span>
            <span dangerouslySetInnerHTML={{ __html: highlightSyntax(line) }} />
          </div>
        ))}
      </pre>
    </div>
  );
}

// Template selector tabs
// Group templates by category
const TEMPLATE_GROUPS = [
  { name: "Basic Gates", ids: ["inverter", "and", "or", "xor"] },
  { name: "Arithmetic", ids: ["halfadder", "fulladder", "adder2bit"] },
  { name: "Building Blocks", ids: ["mux", "comparator", "decoder", "alu1bit"] },
];

function TemplateTabs({
  templates,
  activeId,
  onChange,
}: {
  templates: typeof TEMPLATES;
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {TEMPLATE_GROUPS.map((group) => (
        <div key={group.name}>
          <div className="text-xs text-gray-500 mb-1.5">{group.name}</div>
          <div className="flex flex-wrap gap-2">
            {group.ids.map((id) => {
              const t = templates.find((t) => t.id === id);
              if (!t) return null;
              return (
                <button
                  key={t.id}
                  onClick={() => onChange(t.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${
                      activeId === t.id
                        ? "bg-green-500 text-gray-900"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }
                  `}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Hint tooltip
function Hint({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg whitespace-nowrap animate-bounce">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-blue-500" />
    </div>
  );
}

export default function Splash2Page() {
  const [activeTemplateId, setActiveTemplateId] = useState(TEMPLATES[0].id);
  const [inputs, setInputs] = useState<Record<string, boolean>>({ a: false, b: false });
  const [showInputHint, setShowInputHint] = useState(true);
  const [showTemplateHint, setShowTemplateHint] = useState(false);

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId)!;
  const outputs = activeTemplate.evaluate(inputs);

  // Show template hint after user toggles an input
  useEffect(() => {
    if (!showInputHint && !showTemplateHint) {
      const timer = setTimeout(() => setShowTemplateHint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [showInputHint, showTemplateHint]);

  const handleInputToggle = (inputName: string) => {
    setInputs((prev) => ({ ...prev, [inputName]: !prev[inputName] }));
    setShowInputHint(false);
  };

  const handleTemplateChange = (id: string) => {
    setActiveTemplateId(id);
    setInputs({ a: false, b: false });
    setShowTemplateHint(false);
  };

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
            <Link href="/splash" className="text-gray-400 hover:text-white transition-colors">
              Back
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Open Editor
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            See how it works
          </h1>
          <p className="text-lg text-gray-400">
            Every circuit is defined in code. Toggle inputs. Watch outputs change.
          </p>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Template selector */}
          <div className="mb-6 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Choose a circuit:</span>
              <Hint visible={showTemplateHint}>Try a different circuit!</Hint>
            </div>
            <TemplateTabs
              templates={TEMPLATES}
              activeId={activeTemplateId}
              onChange={handleTemplateChange}
            />
          </div>

          {/* Main content grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Code panel */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Code:</span>
                <span className="text-xs text-gray-500">
                  {activeTemplate.description}
                </span>
              </div>
              <CodeDisplay code={activeTemplate.code} />
            </div>

            {/* Interactive panel */}
            <div className="space-y-6">
              {/* Inputs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-400">Inputs:</span>
                  <span className="text-xs text-green-400">(click to toggle)</span>
                </div>
                <div className="relative flex flex-wrap gap-3">
                  <Hint visible={showInputHint}>Click to toggle!</Hint>
                  {activeTemplate.inputs.map((inputName) => (
                    <InputToggle
                      key={inputName}
                      label={inputName}
                      value={inputs[inputName] || false}
                      onChange={() => handleInputToggle(inputName)}
                    />
                  ))}
                </div>
              </div>

              {/* Visual representation */}
              <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
                <div className="flex items-center justify-center gap-8">
                  {/* Input signals */}
                  <div className="flex flex-col gap-4">
                    {activeTemplate.inputs.map((inputName) => (
                      <div key={inputName} className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 w-4">{inputName}</span>
                        <div
                          className={`
                            w-16 h-1 rounded transition-colors
                            ${inputs[inputName] ? "bg-green-500" : "bg-gray-600"}
                          `}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Gate box */}
                  <div
                    className={`
                      px-6 py-4 rounded-lg border-2 transition-all
                      ${
                        Object.values(outputs).some(Boolean)
                          ? "border-green-500 bg-green-500/10"
                          : "border-gray-600 bg-gray-800"
                      }
                    `}
                  >
                    <span className="font-mono font-bold text-lg">{activeTemplate.name}</span>
                  </div>

                  {/* Output signals */}
                  <div className="flex flex-col gap-4">
                    {Object.entries(outputs).map(([name, value]) => (
                      <div key={name} className="flex items-center gap-2">
                        <div
                          className={`
                            w-16 h-1 rounded transition-colors
                            ${value ? "bg-green-500" : "bg-gray-600"}
                          `}
                        />
                        <span className="text-sm text-gray-400 w-12">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Outputs */}
              <div>
                <span className="text-sm text-gray-400 block mb-3">Outputs:</span>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(outputs).map(([name, value]) => (
                    <OutputDisplay key={name} label={name} value={value} />
                  ))}
                </div>
              </div>

              {/* Truth table hint */}
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="text-sm text-gray-400">
                  <span className="text-green-400 font-medium">Try it: </span>
                  {activeTemplateId === "inverter" && "Toggle 'a' to see NOT in action"}
                  {activeTemplateId === "and" && "Both inputs must be 1 for output to be 1"}
                  {activeTemplateId === "or" && "Either input being 1 makes output 1"}
                  {activeTemplateId === "xor" && "Output is 1 when inputs are different"}
                  {activeTemplateId === "halfadder" && "sum = XOR, carry = AND — try a=1, b=1"}
                  {activeTemplateId === "fulladder" && "Try a=1, b=1, cin=1 → sum=1, cout=1 (that's 3 in binary!)"}
                  {activeTemplateId === "mux" && "sel=0 picks 'a', sel=1 picks 'b' — a data router"}
                  {activeTemplateId === "adder2bit" && "Try a=11, b=01 (binary) → sum=100 with overflow!"}
                  {activeTemplateId === "comparator" && "Exactly one output is true at a time"}
                  {activeTemplateId === "decoder" && "Only one output is active — used for memory addressing"}
                  {activeTemplateId === "alu1bit" && "op=00:AND, 01:OR, 10:XOR, 11:ADD — the heart of a CPU!"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Can Build - Showcase */}
      <section className="py-16 px-4 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">
            What you can build
          </h2>
          <p className="text-gray-400 text-center mb-10">
            These aren&apos;t just diagrams — they&apos;re fully simulated circuits
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Snake Game */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-green-500/50 transition-colors">
              <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                {/* Animated snake preview */}
                <div className="grid grid-cols-8 gap-0.5 p-4">
                  {Array.from({ length: 64 }).map((_, i) => {
                    const snakePositions = [27, 28, 29, 30, 31]; // Snake body
                    const foodPosition = 42;
                    const isSnake = snakePositions.includes(i);
                    const isFood = i === foodPosition;
                    return (
                      <div
                        key={i}
                        className={`
                          w-3 h-3 rounded-sm transition-colors
                          ${isSnake ? "bg-green-500" : isFood ? "bg-red-500" : "bg-gray-700"}
                        `}
                      />
                    );
                  })}
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  477 lines
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">Snake Game</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Full game with keyboard input, collision detection, food spawning, and 8x8 pixel display
                </p>
                <div className="flex flex-wrap gap-1">
                  {["RAM", "Registers", "State Machine", "Screen"].map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-700 text-xs rounded text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 6502 CPU */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-green-500/50 transition-colors">
              <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                <div className="text-center">
                  <div className="text-4xl mb-2">🖥️</div>
                  <div className="font-mono text-sm text-green-400">
                    LDA #$48<br/>
                    STA $F000<br/>
                    JMP $C000
                  </div>
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  2000+ lines
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">6502 CPU</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Classic 8-bit processor running real assembly. Compiles C code with cc65 toolchain.
                </p>
                <div className="flex flex-wrap gap-1">
                  {["ALU", "Registers", "ROM", "Console"].map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-700 text-xs rounded text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Your Project */}
            <div className="bg-gray-800 rounded-xl border border-dashed border-gray-600 overflow-hidden hover:border-green-500/50 transition-colors">
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-50">?</div>
                  <div className="text-gray-500 text-sm">Your creation</div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">What will you build?</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Calculator? UART? GPU? Game console? The building blocks are all here.
                </p>
                <Link
                  href="/"
                  className="inline-block px-3 py-1.5 bg-green-500 text-gray-900 text-sm font-medium rounded hover:bg-green-400 transition-colors"
                >
                  Start Building
                </Link>
              </div>
            </div>
          </div>

          {/* Code snippet preview */}
          <div className="mt-10 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
              <span className="text-sm text-gray-400">SnakeAdvanced.dsl — Collision Detection</span>
              <span className="text-xs text-gray-500">Lines 182-192</span>
            </div>
            <pre className="p-4 font-mono text-sm overflow-x-auto text-gray-300">
              <code>{`    // Collision detection: nextHead position == food position
    node nextHeadAtFoodX: Comparator
    node nextHeadAtFoodY: Comparator
    connect nextHeadX.out -> nextHeadAtFoodX.a
    connect foodX.q -> nextHeadAtFoodX.b
    connect nextHeadY.out -> nextHeadAtFoodY.a
    connect foodY.q -> nextHeadAtFoodY.b

    node willEatFood: And
    connect nextHeadAtFoodX.eq -> willEatFood.a
    connect nextHeadAtFoodY.eq -> willEatFood.b`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to build your own?
          </h2>
          <p className="text-gray-400 mb-6">
            Open the full editor with visual canvas, simulation, and more.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-green-500 text-gray-900 rounded-lg font-semibold text-lg hover:bg-green-400 transition-colors"
          >
            Open Full Editor
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-400">
          Built for the curious. Start with NAND, end with a CPU.
        </div>
      </footer>
    </div>
  );
}

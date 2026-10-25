// Reference designs for the import half of the differential test. The JSON
// beside this file is yosys's netlist of it, regenerated with:
//   yosys -p "read_verilog -sv imports.v; proc; opt_clean; memory_collect; write_json imports.json"
// The simulator runs the imported netlist, iverilog runs this source.

// Plain clocked logic: should import and simulate exactly.
module acc (
  input clk,
  input [7:0] x,
  input en,
  output reg [7:0] total
);
  initial total = 0;
  always @(posedge clk) if (en) total <= total + x;
endmodule

// A falling-edge register in front of a rising-edge one. In hardware a value
// crosses both in one cycle; imported as two rising-edge registers it takes two.
module negedge_pipe (
  input clk,
  input [7:0] d,
  output reg [7:0] q
);
  reg [7:0] r;
  initial r = 0;
  initial q = 0;
  always @(negedge clk) r <= d;
  always @(posedge clk) q <= r;
endmodule

// Shift amount wider than the result.
module wide_shift (
  input [3:0] a,
  input [4:0] b,
  output [3:0] l,
  output [3:0] r
);
  assign l = a << b;
  assign r = a >> b;
endmodule

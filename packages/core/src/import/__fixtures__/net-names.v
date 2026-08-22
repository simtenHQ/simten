// Fixture for naming imported nodes after the RTL signals they drive.
//
// Covers the four cases the naming pass has to tell apart:
//   result_add / add_cy — one adder over two whole named nets (name it after
//                         bit 0, the value rather than the carry)
//   masked             — a whole named net from one cell (plain rename)
//   split              — two cells each driving half of one named net (neither
//                         may claim it)
//   named_leaf         — an instance the author named (keeps its own name)
module leaf(input a, input b, output y);
  assign y = a & b;
endmodule

module net_names(
  input  wire [3:0] x,
  input  wire [3:0] y,
  output wire [4:0] o_sum,
  output wire [3:0] o_masked,
  output wire [3:0] o_split,
  output wire       o_leaf
);
  wire [3:0] result_add;
  wire       add_cy;
  assign {add_cy, result_add} = x + y;
  assign o_sum = {add_cy, result_add};

  wire [3:0] masked;
  assign masked = x & y;
  assign o_masked = masked;

  wire [3:0] split;
  assign split[1:0] = x[1:0] | y[1:0];
  assign split[3:2] = x[3:2] ^ y[3:2];
  assign o_split = split;

  leaf named_leaf (.a(x[0]), .b(y[0]), .y(o_leaf));
endmodule

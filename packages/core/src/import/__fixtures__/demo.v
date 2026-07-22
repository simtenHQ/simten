// Verilog import spike fixture — deliberately engineered to force the hard paths.
//   - signed 4->8 widening feeding $add  (yosys lowers to unsigned $add + MSB
//     bit-replication in the A array: [run][msb*N] — the sign-extension splice)
//   - {hi,lo} concat crossing the module boundary into u_sub  (multi-driver splice)
//   - $eq / $mux / $dff  plus one level of hierarchy
// mux select is an independent `sel` input (NOT eq) so both branches are
// distinguishable when b != wide.
// Generated JSON via yosys 0.64:
//   yosys -p "read_verilog demo.v; hierarchy -top top; proc; opt_clean; memory_collect; write_json demo.json"

module sub (
    input        clk,
    input  [7:0] din,
    output reg [7:0] dout
);
    always @(posedge clk)
        dout <= din;          // $dff — sequential, and a module boundary
endmodule

module top (
    input               clk,
    input signed  [3:0] sa,   // signed narrow operand
    input         [7:0] b,
    input         [3:0] hi,
    input         [3:0] lo,
    input               sel,  // independent mux select
    output        [7:0] wide,   // sign-extended sa + b   ($add, signed widening)
    output        [7:0] regd,   // {hi,lo} registered via submodule (concat across boundary)
    output              eq,     // b == wide              ($eq)
    output        [7:0] muxed   // sel ? b : wide         ($mux)
);
    wire signed [7:0] sa_ext = sa;     // 4->8 sign extension
    assign wide  = sa_ext + b;
    assign eq    = (b == wide);
    assign muxed = sel ? b : wide;

    sub u_sub (.clk(clk), .din({hi, lo}), .dout(regd));
endmodule

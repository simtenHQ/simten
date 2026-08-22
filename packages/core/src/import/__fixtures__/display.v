// Fixture for import-print-cells.test.ts — a design whose only unusual feature
// is a $display. yosys lifts that to a `$print` cell, which has no hardware
// meaning; the importer must drop it with a warning rather than throw.
//
// Regenerate: yosys -p "read_verilog -sv display.v; hierarchy -top display_demo;
//   proc; opt_clean; memory_collect; write_json display.json"
module display_demo (
    input wire clk,
    input wire [7:0] a,
    output wire [7:0] y
);
  assign y = a + 8'd1;
  always @(posedge clk) $display("a = %d", a);
endmodule

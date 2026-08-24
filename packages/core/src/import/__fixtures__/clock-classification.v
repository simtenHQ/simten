// Two things that used to fail the clock check even though neither is a clock
// problem at all.
//
// `passthrough` takes a `clk` it never reads — NES mappers do this, and a port
// with no consumers used to count against the parent's clock.
//
// The `$display` becomes a `$print` cell whose trigger hangs off the clock net.
// It is already dropped when lifting, but it used to count as a data consumer
// of `clk` first, which failed the import over a debug statement.
module passthrough (
    input        clk,          // deliberately unused
    input  [7:0] d,
    output [7:0] q
);
    assign q = ~d;
endmodule

module clock_classification (
    input            clk,
    input      [7:0] d,
    output reg [7:0] latched,
    output     [7:0] inverted
);
    passthrough child (.clk(clk), .d(d), .q(inverted));

    initial latched = 8'd0;
    always @(posedge clk) begin
        latched <= d;
        $display("latched %h", d);
    end
endmodule

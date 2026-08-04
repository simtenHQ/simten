module ripple_counter(input clk, input rst_n, output [3:0] q);
  reg [3:0] r;
  always @(posedge clk or negedge rst_n)  if (!rst_n) r[0] <= 0; else r[0] <= ~r[0];
  always @(posedge r[0] or negedge rst_n) if (!rst_n) r[1] <= 0; else r[1] <= ~r[1];
  always @(posedge r[1] or negedge rst_n) if (!rst_n) r[2] <= 0; else r[2] <= ~r[2];
  always @(posedge r[2] or negedge rst_n) if (!rst_n) r[3] <= 0; else r[3] <= ~r[3];
  assign q = r;
endmodule

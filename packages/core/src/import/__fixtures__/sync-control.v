module sync_counter(input clk, input rst_n, input en, output reg [3:0] q);
  always @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 0; else if (en) q <= q + 1;
endmodule
module shift_reg(input clk, input din, output reg [7:0] q);
  always @(posedge clk) q <= {q[6:0], din};
endmodule
module traffic(input clk, input rst_n, output reg [1:0] light);
  reg [3:0] t;
  always @(posedge clk or negedge rst_n)
    if (!rst_n) begin t <= 0; light <= 0; end
    else if (t == 9) begin t <= 0; light <= light + 1; end
    else t <= t + 1;
endmodule

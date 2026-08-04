module blinky(input clk, output reg led);
  reg [15:0] div;
  always @(posedge clk) div <= div + 1;
  always @(posedge div[15]) led <= ~led;   // classic beginner clock divider
endmodule

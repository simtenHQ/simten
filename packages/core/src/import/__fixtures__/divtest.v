module divtest(input [7:0] a, input [7:0] b, output [7:0] uq, output [7:0] ur,
               output signed [7:0] sq, output signed [7:0] sr, output xn);
  wire signed [7:0] sa = a, sb = b;
  assign uq = a / b;
  assign ur = a % b;
  assign sq = sa / sb;
  assign sr = sa % sb;
  assign xn = ~^a;
endmodule

module syncfifo(clk, reset, write_en, read_en, data_in, full, empty, out);
input clk,reset,write_en,read_en;
input [7:0] data_in;
output full,empty;
output reg [7:0] out;
reg [7:0] memory_vec [0:7];
reg [2:0] write_pointer;
reg [2:0] read_pointer;
reg [3:0] count;
assign full = (count == 8);
assign empty = (count == 4'b0);
always @(posedge clk or negedge reset) begin
  if(!reset) write_pointer <= 3'b0;
  else if(write_en == 1 && !full) begin memory_vec[write_pointer] <= data_in; write_pointer <= write_pointer + 1'b1; end
end
always @(posedge clk or negedge reset) begin
  if(!reset) read_pointer <= 3'b0;
  else if(read_en == 1 && !empty) begin out <= memory_vec[read_pointer]; read_pointer <= read_pointer + 1'b1; end
end
always @(posedge clk or negedge reset) begin
  if(!reset) count <= 4'b0;
  else case({write_en,read_en}) 2'b10: count <= count + 1'b1; 2'b01: count <= count - 1'b1; default: count <= count; endcase
end
endmodule

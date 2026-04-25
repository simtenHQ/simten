// Standalone UART test — no CPU, just sends "HELLO\r\n" repeatedly.
// Confirms pin L4 and UART module work before debugging the CPU.
module uart_test_top (
    input  clk_25mhz,
    output uart_tx
);
    localparam CLKS_PER_BIT = 217;  // 25 MHz / 115200

    // ── Message ROM ──────────────────────────────────────────────────────────
    reg [7:0] msg [0:6];
    initial begin
        msg[0] = 8'h48; // H
        msg[1] = 8'h45; // E
        msg[2] = 8'h4C; // L
        msg[3] = 8'h4C; // L
        msg[4] = 8'h4F; // O
        msg[5] = 8'h0D; // \r
        msg[6] = 8'h0A; // \n
    end

    // ── UART TX ───────────────────────────────────────────────────────────────
    reg [8:0]  shift     = 9'd0;
    reg [3:0]  bits_left = 4'd0;
    reg [7:0]  cnt       = 8'd0;
    reg        busy      = 1'b0;
    reg        tx        = 1'b1;

    assign uart_tx = tx;

    // ── Sequencer ─────────────────────────────────────────────────────────────
    reg [2:0]  char_idx  = 3'd0;
    reg [24:0] gap_cnt   = 25'd0;  // ~1.3 sec inter-message gap
    reg        sending   = 1'b0;

    always @(posedge clk_25mhz) begin
        if (!busy) begin
            if (sending) begin
                if (char_idx < 7) begin
                    // Start next byte
                    shift     <= {1'b1, msg[char_idx]};
                    bits_left <= 4'd9;
                    cnt       <= 8'd0;
                    tx        <= 1'b0;  // start bit
                    busy      <= 1'b1;
                    char_idx  <= char_idx + 1;
                end else begin
                    // Done — wait before repeating
                    sending  <= 1'b0;
                    gap_cnt  <= 25'd0;
                    char_idx <= 3'd0;
                end
            end else begin
                gap_cnt <= gap_cnt + 1;
                if (gap_cnt == 25'd24999999) begin  // ~1 sec
                    sending <= 1'b1;
                end
            end
        end else begin
            if (cnt == CLKS_PER_BIT - 1) begin
                cnt <= 8'd0;
                if (bits_left == 4'd0) begin
                    busy <= 1'b0;
                    tx   <= 1'b1;
                end else begin
                    tx        <= shift[0];
                    shift     <= {1'b1, shift[8:1]};
                    bits_left <= bits_left - 4'd1;
                end
            end else begin
                cnt <= cnt + 8'd1;
            end
        end
    end
endmodule

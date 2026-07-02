`timescale 1ns / 1ps

module Breakout (
  input clk,
  input rst_n,
  input [8:0] scan_addr,
  input [7:0] keyboard,
  input game_en,
  output [7:0] pixel_out,
  output is_filling
);

  wire [7:0] w_scanX_out;
  wire [8:0] w_scanY_result;
  wire [7:0] w_leftCode_out;
  wire [7:0] w_rightCode_out;
  wire [7:0] w_c5_out;
  wire [7:0] w_scanYsh_result;
  wire w_c0_out;
  wire [7:0] w_scanBrickAddr_sum;
  wire [7:0] w_c4_out;
  wire [7:0] w_brickRAM_outB;
  wire w_scanInBrickArea_lt;
  wire w_brickAlive_gt;
  wire [7:0] w_ballX_q;
  wire [7:0] w_ballY_q;
  wire w_cmpBallX_eq;
  wire w_cmpBallY_eq;
  wire w_scanYsplit_bit4;
  wire w_scanYsplit_bit5;
  wire w_scanYsplit_bit6;
  wire w_scanYsplit_bit7;
  wire w_scanYsplit_bit0;
  wire w_scanYsplit_bit1;
  wire w_scanYsplit_bit2;
  wire w_scanYsplit_bit3;
  wire w_isScanY15a_out;
  wire w_isScanY15b_out;
  wire w_notScanY4_out;
  wire w_notScanY5_out;
  wire w_notScanY6_out;
  wire w_notScanY7_out;
  wire w_isScanY15d_out;
  wire w_isScanY15e_out;
  wire w_isScanY15c_out;
  wire w_isScanY15f_out;
  wire [7:0] w_paddleX_q;
  wire [7:0] w_c253_out;
  wire [7:0] w_c2_out;
  wire [7:0] w_padMinRaw_sum;
  wire w_cmpScanGteMin_lt;
  wire [7:0] w_padMaxRaw_sum;
  wire w_cmpScanLteMax_lt;
  wire w_notLtPadMin_out;
  wire w_notGtPadMax_out;
  wire w_isScanY15_out;
  wire w_inPadRange_out;
  wire w_ballPixel_out;
  wire w_paddlePixel_out;
  wire w_pixOr1_out;
  wire w_brickPixel_out;
  wire [7:0] w_c1_out;
  wire w_pixOr2_out;
  wire [7:0] w_pixelBus_out;
  wire [7:0] w_ballSpeedCtr_q;
  wire [7:0] w_ballSpeedMax_out;
  wire [7:0] w_ballSpeedInc_sum;
  wire w_ballSpeedAtMax_eq;
  wire [7:0] w_nextBallSpeed_out;
  wire [7:0] w_padSpeedCtr_q;
  wire [7:0] w_padSpeedMax_out;
  wire [7:0] w_padSpeedInc_sum;
  wire w_padSpeedAtMax_eq;
  wire [7:0] w_nextPadSpeed_out;
  wire [7:0] w_c127_out;
  wire [7:0] w_ballDX_q;
  wire w_movingLeftCmp_lt;
  wire w_movingLeft_out;
  wire [7:0] w_ballDY_q;
  wire w_movingUpCmp_lt;
  wire w_movingUp_out;
  wire w_ballAtLeft_lt;
  wire [7:0] w_c30_out;
  wire w_ballAtRight_lt;
  wire w_notBallLtRight_out;
  wire w_notMovingLeft_out;
  wire w_hitLeft_out;
  wire w_hitRight_out;
  wire w_ballAtTop_eq;
  wire [7:0] w_dxNegated_difference;
  wire w_flipDX_out;
  wire [7:0] w_newDXbeforePaddle_out;
  wire [7:0] w_dyNegated_difference;
  wire w_hitTop_out;
  wire [7:0] w_topBouncedDY_out;
  wire [7:0] w_nextBallYraw_sum;
  wire [7:0] w_brickDY_out;
  wire [7:0] w_reflectY_sum;
  wire [7:0] w_nextYsh_result;
  wire [7:0] w_nextBallXraw_sum;
  wire [7:0] w_brickRAM_outA;
  wire w_nextInBrickArea_lt;
  wire w_brickAtNext_gt;
  wire w_hitBrickRaw_out;
  wire [7:0] w_c14_out;
  wire w_cmpNextGteMin_lt;
  wire w_cmpNextLteMax_lt;
  wire w_notNextLtMin_out;
  wire w_notNextGtMax_out;
  wire w_nextYis14_eq;
  wire w_nextInPadRange_out;
  wire w_paddleHitCheck_out;
  wire w_movingDown_out;
  wire [7:0] w_padOffset_difference;
  wire [7:0] w_c254_out;
  wire w_offsetLt254_lt;
  wire w_isFarRight_eq;
  wire [7:0] w_paddleDXa_out;
  wire [7:0] w_c255_out;
  wire w_isMidLeft_out;
  wire [7:0] w_paddleDXb_out;
  wire w_isFarLeft_eq;
  wire [7:0] w_paddleDXc_out;
  wire w_hitPaddle_out;
  wire w_flipDYa_out;
  wire w_hitBrick_out;
  wire [7:0] w_topDYneg_difference;
  wire w_paddleBrickFlipDY_out;
  wire [7:0] w_c15_out;
  wire w_nextYlt15_lt;
  wire w_nextYge15_out;
  wire w_ballAtBottom_out;
  wire w_notHitPaddle_out;
  wire [7:0] w_resetX_out;
  wire w_ballMissed_out;
  wire [7:0] w_resetY_out;
  wire [7:0] w_newDX_out;
  wire [7:0] w_resetDX_out;
  wire [7:0] w_finalDY_out;
  wire [7:0] w_resetDY_out;
  wire [7:0] w_actualBallX_out;
  wire [7:0] w_actualBallY_out;
  wire [7:0] w_actualDX_out;
  wire [7:0] w_actualDY_out;
  wire w_ballUpdate_out;
  wire w_notFilling_out;
  wire w_ballAndFill_out;
  wire w_isLeftCmp_eq;
  wire [7:0] w_paddleDelta_out;
  wire w_isRightCmp_eq;
  wire [7:0] w_paddleDelta2_out;
  wire [7:0] w_paddleXnewRaw_sum;
  wire [7:0] w_c3_out;
  wire [7:0] w_c28_out;
  wire w_paddleAtMin_lt;
  wire [7:0] w_paddleClamped1_out;
  wire w_paddleAtMax_gt;
  wire [7:0] w_newPaddleX_out;
  wire w_paddleUpdate_out;
  wire [7:0] w_fillCtr_q;
  wire [7:0] w_c128_out;
  wire [7:0] w_fillCtrInc_sum;
  wire w_isFilling_lt;
  wire [7:0] w_fillNext_out;
  wire w_onMissVblank_out;
  wire [7:0] w_fillCtrData_out;
  wire w_fillCtrWe_out;
  wire w_brickHitWe_out;
  wire w_fillWe_out;
  wire [7:0] w_nextBrickAddr_sum;
  wire [7:0] w_brickRAMaddrA_out;
  wire [7:0] w_brickRAMdataA_out;
  wire w_brickRAMweA_out;

  reg [7:0] mem_brickRAM [0:255];
  reg [7:0] reg_ballX;
  reg [7:0] reg_ballY;
  reg [7:0] reg_ballDX;
  reg [7:0] reg_ballDY;
  reg [7:0] reg_paddleX;
  reg [7:0] reg_ballSpeedCtr;
  reg [7:0] reg_padSpeedCtr;
  reg [7:0] reg_fillCtr;

  // DualPortRAM "brickRAM"
  // Write-first DualPortRAM (writes suppressed during reset; contents preserved)
  always @(posedge clk) begin
    if (w_brickRAMweA_out && rst_n) mem_brickRAM[w_brickRAMaddrA_out] <= w_brickRAMdataA_out;
  end
  assign w_brickRAM_outA = mem_brickRAM[w_brickRAMaddrA_out];
  assign w_brickRAM_outB = mem_brickRAM[w_scanBrickAddr_sum];

  // BitSlice "scanX"
  assign w_scanX_out = scan_addr[4:0];

  // RightShifter "scanY"
  assign w_scanY_result = scan_addr >> w_c5_out;

  // Constant "c0"
  assign w_c0_out = 8'd0;

  // Constant "c1"
  assign w_c1_out = 8'd1;

  // Constant "c2"
  assign w_c2_out = 8'd2;

  // Constant "c3"
  assign w_c3_out = 8'd3;

  // Constant "c4"
  assign w_c4_out = 8'd4;

  // Constant "c5"
  assign w_c5_out = 8'd5;

  // Constant "c14"
  assign w_c14_out = 8'd14;

  // Constant "c15"
  assign w_c15_out = 8'd15;

  // Constant "c16"
  assign __unused_out = 8'd16;

  // Constant "c28"
  assign w_c28_out = 8'd28;

  // Constant "c29"
  assign __unused_out = 8'd29;

  // Constant "c30"
  assign w_c30_out = 8'd30;

  // Constant "c31"
  assign __unused_out = 8'd31;

  // Constant "c32"
  assign __unused_out = 8'd32;

  // Constant "c253"
  assign w_c253_out = 8'd253;

  // Constant "c254"
  assign w_c254_out = 8'd254;

  // Constant "c255"
  assign w_c255_out = 8'd255;

  // Register "ballX"
  initial reg_ballX = 8'd16;
  always @(posedge clk) begin
    if (!rst_n) reg_ballX <= 8'd16;
    else if (w_ballAndFill_out) reg_ballX <= w_actualBallX_out;
  end
  assign w_ballX_q = reg_ballX;

  // Register "ballY"
  initial reg_ballY = 8'd8;
  always @(posedge clk) begin
    if (!rst_n) reg_ballY <= 8'd8;
    else if (w_ballAndFill_out) reg_ballY <= w_actualBallY_out;
  end
  assign w_ballY_q = reg_ballY;

  // Register "ballDX"
  initial reg_ballDX = 8'd1;
  always @(posedge clk) begin
    if (!rst_n) reg_ballDX <= 8'd1;
    else if (w_ballAndFill_out) reg_ballDX <= w_actualDX_out;
  end
  assign w_ballDX_q = reg_ballDX;

  // Register "ballDY"
  initial reg_ballDY = 8'd255;
  always @(posedge clk) begin
    if (!rst_n) reg_ballDY <= 8'd255;
    else if (w_ballAndFill_out) reg_ballDY <= w_actualDY_out;
  end
  assign w_ballDY_q = reg_ballDY;

  // Register "paddleX"
  initial reg_paddleX = 8'd15;
  always @(posedge clk) begin
    if (!rst_n) reg_paddleX <= 8'd15;
    else if (w_paddleUpdate_out) reg_paddleX <= w_newPaddleX_out;
  end
  assign w_paddleX_q = reg_paddleX;

  // Constant "leftCode"
  assign w_leftCode_out = 8'd75;

  // Constant "rightCode"
  assign w_rightCode_out = 8'd77;

  // Comparator "isLeftCmp"
  assign w_isLeftCmp_eq = (keyboard == w_leftCode_out);

  // Comparator "isRightCmp"
  assign w_isRightCmp_eq = (keyboard == w_rightCode_out);

  // LeftShifter "scanYsh"
  assign w_scanYsh_result = w_scanY_result << w_c5_out;

  // Adder "scanBrickAddr"
  assign w_scanBrickAddr_sum = w_scanYsh_result + w_scanX_out + w_c0_out;

  // Comparator "scanInBrickArea"
  assign w_scanInBrickArea_lt = (w_scanY_result < w_c4_out);

  // Comparator "brickAlive"
  assign w_brickAlive_gt = (w_brickRAM_outB > w_c0_out);

  // And "brickPixel"
  assign w_brickPixel_out = w_scanInBrickArea_lt & w_brickAlive_gt;

  // Comparator "cmpBallX"
  assign w_cmpBallX_eq = (w_scanX_out == w_ballX_q);

  // Comparator "cmpBallY"
  assign w_cmpBallY_eq = (w_scanY_result == w_ballY_q);

  // And "ballPixel"
  assign w_ballPixel_out = w_cmpBallX_eq & w_cmpBallY_eq;

  // Splitter8to8 "scanYsplit"
  assign w_scanYsplit_bit0 = w_scanY_result[0];
  assign w_scanYsplit_bit1 = w_scanY_result[1];
  assign w_scanYsplit_bit2 = w_scanY_result[2];
  assign w_scanYsplit_bit3 = w_scanY_result[3];
  assign w_scanYsplit_bit4 = w_scanY_result[4];
  assign w_scanYsplit_bit5 = w_scanY_result[5];
  assign w_scanYsplit_bit6 = w_scanY_result[6];
  assign w_scanYsplit_bit7 = w_scanY_result[7];

  // Not "notScanY4"
  assign w_notScanY4_out = ~w_scanYsplit_bit4;

  // Not "notScanY5"
  assign w_notScanY5_out = ~w_scanYsplit_bit5;

  // Not "notScanY6"
  assign w_notScanY6_out = ~w_scanYsplit_bit6;

  // Not "notScanY7"
  assign w_notScanY7_out = ~w_scanYsplit_bit7;

  // And "isScanY15a"
  assign w_isScanY15a_out = w_scanYsplit_bit0 & w_scanYsplit_bit1;

  // And "isScanY15b"
  assign w_isScanY15b_out = w_scanYsplit_bit2 & w_scanYsplit_bit3;

  // And "isScanY15c"
  assign w_isScanY15c_out = w_isScanY15a_out & w_isScanY15b_out;

  // And "isScanY15d"
  assign w_isScanY15d_out = w_notScanY4_out & w_notScanY5_out;

  // And "isScanY15e"
  assign w_isScanY15e_out = w_notScanY6_out & w_notScanY7_out;

  // And "isScanY15f"
  assign w_isScanY15f_out = w_isScanY15d_out & w_isScanY15e_out;

  // And "isScanY15"
  assign w_isScanY15_out = w_isScanY15c_out & w_isScanY15f_out;

  // Adder "padMinRaw"
  assign w_padMinRaw_sum = w_paddleX_q + w_c253_out + w_c0_out;

  // Adder "padMaxRaw"
  assign w_padMaxRaw_sum = w_paddleX_q + w_c2_out + w_c0_out;

  // Comparator "cmpScanGteMin"
  assign w_cmpScanGteMin_lt = (w_scanX_out < w_padMinRaw_sum);

  // Not "notLtPadMin"
  assign w_notLtPadMin_out = ~w_cmpScanGteMin_lt;

  // Comparator "cmpScanLteMax"
  assign w_cmpScanLteMax_lt = (w_padMaxRaw_sum < w_scanX_out);

  // Not "notGtPadMax"
  assign w_notGtPadMax_out = ~w_cmpScanLteMax_lt;

  // And "inPadRange"
  assign w_inPadRange_out = w_notLtPadMin_out & w_notGtPadMax_out;

  // And "paddlePixel"
  assign w_paddlePixel_out = w_isScanY15_out & w_inPadRange_out;

  // Or "pixOr1"
  assign w_pixOr1_out = w_ballPixel_out | w_paddlePixel_out;

  // Or "pixOr2"
  assign w_pixOr2_out = w_pixOr1_out | w_brickPixel_out;

  // Mux "pixelBus"
  assign w_pixelBus_out = w_pixOr2_out ? w_c1_out : w_c0_out;

  // Register "ballSpeedCtr"
  initial reg_ballSpeedCtr = 8'd0;
  always @(posedge clk) begin
    if (!rst_n) reg_ballSpeedCtr <= 8'd0;
    else if (game_en) reg_ballSpeedCtr <= w_nextBallSpeed_out;
  end
  assign w_ballSpeedCtr_q = reg_ballSpeedCtr;

  // Adder "ballSpeedInc"
  assign w_ballSpeedInc_sum = w_ballSpeedCtr_q + w_c1_out + w_c0_out;

  // Constant "ballSpeedMax"
  assign w_ballSpeedMax_out = 8'd3;

  // Comparator "ballSpeedAtMax"
  assign w_ballSpeedAtMax_eq = (w_ballSpeedCtr_q == w_ballSpeedMax_out);

  // Mux "nextBallSpeed"
  assign w_nextBallSpeed_out = w_ballSpeedAtMax_eq ? w_c0_out : w_ballSpeedInc_sum;

  // And "ballUpdate"
  assign w_ballUpdate_out = game_en & w_ballSpeedAtMax_eq;

  // Register "padSpeedCtr"
  initial reg_padSpeedCtr = 8'd0;
  always @(posedge clk) begin
    if (!rst_n) reg_padSpeedCtr <= 8'd0;
    else if (game_en) reg_padSpeedCtr <= w_nextPadSpeed_out;
  end
  assign w_padSpeedCtr_q = reg_padSpeedCtr;

  // Adder "padSpeedInc"
  assign w_padSpeedInc_sum = w_padSpeedCtr_q + w_c1_out + w_c0_out;

  // Constant "padSpeedMax"
  assign w_padSpeedMax_out = 8'd1;

  // Comparator "padSpeedAtMax"
  assign w_padSpeedAtMax_eq = (w_padSpeedCtr_q == w_padSpeedMax_out);

  // Mux "nextPadSpeed"
  assign w_nextPadSpeed_out = w_padSpeedAtMax_eq ? w_c0_out : w_padSpeedInc_sum;

  // And "paddleUpdate"
  assign w_paddleUpdate_out = game_en & w_padSpeedAtMax_eq;

  // Comparator "movingLeftCmp"
  assign w_movingLeftCmp_lt = (w_c127_out < w_ballDX_q);

  // Constant "c127"
  assign w_c127_out = 8'd127;

  // Buffer "movingLeft"
  assign w_movingLeft_out = w_movingLeftCmp_lt;

  // Not "notMovingLeft"
  assign w_notMovingLeft_out = ~w_movingLeft_out;

  // Comparator "movingUpCmp"
  assign w_movingUpCmp_lt = (w_c127_out < w_ballDY_q);

  // Buffer "movingUp"
  assign w_movingUp_out = w_movingUpCmp_lt;

  // Not "movingDown"
  assign w_movingDown_out = ~w_movingUp_out;

  // Comparator "ballAtLeft"
  assign w_ballAtLeft_lt = (w_ballX_q < w_c2_out);

  // And "hitLeft"
  assign w_hitLeft_out = w_ballAtLeft_lt & w_movingLeft_out;

  // Comparator "ballAtRight"
  assign w_ballAtRight_lt = (w_ballX_q < w_c30_out);

  // Not "notBallLtRight"
  assign w_notBallLtRight_out = ~w_ballAtRight_lt;

  // And "hitRight"
  assign w_hitRight_out = w_notBallLtRight_out & w_notMovingLeft_out;

  // Or "flipDX"
  assign w_flipDX_out = w_hitLeft_out | w_hitRight_out;

  // Comparator "ballAtTop"
  assign w_ballAtTop_eq = (w_ballY_q == w_c0_out);

  // And "hitTop"
  assign w_hitTop_out = w_ballAtTop_eq & w_movingUp_out;

  // Subtractor "dxNegated"
  assign w_dxNegated_difference = w_c0_out - w_ballDX_q - w_c0_out;

  // Mux "newDXbeforePaddle"
  assign w_newDXbeforePaddle_out = w_flipDX_out ? w_dxNegated_difference : w_ballDX_q;

  // Adder "nextBallXraw"
  assign w_nextBallXraw_sum = w_ballX_q + w_newDXbeforePaddle_out + w_c0_out;

  // Subtractor "dyNegated"
  assign w_dyNegated_difference = w_c0_out - w_ballDY_q - w_c0_out;

  // Mux "topBouncedDY"
  assign w_topBouncedDY_out = w_hitTop_out ? w_dyNegated_difference : w_ballDY_q;

  // Adder "nextBallYraw"
  assign w_nextBallYraw_sum = w_ballY_q + w_topBouncedDY_out + w_c0_out;

  // LeftShifter "nextYsh"
  assign w_nextYsh_result = w_nextBallYraw_sum << w_c5_out;

  // Adder "nextBrickAddr"
  assign w_nextBrickAddr_sum = w_nextYsh_result + w_nextBallXraw_sum + w_c0_out;

  // Comparator "nextInBrickArea"
  assign w_nextInBrickArea_lt = (w_nextBallYraw_sum < w_c4_out);

  // Comparator "brickAtNext"
  assign w_brickAtNext_gt = (w_brickRAM_outA > w_c0_out);

  // And "hitBrickRaw"
  assign w_hitBrickRaw_out = w_nextInBrickArea_lt & w_brickAtNext_gt;

  // And "hitBrick"
  assign w_hitBrick_out = w_hitBrickRaw_out & w_movingUp_out;

  // Comparator "nextYis14"
  assign w_nextYis14_eq = (w_nextBallYraw_sum == w_c14_out);

  // Comparator "cmpNextGteMin"
  assign w_cmpNextGteMin_lt = (w_nextBallXraw_sum < w_padMinRaw_sum);

  // Not "notNextLtMin"
  assign w_notNextLtMin_out = ~w_cmpNextGteMin_lt;

  // Comparator "cmpNextLteMax"
  assign w_cmpNextLteMax_lt = (w_padMaxRaw_sum < w_nextBallXraw_sum);

  // Not "notNextGtMax"
  assign w_notNextGtMax_out = ~w_cmpNextLteMax_lt;

  // And "nextInPadRange"
  assign w_nextInPadRange_out = w_notNextLtMin_out & w_notNextGtMax_out;

  // And "paddleHitCheck"
  assign w_paddleHitCheck_out = w_nextYis14_eq & w_nextInPadRange_out;

  // And "hitPaddle"
  assign w_hitPaddle_out = w_paddleHitCheck_out & w_movingDown_out;

  // Subtractor "padOffset"
  assign w_padOffset_difference = w_nextBallXraw_sum - w_paddleX_q - w_c0_out;

  // Comparator "isFarLeft"
  assign w_isFarLeft_eq = (w_padOffset_difference == w_c253_out);

  // Comparator "offsetLt254"
  assign w_offsetLt254_lt = (w_padOffset_difference < w_c254_out);

  // Not "isMidLeft"
  assign w_isMidLeft_out = ~w_offsetLt254_lt;

  // Comparator "isFarRight"
  assign w_isFarRight_eq = (w_padOffset_difference == w_c2_out);

  // Mux "paddleDXa"
  assign w_paddleDXa_out = w_isFarRight_eq ? w_c2_out : w_c1_out;

  // Mux "paddleDXb"
  assign w_paddleDXb_out = w_isMidLeft_out ? w_c255_out : w_paddleDXa_out;

  // Mux "paddleDXc"
  assign w_paddleDXc_out = w_isFarLeft_eq ? w_c254_out : w_paddleDXb_out;

  // Mux "newDX"
  assign w_newDX_out = w_hitPaddle_out ? w_paddleDXc_out : w_newDXbeforePaddle_out;

  // Or "flipDYa"
  assign w_flipDYa_out = w_hitTop_out | w_hitPaddle_out;

  // Or "flipDY"
  assign __unused_out = w_flipDYa_out | w_hitBrick_out;

  // Mux "newDY"
  assign __unused_out = w_hitPaddle_out ? w_dyNegated_difference : w_topBouncedDY_out;

  // Subtractor "topDYneg"
  assign w_topDYneg_difference = w_c0_out - w_topBouncedDY_out - w_c0_out;

  // Or "paddleBrickFlipDY"
  assign w_paddleBrickFlipDY_out = w_hitPaddle_out | w_hitBrick_out;

  // Mux "finalDY"
  assign w_finalDY_out = w_paddleBrickFlipDY_out ? w_topDYneg_difference : w_topBouncedDY_out;

  // Comparator "nextYlt15"
  assign w_nextYlt15_lt = (w_nextBallYraw_sum < w_c15_out);

  // Not "nextYge15"
  assign w_nextYge15_out = ~w_nextYlt15_lt;

  // And "ballAtBottom"
  assign w_ballAtBottom_out = w_nextYge15_out & w_movingDown_out;

  // Not "notHitPaddle"
  assign w_notHitPaddle_out = ~w_hitPaddle_out;

  // And "ballMissed"
  assign w_ballMissed_out = w_ballAtBottom_out & w_notHitPaddle_out;

  // Constant "resetX"
  assign w_resetX_out = 8'd16;

  // Constant "resetY"
  assign w_resetY_out = 8'd8;

  // Constant "resetDX"
  assign w_resetDX_out = 8'd1;

  // Constant "resetDY"
  assign w_resetDY_out = 8'd255;

  // Mux "actualBallX"
  assign w_actualBallX_out = w_ballMissed_out ? w_resetX_out : w_nextBallXraw_sum;

  // Mux "actualBallY"
  assign w_actualBallY_out = w_ballMissed_out ? w_resetY_out : w_reflectY_sum;

  // Mux "actualDX"
  assign w_actualDX_out = w_ballMissed_out ? w_resetDX_out : w_newDX_out;

  // Mux "actualDY"
  assign w_actualDY_out = w_ballMissed_out ? w_resetDY_out : w_finalDY_out;

  // Mux "brickDY"
  assign w_brickDY_out = w_hitBrick_out ? w_topDYneg_difference : w_topBouncedDY_out;

  // Adder "reflectY"
  assign w_reflectY_sum = w_ballY_q + w_brickDY_out + w_c0_out;

  // Mux "paddleDelta"
  assign w_paddleDelta_out = w_isLeftCmp_eq ? w_c255_out : w_c0_out;

  // Mux "paddleDelta2"
  assign w_paddleDelta2_out = w_isRightCmp_eq ? w_c1_out : w_paddleDelta_out;

  // Adder "paddleXnewRaw"
  assign w_paddleXnewRaw_sum = w_paddleX_q + w_paddleDelta2_out + w_c0_out;

  // Comparator "paddleAtMin"
  assign w_paddleAtMin_lt = (w_paddleXnewRaw_sum < w_c3_out);

  // Comparator "paddleAtMax"
  assign w_paddleAtMax_gt = (w_paddleXnewRaw_sum > w_c28_out);

  // Mux "paddleClamped1"
  assign w_paddleClamped1_out = w_paddleAtMin_lt ? w_c3_out : w_paddleXnewRaw_sum;

  // Mux "newPaddleX"
  assign w_newPaddleX_out = w_paddleAtMax_gt ? w_c28_out : w_paddleClamped1_out;

  // Register "fillCtr"
  initial reg_fillCtr = 8'd0;
  always @(posedge clk) begin
    if (!rst_n) reg_fillCtr <= 8'd0;
    else if (w_fillCtrWe_out) reg_fillCtr <= w_fillCtrData_out;
  end
  assign w_fillCtr_q = reg_fillCtr;

  // Adder "fillCtrInc"
  assign w_fillCtrInc_sum = w_fillCtr_q + w_c1_out + w_c0_out;

  // Comparator "isFilling"
  assign w_isFilling_lt = (w_fillCtr_q < w_c128_out);

  // Constant "c128"
  assign w_c128_out = 8'd128;

  // Mux "fillNext"
  assign w_fillNext_out = w_isFilling_lt ? w_fillCtrInc_sum : w_fillCtr_q;

  // And "onMissVblank"
  assign w_onMissVblank_out = w_ballUpdate_out & w_ballMissed_out;

  // Mux "fillCtrData"
  assign w_fillCtrData_out = w_onMissVblank_out ? w_c0_out : w_fillNext_out;

  // Or "fillCtrWe"
  assign w_fillCtrWe_out = w_isFilling_lt | w_onMissVblank_out;

  // And "brickHitWe"
  assign w_brickHitWe_out = w_ballAndFill_out & w_hitBrick_out;

  // And "fillWe"
  assign w_fillWe_out = w_isFilling_lt & w_c1_out;

  // Or "brickRAMweA"
  assign w_brickRAMweA_out = w_brickHitWe_out | w_fillWe_out;

  // Mux "brickRAMaddrA"
  assign w_brickRAMaddrA_out = w_isFilling_lt ? w_fillCtr_q : w_nextBrickAddr_sum;

  // Mux "brickRAMdataA"
  assign w_brickRAMdataA_out = w_isFilling_lt ? w_c1_out : w_c0_out;

  // Not "notFilling"
  assign w_notFilling_out = ~w_isFilling_lt;

  // And "ballAndFill"
  assign w_ballAndFill_out = w_ballUpdate_out & w_notFilling_out;

  assign pixel_out = w_pixelBus_out;
  assign is_filling = w_isFilling_lt;

endmodule

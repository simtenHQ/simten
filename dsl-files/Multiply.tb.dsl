// Multiply Testbench
// Tests the 8-bit multiplier with various input pairs

testbench MultiplyTest {
  use circuit Multiply as dut

  input a: Bus[8]
  input b: Bus[8]
  output low: Bus[8]
  output high: Bus[8]

  clock clk

  impl {
    node mul: Multiply

    connect a -> mul.a
    connect b -> mul.b
    connect mul.low -> low
    connect mul.high -> high

    stimulus on clk {
      // 3 * 4 = 12 (fits in low byte)
      at 0: a = 3, b = 4

      // 7 * 6 = 42
      at 1: a = 7, b = 6

      // 15 * 20 = 300 (overflows into high byte)
      at 2: a = 15, b = 20

      // 255 * 255 = 65025 (max product)
      at 3: a = 255, b = 255

      // 0 * 100 = 0
      at 4: a = 0, b = 100

      // 1 * 1 = 1
      at 5: a = 1, b = 1
    }

    assert on clk {
      // 3 * 4 = 12 -> high=0, low=12
      at 0: low == 12, "3*4 low byte should be 12"
      at 0: high == 0, "3*4 high byte should be 0"

      // 7 * 6 = 42 -> high=0, low=42
      at 1: low == 42, "7*6 low byte should be 42"
      at 1: high == 0, "7*6 high byte should be 0"

      // 15 * 20 = 300 -> high=1, low=44
      at 2: low == 44, "15*20 low byte should be 44"
      at 2: high == 1, "15*20 high byte should be 1"

      // 255 * 255 = 65025 -> high=254, low=1
      at 3: low == 1, "255*255 low byte should be 1"
      at 3: high == 254, "255*255 high byte should be 254"

      // 0 * 100 = 0 -> high=0, low=0
      at 4: low == 0, "0*100 low byte should be 0"
      at 4: high == 0, "0*100 high byte should be 0"

      // 1 * 1 = 1 -> high=0, low=1
      at 5: low == 1, "1*1 low byte should be 1"
      at 5: high == 0, "1*1 high byte should be 0"
    }
  }
}

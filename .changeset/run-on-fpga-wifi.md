---
"@simten/mcp": minor
---

`run_on_fpga` takes an optional `wifi_host` to flash over Wi-Fi through the ULX3S's onboard ESP32 instead of USB-JTAG. With a compressed bitstream a load takes about 2s, against 5-8s over USB.

#![no_std]
#![no_main]

const UART: *mut u32 = 0x80000000 as *mut u32;

unsafe fn uart_putc(c: u8) {
    while (UART.read_volatile() & 1) == 0 {}
    UART.write_volatile(c as u32);
}

#[no_mangle]
pub extern "C" fn main() -> ! {
    let msg: &[u8] = b"Hello, World!\r\n";
    loop {
        for &c in msg {
            unsafe { uart_putc(c); }
        }
        let mut i = 200000u32;
        while i > 0 {
            unsafe { core::arch::asm!("nop"); }
            i -= 1;
        }
    }
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

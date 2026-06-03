// model_test.h — simten DUT target for riscv-arch-test (old-framework-2.x).
//
// Deliberately a *machine-mode-free* target. The base RV32I-I tests never take
// a trap, so we do NOT define `rvtest_mtrap_routine` (which is what gates the
// entire CSR/trap trampoline inside arch_test.h) nor `rvtest_gpr_save`. With
// both undefined, RVTEST_CODE_BEGIN/END emit only GPR setup + the test body —
// no csrr/csrw at all. See archtest/README.md for the objdump evidence.
//
// HTIF `tohost` exists solely so Spike (the reference model) knows when the
// program is done and dumps the signature. The simten DUT ignores tohost — it
// just spins on the self-loop, and the harness reads [begin_signature,
// end_signature) out of DMEM after a fixed cycle budget. Both the DUT and Spike
// execute the *same* ELF, so the halt sequence is identical for both.

#ifndef _COMPLIANCE_MODEL_H
#define _COMPLIANCE_MODEL_H

//-----------------------------------------------------------------------
// RVMODEL_BOOT — runs at rvtest_entry_point (reset vector 0x0).
// No CSR/privilege setup needed for base RV32I.
//-----------------------------------------------------------------------
#define RVMODEL_BOOT

//-----------------------------------------------------------------------
// RVMODEL_HALT — signal Spike's HTIF (tohost != 0 => stop + dump signature),
// then spin forever. The simten DUT just executes the spin.
//-----------------------------------------------------------------------
#define RVMODEL_HALT                                                          \
        li x1, 1;                                                             \
    write_tohost:                                                            \
        sw x1, tohost, t5;                                                    \
        j write_tohost;

//-----------------------------------------------------------------------
// Signature region delimiters (Spike +signature and the DUT both read these).
//-----------------------------------------------------------------------
#define RVMODEL_DATA_BEGIN                                                     \
        .align 4; .global begin_signature; begin_signature:

#define RVMODEL_DATA_END                                                       \
        .align 4; .global end_signature; end_signature:                       \
        .pushsection .tohost,"aw",@progbits;                                  \
        .align 8; .global tohost; tohost: .dword 0;                           \
        .align 8; .global fromhost; fromhost: .dword 0;                       \
        .popsection;

//-----------------------------------------------------------------------
// IO / interrupt hooks — all no-ops for this target.
//-----------------------------------------------------------------------
#define RVMODEL_IO_INIT
#define RVMODEL_IO_WRITE_STR(_R, _STR)
#define RVMODEL_IO_CHECK()
#define RVMODEL_IO_ASSERT_GPR_EQ(_S, _R, _I)
#define RVMODEL_IO_ASSERT_SFPR_EQ(_F, _R, _I)
#define RVMODEL_IO_ASSERT_DFPR_EQ(_D, _R, _I)

#define RVMODEL_SET_MSW_INT
#define RVMODEL_CLEAR_MSW_INT
#define RVMODEL_CLEAR_MTIMER_INT
#define RVMODEL_CLEAR_MEXT_INT

#endif // _COMPLIANCE_MODEL_H

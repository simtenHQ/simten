package main

import (
	"bytes"
	"fmt"
	"os/exec"
)

// maxProcessOutput caps how much combined stdout/stderr is kept from a tool run.
// The output is user-driven (a testbench can print in a loop until the timeout)
// and the whole response is held in memory, so without a cap one request can
// exhaust the container. Bytes past the cap are dropped, not buffered.
const maxProcessOutput = 1 << 20 // 1 MiB

type cappedBuffer struct {
	buf       bytes.Buffer
	truncated bool
}

// Write always reports the full length, so the process never sees a short write
// and keeps running to completion or its timeout.
func (c *cappedBuffer) Write(p []byte) (int, error) {
	room := maxProcessOutput - c.buf.Len()
	if len(p) > room {
		c.truncated = true
		if room > 0 {
			c.buf.Write(p[:room])
		}
		return len(p), nil
	}
	c.buf.Write(p)
	return len(p), nil
}

// cappedCombinedOutput is exec.Cmd.CombinedOutput with a size cap.
func cappedCombinedOutput(cmd *exec.Cmd) ([]byte, error) {
	var out cappedBuffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	if out.truncated {
		fmt.Fprintf(&out.buf, "\n[output truncated at %d bytes]\n", maxProcessOutput)
	}
	return out.buf.Bytes(), err
}

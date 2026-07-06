export function PipelineSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Drawing the Screen</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          There&rsquo;s no framebuffer. Storing all 512 pixels and rewriting them every frame would
          burn memory and cycles on a picture the logic can regenerate for free. Instead the screen
          is drawn the way a real display is: a scan counter walks every pixel address in turn, and
          for each one, combinational logic answers a single question &mdash; is this pixel lit?
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The <code className="text-sm">scan_addr</code> input splits into X (the low 5 bits,
          0&ndash;31) and Y (the high bits, 0&ndash;15). Three tests run in parallel and get
          OR&rsquo;d together into the output pixel:
        </p>
        <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              label: 'Ball',
              color: 'text-gray-200 border-gray-600/50 bg-gray-800/30',
              desc: 'scanX == ballX and scanY == ballY',
            },
            {
              label: 'Paddle',
              color: 'text-blue-400 border-blue-800/50 bg-blue-950/20',
              desc: 'row 15, and scanX within the paddle span',
            },
            {
              label: 'Brick',
              color: 'text-orange-400 border-orange-800/50 bg-orange-950/20',
              desc: 'Y < 4, and the brick RAM cell is alive',
            },
          ].map(({ label, color, desc }) => (
            <div key={label} className={`rounded-lg border p-3 ${color}`}>
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-[11px] font-mono text-gray-500 dark:text-gray-500 mt-1">
                {desc}
              </div>
            </div>
          ))}
        </div>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is exactly how a VGA or HDMI controller feeds a monitor: one pixel per clock,
          computed on the fly from the current scan position. On an FPGA you wire{' '}
          <code className="text-sm">scan_addr</code> to the display&rsquo;s timing generator and
          pipe <code className="text-sm">pixel_out</code> to the encoder; in the browser demo, the
          simulator sweeps the address and reads the pixels back.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The one thing that <em>does</em> need memory writes is the wall itself, and RAM has no
          reset line. So at power-on &mdash; and again each time you lose a ball &mdash; a small
          fill counter walks the 128 brick cells and writes them alive, one per clock. At the
          FPGA&rsquo;s clock rate that whole redraw is a few microseconds: instant. The demo just
          fast-forwards those clocks so you see the same thing in the browser.
        </p>
      </div>
    </section>
  );
}

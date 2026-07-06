export function PaddleSection() {
  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Paddle Input</h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The paddle is 6 pixels wide on the bottom row (row 15). Its center position is stored in a
          register, and keyboard scan codes (75 for left, 77 for right) feed into comparators that
          produce a movement delta: &minus;1, 0, or +1.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The delta is added to the current position, then clamped to the range 3&ndash;28 so the
          paddle (center &minus;3 to +2) always stays on the 32-wide screen. Two comparators check
          the boundaries, and two muxes override the result if it would go out of bounds.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          This is the same pattern used in every hardware input system &mdash; a comparator bank
          decodes the input code, combinational logic computes the new position, and boundary
          clamping prevents invalid state. No if-statements, no software &mdash; just gates
          selecting between values.
        </p>
      </div>
    </section>
  );
}

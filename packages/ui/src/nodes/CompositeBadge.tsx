"use client";

/**
 * Small badge shown on composite nodes indicating they can be inspected.
 * Renders in the top-right corner of the node.
 */
export function CompositeBadge() {
  return (
    <div
      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[9px] text-white cursor-pointer"
      title="Double-click to inspect internals"
    >
      &#x229E;
    </div>
  );
}

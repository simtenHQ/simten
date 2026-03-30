"use client";

import { Link } from "@tanstack/react-router";

/**
 * Context banner for blog posts — tells first-time visitors what they're looking at.
 * Placed below the title, above the content. Non-intrusive, one line.
 */
export function BlogBanner() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-gray-500 py-3 mb-4 border-b border-gray-800/50">
      <span className="font-medium text-gray-400">Turing Incomplete</span>
      <span className="text-gray-700">—</span>
      <span>every circuit on this page is live. Toggle switches, watch signals propagate.</span>
      <Link
        to="/"
        className="text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap ml-auto"
      >
        Find out more →
      </Link>
    </div>
  );
}

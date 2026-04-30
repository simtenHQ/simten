import { Link } from "@tanstack/react-router";
import { posts } from "./posts";

interface BlogFooterProps {
  slug: string;
  tagline?: string;
}

export function BlogFooter({ slug, tagline = "Every circuit on this page is simulated from logic gates in your browser. No CPU, no software, no cheating." }: BlogFooterProps) {
  const currentIndex = posts.findIndex((p) => p.slug === slug);
  const next = currentIndex >= 0 && currentIndex < posts.length - 1
    ? posts[currentIndex + 1]
    : null;

  return (
    <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Built with{" "}
        <a
          href="/"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          Simten
        </a>
        {" "}&mdash; a visual circuit simulator with an AI tutor.
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">
        {tagline}
      </p>
      <div className="mt-6 flex items-center justify-center gap-4">
        <Link
          to="/editor"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Build your own circuit &rarr;
        </Link>
        {next && (
          <Link
            to={`/blog/${next.slug}` as string}
            className="text-sm text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Next: {next.title} &rarr;
          </Link>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-600 mt-4">
        <Link to="/blog" className="hover:text-gray-500 dark:text-gray-400 transition-colors">
          &larr; Back to blog
        </Link>
      </p>
    </footer>
  );
}

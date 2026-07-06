import { Link } from '@tanstack/react-router';
import { posts } from './posts';

interface BlogFooterProps {
  slug: string;
}

/**
 * Per-post footer rendered at the bottom of every blog post body.
 * Holds post-specific CTAs (open the editor, go to the next post, back to
 * the index). The site-wide brand + nav footer is SiteFooter, mounted in
 * __root.tsx — this component sits ABOVE it.
 */
export function BlogFooter({ slug }: BlogFooterProps) {
  const currentIndex = posts.findIndex((p) => p.slug === slug);
  const next =
    currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  return (
    <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/circuit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Open the editor &rarr;
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
    </div>
  );
}

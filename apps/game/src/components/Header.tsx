import { Link } from '@tanstack/react-router';
import ThemeToggle from './ThemeToggle';

/**
 * Deliberately thin. The level is the page; the header only has to name the
 * thing and get out of the way.
 */
export default function Header() {
  return (
    <header className="border-b border-border px-6">
      <nav className="mx-auto flex max-w-[1400px] items-center gap-5 py-3">
        <Link to="/play" className="text-sm font-semibold tracking-tight no-underline">
          Simten
        </Link>
        <Link to="/play" className="text-sm text-muted-foreground no-underline">
          Levels
        </Link>
        <a
          href="https://simten.dev"
          className="text-sm text-muted-foreground no-underline"
          target="_blank"
          rel="noreferrer"
        >
          Editor
        </a>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

/**
 * Code editor exports.
 *
 * The Monaco editor + compile mechanics now live in the library
 * (`@simten/ui/monaco` + `@simten/embed`); what remains here is the
 * app-styled error panel.
 */

export type { CompilationError } from './ErrorDisplay';
export { ErrorDisplay } from './ErrorDisplay';

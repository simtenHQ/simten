/**
 * Which inbound messages come from the page that embeds this sandbox.
 *
 * A message is accepted only if it was sent by the parent window itself
 * (`event.source === parent`) and from the parent's origin. Where the browser
 * reports the parent's origin up front (`location.ancestorOrigins`, Chromium
 * and Safari) that origin is required from the first message; elsewhere it is
 * pinned on the first message from the parent window. The page side
 * (`iframeTransport` in `@simten/sandbox`) checks the sandbox's origin and
 * source the same way.
 */

interface ParentChannel {
  /** True if `event` comes from the parent window and origin. */
  accepts(event: Pick<MessageEvent, 'source' | 'origin'>): boolean;
  /** The parent's origin, once known; responses go only to it. */
  origin(): string | null;
}

export function createParentChannel(
  parentWindow: MessageEventSource | null,
  expectedOrigin: string | null,
): ParentChannel {
  let pinned = expectedOrigin;
  return {
    accepts(event) {
      if (parentWindow === null || event.source !== parentWindow) return false;
      if (pinned === null) pinned = event.origin;
      return event.origin === pinned;
    },
    origin: () => pinned,
  };
}

/**
 * The embedding page's origin, if the browser reports it before any message
 * arrives. A masked origin ('null') counts as not reported.
 */
export function reportedParentOrigin(location: Pick<Location, 'ancestorOrigins'>): string | null {
  const origin = location.ancestorOrigins?.[0];
  return origin && origin !== 'null' ? origin : null;
}

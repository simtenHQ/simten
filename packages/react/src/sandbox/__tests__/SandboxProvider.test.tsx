// @vitest-environment jsdom

/**
 * Which sandbox a hook gets (decision 0010): one page-wide sandbox by default,
 * created by the first hook that needs it; the nearest `SandboxProvider`
 * otherwise, with its own client or the one it was given.
 */

import type { SandboxClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SandboxProvider, useSandboxClient } from '../SandboxProvider';

afterEach(cleanup);

/** Reports the client it gets under `name`. */
function Probe({ name, seen }: { name: string; seen: Map<string, SandboxClient | null> }) {
  seen.set(name, useSandboxClient());
  return null;
}

describe('the sandbox a hook gets', () => {
  it('is one page-wide sandbox with no provider, made only once something asks', async () => {
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    const seen = new Map<string, SandboxClient | null>();
    render(
      <>
        <Probe name="first" seen={seen} />
        <Probe name="second" seen={seen} />
      </>,
    );
    await waitFor(() => expect(seen.get('first')).toBeTruthy());
    expect(seen.get('second')).toBe(seen.get('first'));
    // One hidden iframe for the page, not one per circuit.
    expect(document.querySelectorAll('iframe')).toHaveLength(1);

    // A later hook, mounted on its own, reuses it.
    const later = new Map<string, SandboxClient | null>();
    render(<Probe name="later" seen={later} />);
    await waitFor(() => expect(later.get('later')).toBe(seen.get('first')));
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('is the given client under a provider with one', async () => {
    const client = inProcessSandbox();
    const seen = new Map<string, SandboxClient | null>();
    render(
      <SandboxProvider client={client}>
        <Probe name="inner" seen={seen} />
      </SandboxProvider>,
    );
    await waitFor(() => expect(seen.get('inner')).toBe(client));
    client.dispose();
  });

  it("is the subtree's own under a provider without one, and the nearest provider wins", async () => {
    const given = inProcessSandbox();
    const seen = new Map<string, SandboxClient | null>();
    const { unmount } = render(
      <SandboxProvider client={given}>
        <Probe name="outer" seen={seen} />
        <SandboxProvider>
          <Probe name="a" seen={seen} />
          <Probe name="b" seen={seen} />
        </SandboxProvider>
      </SandboxProvider>,
    );
    await waitFor(() => expect(seen.get('a')).toBeTruthy());
    expect(seen.get('b')).toBe(seen.get('a'));
    expect(seen.get('a')).not.toBe(given);
    expect(seen.get('outer')).toBe(given);
    const own = seen.get('a');
    unmount();
    // The provider made it, so the provider disposes of it.
    await expect(own?.compile('')).rejects.toThrow('The sandbox was closed.');
    given.dispose();
  });
});

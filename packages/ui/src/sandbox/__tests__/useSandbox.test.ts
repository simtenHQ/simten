// @vitest-environment jsdom

/**
 * The page side of the sandbox bridge, against a fake iframe: jsdom creates
 * the iframe but loads nothing into it, so these tests play the sandbox by
 * dispatching `message` events and watching what the hook posts.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SANDBOX_UNAVAILABLE_ERROR, useSandbox } from '../useSandbox';

// useSandbox's default outside a production build.
const SANDBOX_ORIGIN = 'http://localhost:3002';
const READY_TIMEOUT_MS = 10000;

type Posted = { id: string; type: string };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function iframes(): HTMLIFrameElement[] {
  return [...document.querySelectorAll('iframe')];
}

/** Capture what the hook posts into `iframe`. */
function spyOnPosts(iframe: HTMLIFrameElement): Mock<(message: Posted, origin: string) => void> {
  const spy = vi.fn<(message: Posted, origin: string) => void>();
  const win = iframe.contentWindow;
  if (!win) throw new Error('iframe has no window');
  win.postMessage = spy as unknown as Window['postMessage'];
  return spy;
}

/** Deliver a message to the page as if `source` sent it from `origin`. */
function deliver(data: unknown, source: Window | null, origin = SANDBOX_ORIGIN) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  });
}

/** Mount a hook, return its iframe already past the ready handshake. */
function mountReady() {
  const before = new Set(iframes());
  const hook = renderHook(() => useSandbox());
  const iframe = iframes().find((f) => !before.has(f));
  if (!iframe?.contentWindow) throw new Error('no sandbox iframe');
  const posts = spyOnPosts(iframe);
  deliver({ type: 'ready' }, iframe.contentWindow);
  return { hook, iframe, win: iframe.contentWindow, posts };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useSandbox', () => {
  it('creates a hidden, sandboxed iframe on the sandbox origin', () => {
    renderHook(() => useSandbox());
    const [iframe] = iframes();
    expect(iframe.src).toBe(`${SANDBOX_ORIGIN}/`);
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  });

  it('queues requests until ready, then sends them to the sandbox origin', async () => {
    const hook = renderHook(() => useSandbox());
    const [iframe] = iframes();
    const posts = spyOnPosts(iframe);
    expect(hook.result.current.status).toBe('loading');

    const result = hook.result.current.tick();
    expect(posts).not.toHaveBeenCalled();

    deliver({ type: 'ready' }, iframe.contentWindow);
    expect(hook.result.current.status).toBe('ready');
    expect(posts).toHaveBeenCalledTimes(1);
    const [message, origin] = posts.mock.calls[0];
    expect(origin).toBe(SANDBOX_ORIGIN);
    expect(message.type).toBe('tick');

    deliver({ id: message.id, type: 'ticked', portValues: {}, cycle: 0 }, iframe.contentWindow);
    await expect(result).resolves.toMatchObject({ cycle: 0 });
  });

  it('ignores messages from another origin', async () => {
    const { hook, win, posts } = mountReady();
    const result = hook.result.current.tick();
    const { id } = posts.mock.calls[0][0];

    let settled = false;
    void result.then(() => {
      settled = true;
    });
    deliver({ id, type: 'error', error: 'spoofed' }, win, 'https://other.example');
    await flush();
    expect(settled).toBe(false);

    deliver({ id, type: 'ticked', portValues: {}, cycle: 0 }, win);
    await expect(result).resolves.toMatchObject({ cycle: 0 });
  });

  it('ignores messages from another window, even at the sandbox origin', async () => {
    const { hook, win, posts } = mountReady();
    const other = document.createElement('iframe');
    document.body.appendChild(other);

    const result = hook.result.current.tick();
    const { id } = posts.mock.calls[0][0];
    let settled = false;
    void result.then(() => {
      settled = true;
    });

    deliver({ id, type: 'error', error: 'spoofed' }, other.contentWindow);
    deliver({ id, type: 'error', error: 'spoofed' }, window);
    await flush();
    expect(settled).toBe(false);

    deliver({ id, type: 'ticked', portValues: {}, cycle: 0 }, win);
    await expect(result).resolves.toMatchObject({ cycle: 0 });
    other.remove();
  });

  it('ignores a ready signal from another window', () => {
    const hook = renderHook(() => useSandbox());
    deliver({ type: 'ready' }, window);
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.isReady()).toBe(false);
  });

  it('gives every request on the page a distinct id, across sandboxes', () => {
    const a = mountReady();
    const b = mountReady();
    void a.hook.result.current.tick();
    void a.hook.result.current.tick();
    void b.hook.result.current.tick();
    const ids = [...a.posts.mock.calls, ...b.posts.mock.calls].map(([m]) => m.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("does not let one sandbox's response resolve another's request", async () => {
    const a = mountReady();
    const b = mountReady();
    const fromA = a.hook.result.current.tick();
    const fromB = b.hook.result.current.tick();
    const idA = a.posts.mock.calls[0][0].id;
    const idB = b.posts.mock.calls[0][0].id;

    // B's iframe answers with A's id: A must not take it.
    let aSettled = false;
    void fromA.then(() => {
      aSettled = true;
    });
    deliver({ id: idA, type: 'ticked', portValues: {}, cycle: 99 }, b.win);
    await flush();
    expect(aSettled).toBe(false);

    deliver({ id: idA, type: 'ticked', portValues: {}, cycle: 1 }, a.win);
    deliver({ id: idB, type: 'ticked', portValues: {}, cycle: 2 }, b.win);
    await expect(fromA).resolves.toMatchObject({ cycle: 1 });
    await expect(fromB).resolves.toMatchObject({ cycle: 2 });
  });

  it('uses only the first response to an id', async () => {
    const { hook, win, posts } = mountReady();
    const first = hook.result.current.tick();
    const { id } = posts.mock.calls[0][0];
    deliver({ id, type: 'ticked', portValues: { a: 1 }, cycle: 1 }, win);
    deliver({ id, type: 'ticked', portValues: { a: 0 }, cycle: 2 }, win);
    await expect(first).resolves.toMatchObject({ cycle: 1, portValues: { a: 1 } });
  });

  it('turns boolean port values into numbers', async () => {
    const { hook, win, posts } = mountReady();
    const result = hook.result.current.tick();
    const { id } = posts.mock.calls[0][0];
    deliver({ id, type: 'ticked', portValues: { a: true, b: false, c: 7 }, cycle: 1 }, win);
    await expect(result).resolves.toMatchObject({ portValues: { a: 1, b: 0, c: 7 } });
  });

  it('fails queued and later requests when the sandbox never becomes ready', async () => {
    const hook = renderHook(() => useSandbox());
    const queued = hook.result.current.tick();

    act(() => {
      vi.advanceTimersByTime(READY_TIMEOUT_MS);
    });
    expect(hook.result.current.status).toBe('unavailable');
    await expect(queued).resolves.toEqual({ type: 'error', error: SANDBOX_UNAVAILABLE_ERROR });
    await expect(hook.result.current.tick()).resolves.toEqual({
      type: 'error',
      error: SANDBOX_UNAVAILABLE_ERROR,
    });
  });

  it('does not time out once the sandbox is ready', () => {
    const { hook } = mountReady();
    act(() => {
      vi.advanceTimersByTime(READY_TIMEOUT_MS * 2);
    });
    expect(hook.result.current.status).toBe('ready');
  });

  it('recreates the iframe after a crash and fails what was in flight', async () => {
    const { hook, iframe, posts } = mountReady();
    const inFlight = hook.result.current.tick();
    expect(posts).toHaveBeenCalledTimes(1);

    act(() => {
      iframe.onerror?.(new Event('error'));
    });

    await expect(inFlight).resolves.toEqual({ type: 'error', error: 'Sandbox restarted (crash)' });
    expect(hook.result.current.status).toBe('loading');
    expect(iframe.isConnected).toBe(false);
    const [fresh] = iframes();
    expect(fresh).not.toBe(iframe);

    // The new iframe gets its own handshake, and only it is listened to.
    const freshPosts = spyOnPosts(fresh);
    const next = hook.result.current.tick();
    deliver({ type: 'ready' }, fresh.contentWindow);
    expect(hook.result.current.status).toBe('ready');
    const { id } = freshPosts.mock.calls[0][0];
    deliver({ id, type: 'ticked', portValues: {}, cycle: 0 }, fresh.contentWindow);
    await expect(next).resolves.toMatchObject({ cycle: 0 });
  });

  it('removes its iframe and listener on unmount', () => {
    const { hook, iframe } = mountReady();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    hook.unmount();
    expect(iframe.isConnected).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

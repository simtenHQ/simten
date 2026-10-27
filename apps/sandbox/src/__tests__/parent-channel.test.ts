import { describe, expect, it } from 'vitest';
import { createParentChannel, reportedParentOrigin } from '../parent-channel';

// Window stand-ins: the channel only compares them by identity.
const parentWindow = {} as MessageEventSource;
const siblingWindow = {} as MessageEventSource;

const PAGE = 'https://simten.dev';
const OTHER = 'https://other.example';

describe('createParentChannel', () => {
  it('accepts messages from the parent window at the reported origin', () => {
    const channel = createParentChannel(parentWindow, PAGE);
    expect(channel.origin()).toBe(PAGE);
    expect(channel.accepts({ source: parentWindow, origin: PAGE })).toBe(true);
  });

  it('drops messages from any other window, even at the parent origin', () => {
    const channel = createParentChannel(parentWindow, PAGE);
    expect(channel.accepts({ source: siblingWindow, origin: PAGE })).toBe(false);
    expect(channel.accepts({ source: null, origin: PAGE })).toBe(false);
  });

  it('drops messages from the parent window at another origin', () => {
    const channel = createParentChannel(parentWindow, PAGE);
    expect(channel.accepts({ source: parentWindow, origin: OTHER })).toBe(false);
  });

  it('pins the origin of the first parent message when none was reported', () => {
    const channel = createParentChannel(parentWindow, null);
    expect(channel.origin()).toBeNull();
    expect(channel.accepts({ source: parentWindow, origin: PAGE })).toBe(true);
    expect(channel.origin()).toBe(PAGE);
    expect(channel.accepts({ source: parentWindow, origin: OTHER })).toBe(false);
  });

  it('does not let another window pin the origin first', () => {
    const channel = createParentChannel(parentWindow, null);
    expect(channel.accepts({ source: siblingWindow, origin: OTHER })).toBe(false);
    expect(channel.origin()).toBeNull();
    expect(channel.accepts({ source: parentWindow, origin: PAGE })).toBe(true);
    expect(channel.origin()).toBe(PAGE);
  });

  it('accepts nothing when there is no parent window', () => {
    const channel = createParentChannel(null, null);
    expect(channel.accepts({ source: null, origin: PAGE })).toBe(false);
    expect(channel.origin()).toBeNull();
  });
});

describe('reportedParentOrigin', () => {
  const location = (origins?: string[]) =>
    ({ ancestorOrigins: origins as unknown as DOMStringList }) as Pick<Location, 'ancestorOrigins'>;

  it('is the nearest ancestor origin when the browser reports one', () => {
    expect(reportedParentOrigin(location([PAGE, OTHER]))).toBe(PAGE);
  });

  it('is null when the browser reports none, or a masked one', () => {
    expect(reportedParentOrigin(location())).toBeNull();
    expect(reportedParentOrigin(location([]))).toBeNull();
    expect(reportedParentOrigin(location(['null']))).toBeNull();
  });
});

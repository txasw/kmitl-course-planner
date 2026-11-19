import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeHashRoute } from './useHashRoute';

const SELECTOR_HASH = '#/teach_table_selector';
const RESULT_HASH = '#/teach_table?mode=by_subject_owner_id&selected_year=2569';

// The host router navigates with pushState and then swaps its route view, which is all
// a content script can observe of it.
function routerNavigate(hash: string): void {
  window.history.pushState(null, '', hash);
  const view = document.createElement('div');
  document.body.replaceChildren(view);
}

// Mutation observer records are delivered as a microtask.
async function flushObservers(): Promise<void> {
  await Promise.resolve();
}

beforeEach(() => {
  window.history.replaceState(null, '', SELECTOR_HASH);
});

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, '', '#');
  vi.unstubAllGlobals();
});

describe('subscribeHashRoute', () => {
  it('hears a pushState navigation of the host router, with no hashchange', async () => {
    const onChange = vi.fn();
    const stop = subscribeHashRoute(onChange);
    routerNavigate(RESULT_HASH);
    await flushObservers();
    expect(onChange).toHaveBeenCalledTimes(1);
    routerNavigate(SELECTOR_HASH);
    await flushObservers();
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stays quiet through host rendering that leaves the hash as it was', async () => {
    const onChange = vi.fn();
    const stop = subscribeHashRoute(onChange);
    document.body.append(document.createElement('p'));
    await flushObservers();
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it('hears hashchange and popstate', () => {
    const onChange = vi.fn();
    const stop = subscribeHashRoute(onChange);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it('hears the Navigation API where the browser provides it', () => {
    const navigation = new EventTarget();
    vi.stubGlobal('navigation', navigation);
    const onChange = vi.fn();
    const stop = subscribeHashRoute(onChange);
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    navigation.dispatchEvent(new Event('currententrychange'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('serves every subscriber from one set of listeners and lets go after the last', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeHashRoute(first);
    const stopSecond = subscribeHashRoute(second);
    routerNavigate(RESULT_HASH);
    await flushObservers();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopFirst();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    stopSecond();
    routerNavigate(SELECTOR_HASH);
    await flushObservers();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('keeps two subscriptions of one function apart', () => {
    const onChange = vi.fn();
    const stopFirst = subscribeHashRoute(onChange);
    const stopSecond = subscribeHashRoute(onChange);
    stopFirst();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(onChange).toHaveBeenCalledTimes(1);
    stopSecond();
  });
});

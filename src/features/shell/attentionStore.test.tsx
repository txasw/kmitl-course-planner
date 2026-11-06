import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  attentionStore,
  createAttentionStore,
  selectAttentionHeld,
  useSearchFocusTracking,
} from './attentionStore';
import { usePanelPopover } from './usePanelPopover';

function Popover({ open, ambient }: { open: boolean; ambient: boolean }) {
  usePanelPopover({ gap: 4, open, ambient });
  return null;
}

function Form() {
  const tracking = useSearchFocusTracking();
  return (
    <div {...tracking}>
      <input aria-label="first" />
      <input aria-label="second" />
    </div>
  );
}

function openSurfaces(): number {
  return attentionStore.getState().openSurfaces;
}

afterEach(() => {
  cleanup();
  attentionStore.setState({ openSurfaces: 0, searchFocused: false });
});

describe('attentionStore', () => {
  it('counts a surface closed once however often it is released', () => {
    const store = createAttentionStore();
    const release = store.getState().openSurface();
    store.getState().openSurface();
    release();
    release();
    expect(store.getState().openSurfaces).toBe(1);
    expect(selectAttentionHeld(store.getState())).toBe(true);
  });

  it('counts an open panel popover until it closes, but never an ambient one', () => {
    const { rerender } = render(<Popover open ambient={false} />);
    expect(openSurfaces()).toBe(1);
    rerender(<Popover open={false} ambient={false} />);
    expect(openSurfaces()).toBe(0);
    rerender(<Popover open ambient />);
    expect(openSurfaces()).toBe(0);
  });

  it('holds the search focus flag while focus moves inside the form', () => {
    const { unmount } = render(<Form />);
    const first = screen.getByRole('textbox', { name: 'first' });
    const second = screen.getByRole('textbox', { name: 'second' });
    act(() => {
      first.focus();
    });
    expect(attentionStore.getState().searchFocused).toBe(true);
    act(() => {
      second.focus();
    });
    expect(attentionStore.getState().searchFocused).toBe(true);
    act(() => {
      second.blur();
    });
    expect(attentionStore.getState().searchFocused).toBe(false);
    act(() => {
      first.focus();
    });
    unmount();
    expect(attentionStore.getState().searchFocused).toBe(false);
  });
});

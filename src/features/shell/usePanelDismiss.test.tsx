import { afterEach, describe, expect, it } from 'vitest';
import { useCallback, useState } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useClick, useFloating, useInteractions } from '@floating-ui/react';
import { usePanelDismiss } from './usePanelDismiss';

// The panel mounts in a closed shadow root in production, where floating-ui's document
// listener sees every press inside KCP retargeted to the shadow host. jsdom runs a shadow
// host's own listeners before the listeners inside its root, where a browser runs them
// after, so the closed root case is proved in the browser by the production closed root
// spec. Here the hook keeps the menu's behaviour with no root and in an open root.

function Menu() {
  const [open, setOpen] = useState(false);
  const { refs, context } = useFloating({ open, onOpenChange: setOpen });
  // Stable callback refs, as the panel's own menus attach them.
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    usePanelDismiss(context),
  ]);
  return (
    <>
      <button type="button" ref={setReference} {...getReferenceProps()}>
        trigger
      </button>
      {open ? (
        <div ref={setFloating} {...getFloatingProps()}>
          <button type="button">item</button>
        </div>
      ) : null}
      <button type="button">elsewhere in KCP</button>
    </>
  );
}

function mount(mode: ShadowRootMode | 'none') {
  const host = document.createElement('div');
  document.body.append(host);
  const page = document.createElement('button');
  page.textContent = 'page';
  document.body.append(page);
  const container = document.createElement('div');
  (mode === 'none' ? host : host.attachShadow({ mode })).append(container);
  render(<Menu />, { container });
  const byText = (text: string): HTMLElement | undefined =>
    [...container.querySelectorAll('button')].find(
      (b) => b.textContent === text,
    );
  const press = (node: HTMLElement | undefined) => {
    if (node === undefined) throw new Error('no node to press');
    act(() => {
      fireEvent.pointerDown(node);
      fireEvent.mouseDown(node);
      fireEvent.pointerUp(node);
      fireEvent.mouseUp(node);
      fireEvent.click(node);
    });
  };
  const isOpen = () => byText('item') !== undefined;
  return { byText, press, isOpen, page };
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe.each(['none', 'open'] as const)(
  'usePanelDismiss in a %s root',
  (mode) => {
    it('closes the menu on a press of its trigger', () => {
      const { byText, press, isOpen } = mount(mode);
      press(byText('trigger'));
      expect(isOpen()).toBe(true);
      press(byText('trigger'));
      expect(isOpen()).toBe(false);
    });

    it('keeps the menu open on a press inside it', () => {
      const { byText, press, isOpen } = mount(mode);
      press(byText('trigger'));
      press(byText('item'));
      expect(isOpen()).toBe(true);
    });

    it('closes the menu on a press elsewhere in KCP or on the page', () => {
      const { byText, press, isOpen, page } = mount(mode);
      press(byText('trigger'));
      press(byText('elsewhere in KCP'));
      expect(isOpen()).toBe(false);
      press(byText('trigger'));
      press(page);
      expect(isOpen()).toBe(false);
    });
  },
);

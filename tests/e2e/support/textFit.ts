// The text fit scan behind the clipped text sweep (ADR-0048 amendment). It walks every
// visible text leaf under a region and reports two kinds of fault: a leaf whose text a
// box cuts, and a pair of leaves that draw over each other. A box cuts text when it hides
// or clips its overflow and either holds more than it shows (its scroll size passes its
// client size, which is also how an active ellipsis or line clamp reads) or a leaf runs
// past its edge. A leaf that a scroller holds is not cut, since scrolling reveals it, and
// a leaf wholly outside a clipping box or the viewport is off screen rather than cut, such
// as a slide of a carousel or the pane the phone layout keeps aside. Overlap is read per
// line fragment, so a wrapped label and the text that follows its last line do not count
// as overlapping through their bounding boxes. A sticky or fixed box inside the region is a
// layer of its own, such as a heading that stays put while the list scrolls under it, so a
// leaf in that layer and a leaf outside it are not compared.

import type { Locator } from '@playwright/test';

/** A leaf an explicit expand affordance excuses, named by a selector and a reason. */
export interface TextFitException {
  selector: string;
  reason: string;
}

export interface TextFitFinding {
  kind: 'clipped' | 'outside' | 'overlap';
  text: string;
  /** Which box cuts the text and by how much, to read a failure by. */
  detail?: string;
}

/**
 * Scan a region and return its faults. A leaf inside an element that matches one of the
 * exceptions is left out of both checks.
 */
export async function scanTextFit(
  region: Locator,
  exceptions: readonly TextFitException[],
): Promise<TextFitFinding[]> {
  return region.evaluate(
    (root, selectors) => {
      // Subpixel layout can place an edge a fraction past a whole pixel, and a line box
      // read from the centre of an asymmetric Thai face can sit a fraction off it, so a
      // box cuts a leaf only past the same one pixel the scroll size check allows.
      const EDGE = 0.5;
      const CUT = 1;
      const SCROLL = 1;
      const findings: {
        kind: 'clipped' | 'outside' | 'overlap';
        text: string;
        detail?: string;
      }[] = [];
      interface Box {
        left: number;
        top: number;
        right: number;
        bottom: number;
      }
      const fragments: {
        text: string;
        rect: Box;
        layer: Element | null;
        node: Node;
      }[] = [];
      const clips = (value: string) => value === 'hidden' || value === 'clip';
      const scrolls = (value: string) => value === 'auto' || value === 'scroll';
      const parentOf = (element: Element): Element | null => {
        if (element === root) return null;
        if (element.parentElement !== null) return element.parentElement;
        const host = element.getRootNode();
        return host instanceof ShadowRoot ? host.host : null;
      };
      const hasBox = (element: Element) => {
        const display = getComputedStyle(element).display;
        return display !== 'inline' && display !== 'contents';
      };
      const within = (rect: Box, box: Box) =>
        rect.left >= box.left - CUT &&
        rect.right <= box.right + CUT &&
        rect.top >= box.top - CUT &&
        rect.bottom <= box.bottom + CUT;
      const apart = (rect: Box, box: Box) =>
        rect.right <= box.left + EDGE ||
        rect.left >= box.right - EDGE ||
        rect.bottom <= box.top + EDGE ||
        rect.top >= box.bottom - EDGE;
      const viewport = new DOMRect(0, 0, window.innerWidth, window.innerHeight);

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (
        let node = walker.nextNode();
        node !== null;
        node = walker.nextNode()
      ) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const parent = node.parentElement;
        if (text === '' || parent === null) continue;
        if (parent.closest('.sr-only') !== null) continue;
        if (selectors.some((selector) => parent.closest(selector) !== null)) {
          continue;
        }
        if (
          !parent.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          })
        ) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const bounds = range.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) continue;
        // A text rect spans the font's whole ascent and descent, which in a Thai face runs
        // well past a tight line box, so it would read as cut by a box the ink fits and as
        // overlapping the line above. Each line is read at its line box height instead,
        // scaled by any transform on the way, such as the export preview stage.
        const lineHeight = parseFloat(getComputedStyle(parent).lineHeight);
        const scale =
          parent instanceof HTMLElement && parent.offsetWidth > 0
            ? parent.getBoundingClientRect().width / parent.offsetWidth
            : 1;
        const firstLine = range.getClientRects()[0];
        const inset =
          Number.isFinite(lineHeight) && firstLine !== undefined
            ? Math.max(0, (firstLine.height - lineHeight * scale) / 2)
            : 0;
        const rect = {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top + inset,
          bottom: bounds.bottom - inset,
        };
        if (apart(rect, viewport)) continue;

        let layer: Element | null = null;
        for (
          let element: Element | null = parent;
          element !== null && element !== root && layer === null;
          element = parentOf(element)
        ) {
          const position = getComputedStyle(element).position;
          if (position === 'sticky' || position === 'fixed') layer = element;
        }
        let hidden = false;
        let cut = false;
        let scrolled = false;
        let why = '';
        // The part of the leaf that every clipping or scrolling ancestor passed so far
        // leaves on show. A scroller hides what lies past its edge only until it scrolls,
        // so a box further out cuts the leaf only where it cuts this part.
        let shown = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
        let nearest: Element | null = parent;
        while (nearest !== null && !hasBox(nearest))
          nearest = parentOf(nearest);
        for (
          let element: Element | null = parent;
          element !== null;
          element = parentOf(element)
        ) {
          const style = getComputedStyle(element);
          const scrollX = scrolls(style.overflowX);
          const scrollY = scrolls(style.overflowY);
          const clipX = clips(style.overflowX);
          const clipY = clips(style.overflowY);
          if (!clipX && !clipY && !scrollX && !scrollY) continue;
          const box = element.getBoundingClientRect();
          if (apart(rect, box)) {
            hidden = true;
            break;
          }
          const name = `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 4).join('.')}`;
          if ((clipX || clipY) && !within(shown, box)) {
            cut = true;
            why = `runs past ${name} by ${[
              box.left - shown.left,
              shown.right - box.right,
              box.top - shown.top,
              shown.bottom - box.bottom,
            ]
              .map((value) => value.toFixed(1))
              .join(' ')}`;
          }
          // A row that scrolls sideways only, such as a tab strip, hides a label it holds
          // part way behind its edge; a list that scrolls down is read by scrolling. The
          // overflow style cannot tell them apart, since an auto overflow on one axis makes
          // the other auto too, so the row is told by having nothing to scroll down.
          const sideways =
            scrollX &&
            element.scrollWidth > element.clientWidth + SCROLL &&
            element.scrollHeight <= element.clientHeight + SCROLL;
          if (
            sideways &&
            (shown.left < box.left - CUT || shown.right > box.right + CUT)
          ) {
            cut = true;
            why = `scrolled sideways out of ${name}`;
          }
          if ((clipX || clipY) && element === nearest) {
            if (
              (clipX && element.scrollWidth > element.clientWidth + SCROLL) ||
              (clipY && element.scrollHeight > element.clientHeight + SCROLL)
            ) {
              cut = true;
              why = `${name} holds ${String(element.scrollWidth)}x${String(element.scrollHeight)} in ${String(element.clientWidth)}x${String(element.clientHeight)}`;
            }
          }
          if (scrollX || scrollY) scrolled = true;
          shown = {
            left: Math.max(shown.left, box.left),
            top: Math.max(shown.top, box.top),
            right: Math.min(shown.right, box.right),
            bottom: Math.min(shown.bottom, box.bottom),
          };
        }
        if (hidden) continue;
        if (cut) findings.push({ kind: 'clipped', text, detail: why });
        else if (!scrolled && !within(rect, viewport)) {
          findings.push({ kind: 'outside', text });
        }
        for (const fragment of range.getClientRects()) {
          // Overlap is read on the part of each line that is on show.
          const part = {
            left: Math.max(fragment.left, shown.left),
            top: Math.max(fragment.top + inset, shown.top),
            right: Math.min(fragment.right, shown.right),
            bottom: Math.min(fragment.bottom - inset, shown.bottom),
          };
          if (part.right - part.left > EDGE && part.bottom - part.top > EDGE) {
            fragments.push({ text, rect: part, layer, node });
          }
        }
      }

      fragments.sort((a, b) => a.rect.top - b.rect.top);
      const seen = new Set<string>();
      for (let i = 0; i < fragments.length; i += 1) {
        const a = fragments[i];
        if (a === undefined) continue;
        for (let j = i + 1; j < fragments.length; j += 1) {
          const b = fragments[j];
          if (b === undefined) continue;
          if (b.rect.top >= a.rect.bottom - EDGE) break;
          // Two lines of one wrapped text sit on adjacent line boxes, which a tight line
          // height lets their glyph boxes share by a pixel or two.
          if (a.layer !== b.layer || a.node === b.node) continue;
          if (
            a.rect.left < b.rect.right - EDGE &&
            b.rect.left < a.rect.right - EDGE &&
            a.rect.top < b.rect.bottom - EDGE &&
            b.rect.top < a.rect.bottom - EDGE
          ) {
            const pair = `${a.text} | ${b.text}`;
            if (!seen.has(pair)) {
              seen.add(pair);
              findings.push({ kind: 'overlap', text: pair });
            }
          }
        }
      }
      return findings;
    },
    exceptions.map((exception) => exception.selector),
  );
}

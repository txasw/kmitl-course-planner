// The text fit scan behind the clipped text sweep (ADR-0048 amendment). It walks every
// visible text leaf under a region and reports three kinds of fault: a leaf whose text a
// box cuts, a pair of leaves that draw over each other, and a leaf another layer covers. A
// box cuts text when it hides or clips its overflow and either holds more than it shows
// (its scroll size passes its client size, which is also how an active ellipsis or line
// clamp reads) or a leaf runs past its edge. A leaf that a scroller holds is not cut, since
// scrolling reveals it, and a leaf wholly outside a clipping box or the viewport is off
// screen rather than cut, such as a slide of a carousel or the pane the phone layout keeps
// aside. Overlap is read per line fragment, so a wrapped label and the text that follows
// its last line do not count as overlapping through their bounding boxes. A sticky or fixed
// box inside the region is a layer of its own, such as a heading that stays put while the
// list scrolls under it, so a leaf in that layer and a leaf outside it are not compared.
//
// A leaf is covered when the element on top at a point of its line, the one a press there
// would reach, is neither the leaf's own element nor inside or around it: a toast, a
// tooltip, or a card laid over the text. Each line is probed across its middle at three
// points and just inside each end, so a layer over the first or last glyph is read too. A
// layer that lets presses through is drawn for looks, such as a hatch or a shadow, and is
// not on top for this reading. A cover inside the same scroller as the leaf is a pinned row
// the list scrolls under, which scrolling clears. A layer that dims the panel on purpose,
// such as the product tour's, is named as see through by the caller so the probe reads what
// lies under it.
//
// Behind a layer the student opened on purpose, a popover, a menu, or a sheet, the region is
// read in behind mode: the layer may cover text whole, but no line may end cut by its edge,
// which leaves part of the line on show to read as other words or another time. Each line is
// probed near its top and near its foot at the same points. A line that shows at one and is
// covered at the other is cut by the layer's top or bottom edge. A line covered at some
// points and on show at others is cut by its side edge, which fails too, except inside the
// regions the caller names as beside the layer's anchor, such as the timetable blocks next
// to the block detail, which a layer opened beside its anchor has no room to avoid.

import type { Locator } from '@playwright/test';

/**
 * A leaf an explicit expand affordance excuses. The leaf sits inside an element matching
 * the selector; its nearest ancestor matching the scope must be or hold a visible element
 * matching the control, the affordance that shows the whole text, so a cut text whose
 * control is missing still fails.
 */
export interface TextFitException {
  selector: string;
  scope: string;
  control: string;
  reason: string;
}

export interface TextFitScanOptions {
  /** Layers a covered text is read through, such as a deliberate dim over the panel. */
  seeThrough?: readonly string[];
  /** Read the region as lying behind a layer the student opened on purpose: a line the
   * layer covers whole passes, and a line its top or bottom edge cuts fails. */
  behind?: boolean;
  /** Behind a layer, selectors of the regions next to its anchor whose lines its side edge
   * may cut, since a layer opened beside its anchor has no room to avoid them. */
  besideAnchor?: readonly string[];
}

export interface TextFitFinding {
  kind: 'clipped' | 'outside' | 'overlap' | 'covered';
  text: string;
  /** Which box cuts the text and by how much, to read a failure by. */
  detail?: string;
}

/**
 * Scan a region and return its faults. A leaf an exception excuses is left out of every
 * check.
 */
export async function scanTextFit(
  region: Locator,
  exceptions: readonly TextFitException[],
  {
    seeThrough = [],
    behind = false,
    besideAnchor = [],
  }: TextFitScanOptions = {},
): Promise<TextFitFinding[]> {
  return region.evaluate(
    (root, { excused, through, behind, beside }) => {
      // Subpixel layout can place an edge a fraction past a whole pixel, and a line box
      // read from the centre of an asymmetric Thai face can sit a fraction off it, so a
      // box cuts a leaf only past the same one pixel the scroll size check allows.
      const EDGE = 0.5;
      const END_PROBE_PX = 1.5;
      const CUT = 1;
      const SCROLL = 1;
      const findings: {
        kind: 'clipped' | 'outside' | 'overlap' | 'covered';
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
        const isExcused = excused.some(({ selector, scope, control }) => {
          const area = parent.closest(selector)?.closest(scope) ?? null;
          if (area === null) return false;
          const affordance = area.matches(control)
            ? area
            : area.querySelector(control);
          return (
            affordance?.checkVisibility({
              opacityProperty: true,
              visibilityProperty: true,
            }) === true
          );
        });
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
        // A line clamp clips its box at the foot of its last shown line, but the hidden lines
        // still paint under the clip, and a Thai mark of the first rises into the foot of the
        // last shown line beside the ellipsis. A clamp therefore must not paint any line past
        // its count, which is read before the exceptions, since a clamp beside its expand
        // control is excused only for the text it hides, not for ink it lets show.
        let clamp: Element | null = parent;
        while (
          clamp !== null &&
          !/^\d+$/.test(
            getComputedStyle(clamp).getPropertyValue('-webkit-line-clamp'),
          )
        ) {
          clamp = clamp === root ? null : parentOf(clamp);
        }
        const painted = !/^(transparent|rgba\(.*,\s*0\))$/.test(
          getComputedStyle(parent).color,
        );
        if (clamp instanceof HTMLElement && painted) {
          const style = getComputedStyle(clamp);
          const count = Number(style.getPropertyValue('-webkit-line-clamp'));
          const box = clamp.getBoundingClientRect();
          const ratio =
            clamp.offsetHeight > 0 ? box.height / clamp.offsetHeight : 1;
          const foot =
            box.top +
            (parseFloat(style.borderTopWidth) +
              parseFloat(style.paddingTop) +
              count * parseFloat(style.lineHeight)) *
              ratio;
          const past = [...range.getClientRects()].some(
            (fragment) =>
              fragment.width > 0 && (fragment.top + fragment.bottom) / 2 > foot,
          );
          if (past) {
            findings.push({
              kind: 'clipped',
              text,
              detail: `paints a line past its ${String(count)} line clamp`,
            });
          }
        }
        if (isExcused) continue;
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
        // The nearest ancestor that scrolls, where a pinned row is part of the list.
        let scroller: Element | null = null;
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
          if (scrollX || scrollY) {
            scrolled = true;
            scroller ??= element;
          }
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
        const hitRoot = node.getRootNode();
        const probe =
          hitRoot instanceof ShadowRoot || hitRoot instanceof Document
            ? hitRoot
            : document;
        let cover: Element | null = null;
        // A press passes through an element that takes none, so the probe would read
        // what lies under the leaf's own box. The leaf's chain takes presses for the
        // probe and gets its own setting back after it.
        const passThrough: {
          element: HTMLElement;
          value: string;
          priority: string;
        }[] = [];
        for (
          let element: Element | null = parent;
          element !== null;
          element = parentOf(element)
        ) {
          if (
            element instanceof HTMLElement &&
            getComputedStyle(element).pointerEvents === 'none'
          ) {
            passThrough.push({
              element,
              value: element.style.getPropertyValue('pointer-events'),
              priority: element.style.getPropertyPriority('pointer-events'),
            });
            element.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
        // The element on top at a point of the line, when it is neither the leaf's own
        // element nor inside or around it, or null when the line shows there.
        const coverAt = (
          x: number,
          y: number,
          foot: number,
        ): Element | null => {
          if (x < 0 || y < 0 || x >= viewport.right || y >= viewport.bottom) {
            return null;
          }
          const top = probe
            .elementsFromPoint(x, y)
            .find(
              (element) =>
                !through.some((selector) => element.matches(selector)),
            );
          if (
            top === undefined ||
            top === parent ||
            parent.contains(top) ||
            top.contains(parent)
          ) {
            return null;
          }
          // A row pinned inside the leaf's own scroller scrolls clear of it.
          if (scroller?.contains(top) === true) return null;
          // A layer fixed over the scroller's end, such as the phone bottom nav, covers
          // a line only while the scroller rests short of it. While the scroller still
          // has room to scroll that far, scrolling brings the line clear, so it is not
          // a covered line; at the scroller's end it is. A layer the student opened is no
          // such pinned layer, so behind one the rule does not apply.
          if (!behind && scroller !== null) {
            const room =
              scroller.scrollHeight -
              scroller.clientHeight -
              scroller.scrollTop;
            const under = top.getBoundingClientRect();
            if (under.top <= y && room >= foot - under.top) return null;
          }
          return top;
        };
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
            const y = (part.top + part.bottom) / 2;
            const span = part.right - part.left;
            // A line its scroller has carried mostly out of view shows only a sliver at the
            // scroller's edge, where a neighbouring layer may meet it by a border's width.
            // Scrolling brings such a line back whole, so it is read as scrolled, not covered.
            const full = fragment.bottom - fragment.top - 2 * inset;
            if (scroller !== null && part.bottom - part.top < full / 2)
              continue;
            // The ends sit a little inside the line, clear of the box of a neighbour.
            const end = Math.min(END_PROBE_PX, span / 2);
            const xs = [
              part.left + end,
              part.left + span * 0.15,
              part.left + span * 0.5,
              part.left + span * 0.85,
              part.right - end,
            ];
            if (behind) {
              // Behind a layer the student opened, a line the layer covers whole is the cover
              // the layer may make. A line it covers only above or below a point is cut by
              // the layer's top or bottom edge, so the glyphs on either side of the edge read
              // as other words. A probe a fifth of the way in from the top and the foot of the
              // line reads each side of such an edge. An edge runs across the line, so it
              // splits the line at two points or more; a split at one point alone is the
              // rounded corner of the layer over the line's end. A line covered top to foot
              // at some points and not at others is cut by the layer's side edge, as a label
              // of 13:00 reads 3:00 with its first glyph under the layer.
              const height = part.bottom - part.top;
              const splits: Element[] = [];
              const whole: Element[] = [];
              for (const x of xs) {
                const upper = coverAt(x, part.top + height * 0.2, part.bottom);
                const lower = coverAt(
                  x,
                  part.bottom - height * 0.2,
                  part.bottom,
                );
                const split = upper ?? lower;
                if (upper !== null && lower !== null) {
                  whole.push(upper);
                } else if (split !== null) {
                  splits.push(split);
                }
              }
              const sideCut =
                whole.length > 0 &&
                whole.length < xs.length &&
                !beside.some((selector) => parent.closest(selector) !== null);
              if (cover === null && splits.length >= 2) {
                cover = splits[0] ?? null;
              }
              if (cover === null && sideCut) {
                cover = whole[0] ?? null;
              }
            } else {
              for (const x of xs) {
                if (cover !== null) break;
                cover = coverAt(x, y, part.bottom);
              }
            }
          }
        }
        for (const { element, value, priority } of passThrough) {
          if (value === '') element.style.removeProperty('pointer-events');
          else element.style.setProperty('pointer-events', value, priority);
        }
        if (cover !== null) {
          const name = `${cover.tagName.toLowerCase()}.${[...cover.classList].slice(0, 4).join('.')}`;
          findings.push({
            kind: 'covered',
            text,
            detail: `${behind ? 'cut at the edge of' : 'under'} ${name} ${cover.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)}`,
          });
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
    {
      excused: exceptions.map(({ selector, scope, control }) => ({
        selector,
        scope,
        control,
      })),
      through: [...seeThrough],
      behind,
      beside: [...besideAnchor],
    },
  );
}

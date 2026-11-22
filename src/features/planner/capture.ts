// Render a poster node to a PNG blob for the preview sharing actions. html-to-image
// clones the target subtree and inlines each element's computed styles, so the
// design token custom properties and gradient fills resolve to concrete values
// even though the stylesheet is adopted on the shadow root and the shadow root is
// closed in production; capturing from a node held by ref inside the React tree
// never reaches across the closed boundary. System fonts need no embedding, so
// font embedding is skipped and the Thai capable stack renders from the operating
// system in the clone as it does on screen.
//
// The output size is the node's own box times the pixel ratio, so an export template
// fixes the poster to its layout box and passes the template ratio here to land the
// exact template pixels, independent of the viewport (ADR-0041). A wrapping transform
// that scales the poster to fit the preview on screen does not affect the capture,
// because html-to-image reads the node's own box, not its rendered ancestor scale.

import { toBlob } from 'html-to-image';

/** The color the capture paints under the poster. It is the surface token the soft depth card
 * mixes its tint into, so the block stops in the image are the stops the contrast tests prove. */
export const CAPTURE_BACKGROUND = '#ffffff';

/** Render a node to a PNG blob, throwing when the capture yields no image. The pixel
 * ratio defaults to two, the crisp on screen ratio, and is set per export template. */
export async function capturePng(
  node: HTMLElement,
  pixelRatio = 2,
): Promise<Blob> {
  // Wait for fonts before measuring the raster: the block fit measurement chooses its field
  // set from glyph metrics, so the capture must read the same settled metrics or the image
  // would not match what the fit decided. The extra frame lets the fonts triggered fit
  // convergence commit before the clone is taken. The clone then runs as one long stretch of
  // microtasks, which would hold back the paint of that frame, so the capture starts in a task
  // after it: the busy state the press committed reaches the screen before the main thread
  // blocks, rather than only once the clone is done (ADR-0027 amendment of 2026-11-22).
  // Guarded so a host without the font loading API, as jsdom in the tests, skips straight to
  // the capture.
  // The DOM types fonts as always present, but jsdom omits it, so read it through a widened
  // binding rather than a check the types would call redundant.
  const fontSet: FontFaceSet | undefined =
    typeof document !== 'undefined' ? document.fonts : undefined;
  if (fontSet !== undefined) {
    await fontSet.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve)),
    );
  }
  const restore = keepLineClampInClone();
  let blob: Blob | null;
  try {
    blob = await toBlob(node, {
      pixelRatio,
      backgroundColor: CAPTURE_BACKGROUND,
      skipFonts: true,
    });
  } finally {
    restore();
  }
  if (blob === null) {
    throw new Error('poster capture produced no image');
  }
  return blob;
}

/** A line clamp set to a count of lines, as opposed to none. */
const LINE_COUNT = /^[1-9]\d*$/;

/** The display a line clamp needs. Chromium reads it back from a clamped box as flow-root. */
const CLAMP_DISPLAY = '-webkit-box';

/** A computed style that reports the line clamp display in place of the flow-root Chromium
 * reads back for a clamped box. Every other read passes through to the real declaration. */
function withClampDisplay(style: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, property): unknown {
      if (property === 'display') {
        return CLAMP_DISPLAY;
      }
      if (property === 'getPropertyValue') {
        return (name: string): string =>
          name === 'display' ? CLAMP_DISPLAY : target.getPropertyValue(name);
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Keep a clamped name clamped, with its ellipsis, in the captured image. html-to-image copies
 * each computed property onto its clone, and Chromium reads the display of a line clamped box
 * back as flow-root, where the clamp no longer applies; the clone then cut the name at the box
 * edge with no ellipsis, so a shortened name read as a whole but wrong one. For the length of a
 * capture the computed style of a box with a line clamp reports the display the clamp needs.
 * A box with no clamp, and a browser that reads the display back as set, are left as they are.
 * Returns the function that restores the original.
 */
function keepLineClampInClone(): () => void {
  const read = window.getComputedStyle.bind(window);
  const own = Object.getOwnPropertyDescriptor(window, 'getComputedStyle');
  const clampAware: typeof window.getComputedStyle = (element, pseudo) => {
    const style = read(element, pseudo);
    return LINE_COUNT.test(style.getPropertyValue('-webkit-line-clamp')) &&
      style.getPropertyValue('display') === 'flow-root'
      ? withClampDisplay(style)
      : style;
  };
  // Defined rather than assigned, since a host may expose the global as an accessor pair.
  Object.defineProperty(window, 'getComputedStyle', {
    configurable: true,
    writable: true,
    value: clampAware,
  });
  return () => {
    if (own === undefined) {
      Reflect.deleteProperty(window, 'getComputedStyle');
    } else {
      Object.defineProperty(window, 'getComputedStyle', own);
    }
  };
}

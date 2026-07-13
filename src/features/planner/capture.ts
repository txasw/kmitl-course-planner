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

/** Render a node to a PNG blob, throwing when the capture yields no image. The pixel
 * ratio defaults to two, the crisp on screen ratio, and is set per export template. */
export async function capturePng(
  node: HTMLElement,
  pixelRatio = 2,
): Promise<Blob> {
  // Wait for fonts before measuring the raster: the block fit measurement chooses its field
  // set from glyph metrics, so the capture must read the same settled metrics or the image
  // would not match what the fit decided. The extra frame lets the fonts triggered fit
  // convergence commit before the clone is taken. Guarded so a host without the font loading
  // API, as jsdom in the tests, skips straight to the capture.
  // The DOM types fonts as always present, but jsdom omits it, so read it through a widened
  // binding rather than a check the types would call redundant.
  const fontSet: FontFaceSet | undefined =
    typeof document !== 'undefined' ? document.fonts : undefined;
  if (fontSet !== undefined) {
    await fontSet.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const blob = await toBlob(node, {
    pixelRatio,
    backgroundColor: '#ffffff',
    skipFonts: true,
  });
  if (blob === null) {
    throw new Error('poster capture produced no image');
  }
  return blob;
}

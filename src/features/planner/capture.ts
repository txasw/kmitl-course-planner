// Render a poster node to a PNG blob for the preview sharing actions. html-to-image
// clones the target subtree and inlines each element's computed styles, so the
// design token custom properties and gradient fills resolve to concrete values
// even though the stylesheet is adopted on the shadow root and the shadow root is
// closed in production; capturing from a node held by ref inside the React tree
// never reaches across the closed boundary. System fonts need no embedding, so
// font embedding is skipped and the Thai capable stack renders from the operating
// system in the clone as it does on screen. The white background and a device
// pixel ratio of two match the on screen poster at a crisp resolution.

import { toBlob } from 'html-to-image';

/** Render a node to a PNG blob, throwing when the capture yields no image. */
export async function capturePng(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
  });
  if (blob === null) {
    throw new Error('poster capture produced no image');
  }
  return blob;
}

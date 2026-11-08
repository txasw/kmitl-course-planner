// The landing page images (ADR-0066): each screenshot id with the widths it is encoded
// at, chosen from the width it is shown at on the page so a 2x screen gets sharp text
// without shipping larger files than it can use. The fallback width is the WebP the img
// element names for a browser that reads no AVIF. Shared by the encoder and
// the page renderer so the two never disagree on a file name.

export const SHOTS = {
  's-hero': { widths: [960, 1440, 2160, 2880], fallback: 1440 },
  's-hero-crop': { widths: [750, 1100], fallback: 750 },
  's-exam-row': { widths: [500, 1000], fallback: 500 },
  'x-share169': { widths: [960, 1440, 1920], fallback: 960 },
  'x-phone-portrait': { widths: [320, 640], fallback: 320 },
  's-updates': { widths: [700, 1400], fallback: 700 },
};

export const LOCALES = ['th', 'en'];

/** The served path of one encoded image. */
export function shotPath(id, locale, width, ext) {
  return `/shots/${id}-${locale}-${String(width)}.${ext}`;
}

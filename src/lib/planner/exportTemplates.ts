// The fixed export templates. Each renders the preview poster offscreen at exact
// pixel dimensions, independent of the viewport, so a download is identical on any
// screen (ADR-0041). The layout box is what the poster lays out at in CSS pixels;
// the pixel ratio scales that box to the output width and height, so the output is
// always layout dimension times the ratio.
//
// Axis orientation follows canvas orientation, one rule that every future preset inherits
// without a new decision (ADR-0045): a landscape canvas keeps normal axes, days as rows and
// time as columns; a portrait canvas transposes, days as columns and time flowing down, so a
// tall canvas fills top to bottom rather than drawing a thin landscape band on it. The
// orientation field therefore always matches the canvas aspect: it is portrait when the
// layout box is taller than wide and landscape when it is wider than tall.
//
// Each template carries a poster font size so its type scale fits its canvas, since
// completeness beats size. Layout widths stay at or above the grid's minimum (44rem, 704px)
// so the seven day tracks never overflow. Templates are named by use case, never by a device
// brand, and there are no custom sizes.

import type { TranslationKey } from '@/lib/i18n/t';

export interface ExportTemplate {
  slug: string;
  labelKey: TranslationKey;
  /** The box the poster lays out at, in CSS pixels, before the ratio scales it. */
  layoutWidth: number;
  layoutHeight: number;
  /** The output is the layout box times this ratio, so it is exact and integer. */
  pixelRatio: number;
  /** Landscape lays out days as rows, time as columns; portrait transposes to days as
   * columns, time flowing down, the natural fit for a tall canvas. */
  orientation: 'landscape' | 'portrait';
  /** The poster root font size in CSS pixels; every poster text node scales from it, so a
   * template can shrink its scale a step to keep the essential fields from clipping. */
  posterFontPx: number;
}

const SHARE_16_9: ExportTemplate = {
  slug: 'share-16-9',
  labelKey: 'preview.template.share',
  layoutWidth: 960,
  layoutHeight: 540,
  pixelRatio: 2,
  orientation: 'landscape',
  posterFontPx: 11,
};

export const EXPORT_TEMPLATES: readonly ExportTemplate[] = [
  SHARE_16_9,
  {
    // A true wide canvas at 20:9, the rotate to view fullscreen phone image. Share 16:9
    // covers classic 16:9, so one phone landscape preset suffices; a 21:9 device takes
    // minor letterboxing, which is acceptable (ADR-0045).
    slug: 'phone-wallpaper',
    labelKey: 'preview.template.phone',
    layoutWidth: 1200,
    layoutHeight: 540,
    pixelRatio: 2,
    orientation: 'landscape',
    posterFontPx: 11,
  },
  {
    slug: 'phone-wallpaper-portrait',
    labelKey: 'preview.template.phonePortrait',
    layoutWidth: 720,
    layoutHeight: 1560,
    pixelRatio: 1.5,
    orientation: 'portrait',
    posterFontPx: 12,
  },
  {
    slug: 'tablet-wallpaper-portrait',
    labelKey: 'preview.template.tabletPortrait',
    layoutWidth: 1024,
    layoutHeight: 1366,
    pixelRatio: 2,
    orientation: 'portrait',
    posterFontPx: 12,
  },
  {
    slug: 'tablet-wallpaper-landscape',
    labelKey: 'preview.template.tabletLandscape',
    layoutWidth: 1366,
    layoutHeight: 1024,
    pixelRatio: 2,
    orientation: 'landscape',
    posterFontPx: 12,
  },
  {
    slug: 'print-a4',
    labelKey: 'preview.template.printA4',
    layoutWidth: 877,
    layoutHeight: 620,
    pixelRatio: 4,
    orientation: 'landscape',
    posterFontPx: 11,
  },
];

export const DEFAULT_TEMPLATE = SHARE_16_9;

/** Resolve a persisted slug to a template, falling back to the default. */
export function templateBySlug(slug: string): ExportTemplate {
  return (
    EXPORT_TEMPLATES.find((template) => template.slug === slug) ??
    DEFAULT_TEMPLATE
  );
}

/** The exact output width in pixels: the layout width scaled by the ratio. */
export function templateOutputWidth(template: ExportTemplate): number {
  return Math.round(template.layoutWidth * template.pixelRatio);
}

/** The exact output height in pixels: the layout height scaled by the ratio. */
export function templateOutputHeight(template: ExportTemplate): number {
  return Math.round(template.layoutHeight * template.pixelRatio);
}

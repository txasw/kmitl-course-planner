// The fixed export templates. Each renders the preview poster offscreen at exact
// pixel dimensions, independent of the viewport, so a download is identical on any
// screen (ADR-0041). The layout box is what the poster lays out at in CSS pixels;
// the pixel ratio scales that box to the output width and height, so the output is
// always layout dimension times the ratio. The layout width stays at or above the
// grid's minimum (44rem, 704px) so the seven day columns never overflow. Templates
// are named by use case, never by a device brand, and there are no custom sizes.

import type { TranslationKey } from '@/lib/i18n/t';

export interface ExportTemplate {
  slug: string;
  labelKey: TranslationKey;
  /** The box the poster lays out at, in CSS pixels, before the ratio scales it. */
  layoutWidth: number;
  layoutHeight: number;
  /** The output is the layout box times this ratio, so it is exact and integer. */
  pixelRatio: number;
}

const SHARE_16_9: ExportTemplate = {
  slug: 'share-16-9',
  labelKey: 'preview.template.share',
  layoutWidth: 960,
  layoutHeight: 540,
  pixelRatio: 2,
};

export const EXPORT_TEMPLATES: readonly ExportTemplate[] = [
  SHARE_16_9,
  {
    slug: 'phone-wallpaper',
    labelKey: 'preview.template.phone',
    layoutWidth: 720,
    layoutHeight: 1560,
    pixelRatio: 1.5,
  },
  {
    slug: 'tablet-wallpaper',
    labelKey: 'preview.template.tablet',
    layoutWidth: 834,
    layoutHeight: 1194,
    pixelRatio: 2,
  },
  {
    slug: 'print-a4',
    labelKey: 'preview.template.printA4',
    layoutWidth: 877,
    layoutHeight: 620,
    pixelRatio: 4,
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

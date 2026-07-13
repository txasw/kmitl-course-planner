import { describe, it, expect } from 'vitest';
import {
  EXPORT_TEMPLATES,
  DEFAULT_TEMPLATE,
  templateBySlug,
  templateOutputWidth,
  templateOutputHeight,
} from './exportTemplates';

describe('export templates', () => {
  it('outputs the approved pixel dimensions', () => {
    const dims = Object.fromEntries(
      EXPORT_TEMPLATES.map((template) => [
        template.slug,
        [templateOutputWidth(template), templateOutputHeight(template)],
      ]),
    );
    expect(dims['share-16-9']).toEqual([1920, 1080]);
    expect(dims['phone-wallpaper']).toEqual([1080, 2340]);
    expect(dims['phone-wallpaper-portrait']).toEqual([1080, 2340]);
    expect(dims['tablet-wallpaper']).toEqual([1668, 2388]);
    expect(dims['print-a4']).toEqual([3508, 2480]);
  });

  it('marks exactly the portrait template as portrait', () => {
    const portrait = EXPORT_TEMPLATES.filter(
      (template) => template.orientation === 'portrait',
    ).map((template) => template.slug);
    expect(portrait).toEqual(['phone-wallpaper-portrait']);
  });

  it('gives every template a positive poster font size', () => {
    for (const template of EXPORT_TEMPLATES) {
      expect(template.posterFontPx).toBeGreaterThan(0);
    }
  });

  it('keeps every layout width at or above the grid minimum', () => {
    // 44rem is the grid's min width, so a narrower canvas would overflow the days.
    for (const template of EXPORT_TEMPLATES) {
      expect(template.layoutWidth).toBeGreaterThanOrEqual(704);
    }
  });

  it('produces integer output dimensions from the layout and ratio', () => {
    for (const template of EXPORT_TEMPLATES) {
      expect(Number.isInteger(template.layoutWidth * template.pixelRatio)).toBe(
        true,
      );
      expect(
        Number.isInteger(template.layoutHeight * template.pixelRatio),
      ).toBe(true);
    }
  });

  it('resolves a slug and falls back to the default', () => {
    expect(templateBySlug('phone-wallpaper').slug).toBe('phone-wallpaper');
    expect(templateBySlug('does-not-exist')).toBe(DEFAULT_TEMPLATE);
  });

  it('has unique slugs', () => {
    const slugs = EXPORT_TEMPLATES.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

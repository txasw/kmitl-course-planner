import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  BANNED,
  BANNED_THAI,
  DECORATIVE,
  EMOJI,
} from '../../src/lib/i18n/toneRules';
import { STORE_BADGES, THAI_KEEP } from '../../scripts/landing/render-page.mjs';
import {
  dedupeCounts,
  dedupeRows,
  storyBlocks,
} from '../../scripts/landing/site-data.mjs';
import {
  EVENT_PALETTE,
  EVENT_TINT_ALPHA,
  tintOverWhite,
} from '../../src/lib/utils/hash-color';
import { siteTextFiles } from '../../scripts/landing/site-files.mjs';

// Guards the landing site in site/ (ADR-0066): its titles and language alternates, the
// structured data, the disabled web control, links and images that resolve inside the
// folder, no asset or script from another origin and no analytics, markup the content
// security policy allows, the dedupe table against the capture it is generated from,
// the copy tone rules, and the Cloudflare configuration that serves it.

const ROOT = process.cwd();
const SITE = resolve(ROOT, 'site');
const ORIGIN = 'https://kcp.cecs.sh';
const CHROME =
  'https://chromewebstore.google.com/detail/bkjijmajieoojchaknjdpbkaomnofnef';
const FIREFOX =
  'https://addons.mozilla.org/firefox/addon/course-planner-for-kmitl/';

// Hosts a page may link to: the stores, the source, the site, and the registration
// site. Assets themselves must come from the site.
const LINK_HOSTS = new Set([
  'chromewebstore.google.com',
  'addons.mozilla.org',
  'github.com',
  'kcp.cecs.sh',
  'regis.reg.kmitl.ac.th',
]);

const ANALYTICS =
  /google-analytics|googletagmanager|gtag\(|plausible|umami|matomo|segment\.|hotjar|clarity\.ms|cloudflareinsights|statcounter/i;

interface Page {
  locale: 'th' | 'en';
  file: string;
  url: string;
}

const PAGES: readonly Page[] = [
  { locale: 'th', file: 'index.html', url: `${ORIGIN}/` },
  { locale: 'en', file: 'en/index.html', url: `${ORIGIN}/en/` },
];

function load(file: string): Document {
  return new DOMParser().parseFromString(
    readFileSync(join(SITE, file), 'utf8'),
    'text/html',
  );
}

/** The URLs one element carries in href, src, srcset or imagesrcset. */
function elementUrls(el: Element): string[] {
  const found: string[] = [];
  for (const name of ['href', 'src']) {
    const value = el.getAttribute(name);
    if (value !== null) found.push(value);
  }
  for (const name of ['srcset', 'imagesrcset']) {
    for (const candidate of (el.getAttribute(name) ?? '').split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url !== undefined && url !== '') found.push(url);
    }
  }
  return found;
}

/** Every URL the document's elements carry. */
function urls(doc: Document): string[] {
  return [
    ...doc.querySelectorAll('[href], [src], [srcset], [imagesrcset]'),
  ].flatMap(elementUrls);
}

/** Map a same site URL to the file it names in site/, or null for another origin. */
function siteFile(url: string): string | null {
  const path = url.startsWith(ORIGIN)
    ? url.slice(ORIGIN.length)
    : url.startsWith('/')
      ? url
      : null;
  if (path === null) return null;
  const clean = path.split(/[?#]/)[0] ?? '';
  return join(SITE, clean.endsWith('/') ? `${clean}index.html` : clean);
}

/** The first ten hex digits of a file's SHA-256, the version the build writes. */
function contentHash(file: string): string {
  return createHash('sha256')
    .update(readFileSync(file))
    .digest('hex')
    .slice(0, 10);
}

/** The width and height a brand file declares: a PNG's header, an SVG's view box. */
function intrinsicSize(src: string): number[] {
  const file = join(SITE, src);
  if (src.endsWith('.png')) {
    const bytes = readFileSync(file);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(
    readFileSync(file, 'utf8'),
  );
  return [Number(box?.[1]), Number(box?.[2])];
}

/** The header lines _headers sets for one exact path pattern. */
function headerRule(pattern: string): string[] {
  const lines = readFileSync(join(SITE, '_headers'), 'utf8').split(/\r?\n/);
  const start = lines.indexOf(pattern);
  if (start === -1) return [];
  const rule: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    rule.push(line.trim());
  }
  return rule;
}

interface CssRule {
  selectors: string[];
  decls: string[];
}

/** The stylesheet's innermost rules, comments removed, whitespace in values collapsed. */
function cssRules(): CssRule[] {
  const css = readFileSync(join(SITE, 'assets/site.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    ([, prelude = '', body = '']) => ({
      selectors: prelude.split(',').map((s) => s.trim()),
      decls: body.split(';').map((d) => d.trim().replace(/\s+/g, ' ')),
    }),
  );
}

function visibleText(doc: Document): string {
  const alts = [...doc.querySelectorAll('img[alt]')].map(
    (img) => img.getAttribute('alt') ?? '',
  );
  const metas = [
    ...doc.querySelectorAll('meta[name="description"], meta[property$=":alt"]'),
  ].map((meta) => meta.getAttribute('content') ?? '');
  return [doc.title, doc.body.textContent, ...alts, ...metas].join('\n');
}

describe.each(PAGES)('landing page $file', ({ locale, file, url }) => {
  const doc = load(file);

  it('declares its language and leads its title with KCP', () => {
    expect(doc.documentElement.lang).toBe(locale);
    expect(doc.title.startsWith('KCP')).toBe(true);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
  });

  it('names itself canonical and lists both language alternates', () => {
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe(url);
    const alternates: Record<string, string | null> = {};
    for (const link of doc.querySelectorAll(
      'link[rel="alternate"][hreflang]',
    )) {
      alternates[link.getAttribute('hreflang') ?? ''] =
        link.getAttribute('href');
    }
    expect(alternates).toEqual({
      th: `${ORIGIN}/`,
      en: `${ORIGIN}/en/`,
      'x-default': `${ORIGIN}/`,
    });
    expect(
      doc.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    ).toBe(url);
  });

  it('carries structured data that parses and names both install URLs', () => {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const data = JSON.parse(scripts[0]?.textContent ?? '') as {
      '@graph': { '@type': string; installUrl?: string[] }[];
    };
    const app = data['@graph'].find(
      (node) => node['@type'] === 'SoftwareApplication',
    );
    expect(app?.installUrl).toEqual([CHROME, FIREFOX]);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|"review"/);
  });

  it('gives the application only properties schema.org defines for it', () => {
    const script = doc.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '') as {
      '@graph': Record<string, unknown>[];
    };
    const app = data['@graph'].find(
      (node) => node['@type'] === 'SoftwareApplication',
    );
    // SoftwareApplication and the CreativeWork and Thing properties it inherits.
    const allowed = new Set([
      '@type',
      '@id',
      'name',
      'alternateName',
      'url',
      'description',
      'applicationCategory',
      'applicationSubCategory',
      'operatingSystem',
      'softwareRequirements',
      'softwareVersion',
      'inLanguage',
      'isAccessibleForFree',
      'offers',
      'installUrl',
      'downloadUrl',
      'sameAs',
      'image',
      'screenshot',
      'license',
      'author',
    ]);
    expect(Object.keys(app ?? {}).filter((key) => !allowed.has(key))).toEqual(
      [],
    );
  });

  it('answers the four questions students ask before installing', () => {
    expect(doc.querySelectorAll('#faq details')).toHaveLength(4);
  });

  it('links both stores from the page', () => {
    const hrefs = [...doc.querySelectorAll('a[href]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs.filter((href) => href === CHROME).length).toBeGreaterThan(1);
    expect(hrefs.filter((href) => href === FIREFOX).length).toBeGreaterThan(1);
  });

  // The web version waits after the badge pair, outside it, so the badges stay the
  // row's primary pair.
  it('shows the web version as a disabled button, never a link', () => {
    const soon = [...doc.querySelectorAll('.soon')];
    expect(soon.length).toBeGreaterThan(0);
    for (const control of soon) {
      const stores = control.closest('.cta-row')?.querySelector('.stores');
      expect(control.closest('.stores')).toBeNull();
      expect(
        (stores?.compareDocumentPosition(control) ?? 0) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);
      expect(control.tagName).toBe('BUTTON');
      expect(control.getAttribute('type')).toBe('button');
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(control.hasAttribute('href')).toBe(false);
      const note = control.getAttribute('aria-describedby') ?? '';
      expect(doc.getElementById(note)?.textContent).not.toBe('');
    }
  });

  it('resolves every internal link and image inside site/', () => {
    for (const value of urls(doc)) {
      if (value.startsWith('#')) {
        expect(doc.getElementById(value.slice(1)), value).not.toBeNull();
        continue;
      }
      const target = siteFile(value);
      if (target !== null) {
        expect(existsSync(target), value).toBe(true);
      }
    }
  });

  // Each install row is the stores' own badge pair, in the same order in the hero and the
  // closing band: each badge links to its listing, is served from the site at its own
  // proportions, and is named by the words it shows, with the browser added where the
  // words name none.
  it('installs through the official store badges, named by their words', () => {
    const rows = [...doc.querySelectorAll('.cta-row')];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const links = [...row.querySelectorAll('a.store')];
      expect(links.map((a) => a.getAttribute('href'))).toEqual([
        CHROME,
        FIREFOX,
      ]);
      links.forEach((link, i) => {
        const badge = STORE_BADGES[i];
        const img = link.querySelector('img.store__badge');
        expect(link.textContent.trim()).toBe('');
        expect(img?.getAttribute('alt')).toBe(badge?.alt);
        expect(img?.getAttribute('lang')).toBe('en');
        expect(img?.getAttribute('src')?.split('?')[0]).toBe(badge?.src);
        expect([
          Number(img?.getAttribute('width')),
          Number(img?.getAttribute('height')),
        ]).toEqual(intrinsicSize(badge?.src ?? ''));
      });
    }
    expect(STORE_BADGES.map((b) => b.alt)).toEqual([
      'Available in the Chrome Web Store',
      'Get the add-on for Firefox',
    ]);
  });

  // Every brand file is one the pages show, so a retired mark leaves the site with its use.
  it('serves only the brand files the page shows', () => {
    const used = new Set(
      urls(doc)
        .map((value) => value.split('?')[0])
        .filter((value) => value?.startsWith('/assets/brand/')),
    );
    expect(
      readdirSync(join(SITE, 'assets/brand'))
        .map((name) => `/assets/brand/${name}`)
        .sort(),
    ).toEqual([...used].sort());
  });

  it('gives every image alt text and its dimensions', () => {
    const images = [...doc.querySelectorAll('img:not(.store__badge)')];
    expect(images).toHaveLength(5);
    for (const img of images) {
      expect(img.getAttribute('alt')?.trim(), img.outerHTML).toBeTruthy();
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
    }
    const lazy = images.filter((img) => img.getAttribute('loading') === 'lazy');
    expect(lazy.length).toBe(images.length - 1);
    expect(images[0]?.getAttribute('fetchpriority')).toBe('high');
  });

  it('loads no asset from another origin and links only to known hosts', () => {
    for (const value of urls(doc)) {
      if (value.startsWith('#') || value.startsWith('/')) continue;
      const parsed = new URL(value);
      expect(parsed.protocol, value).toBe('https:');
      expect(LINK_HOSTS.has(parsed.hostname), value).toBe(true);
    }
    for (const el of doc.querySelectorAll(
      'script[src], link[rel="stylesheet"], link[rel="preload"], link[rel="icon"], img, source',
    )) {
      for (const value of elementUrls(el)) {
        expect(value.startsWith('/'), value).toBe(true);
      }
    }
  });

  it('loads the script in the head before the stylesheet, without defer', () => {
    const head = [...doc.head.children];
    const script = head.findIndex(
      (el) =>
        el.tagName === 'SCRIPT' &&
        el.getAttribute('src')?.startsWith('/assets/site.js') === true,
    );
    const sheet = head.findIndex(
      (el) => el.tagName === 'LINK' && el.getAttribute('rel') === 'stylesheet',
    );
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(sheet);
    expect(head[script]?.hasAttribute('defer')).toBe(false);
    expect(head[script]?.hasAttribute('async')).toBe(false);
  });

  it('runs no analytics', () => {
    const scripts = [...doc.querySelectorAll('script[src]')].map(
      (script) => script.getAttribute('src')?.split('?')[0],
    );
    expect(scripts).toEqual(['/assets/site.js']);
    for (const script of doc.querySelectorAll('script:not([src])')) {
      expect(script.getAttribute('type')).toBe('application/ld+json');
    }
    const head = doc.head.innerHTML;
    expect(head).not.toMatch(ANALYTICS);
    expect(readFileSync(join(SITE, 'assets/site.js'), 'utf8')).not.toMatch(
      ANALYTICS,
    );
    expect(readFileSync(join(SITE, 'assets/site.js'), 'utf8')).not.toMatch(
      /fetch\(|XMLHttpRequest|sendBeacon|localStorage|cookie/,
    );
  });

  it('renders the dedupe table from the capture in response order', () => {
    const rows = [...doc.querySelectorAll('#dedupe-table tbody tr')];
    const expected = dedupeRows(locale);
    expect(rows).toHaveLength(expected.length);
    rows.forEach((row, index) => {
      const want = expected[index];
      const cells = [...row.querySelectorAll('td')].map((td) =>
        td.textContent.replace(/\s+/g, ' ').trim(),
      );
      expect(row.getAttribute('data-row')).toBe(
        want?.duplicate === true ? 'repeat' : 'first',
      );
      expect(row.getAttribute('data-i')).toBe(String(index));
      expect(row.getAttribute('data-slot')).toBe(String(want?.slot));
      const first = expected.findIndex((r) => r.id === want?.id);
      expect(want?.slot).toBe(
        new Set(expected.slice(0, first + 1).map((r) => r.id)).size - 1,
      );
      expect(row.classList.contains(want?.subjectClass ?? '')).toBe(true);
      expect(cells.slice(1)).toEqual([
        want?.subjectId,
        want?.name,
        want?.section,
        want?.time,
        want?.seats,
      ]);
      expect(cells[0]?.startsWith(want?.grouping ?? '')).toBe(true);
    });
  });

  // The scroll plays the merge, so the stage has no control of its own, and a reader
  // without the motion or the sight of it gets the merged result in text.
  it('tells the merge in text with no control to press', () => {
    const stage = doc.querySelector('[data-dedupe]');
    expect(stage?.querySelector('button, [role="status"]')).toBeNull();
    const repeats = [
      ...doc.querySelectorAll('#dedupe-table tbody tr[data-row="repeat"]'),
    ];
    expect(repeats.length).toBeGreaterThan(0);
    for (const row of repeats) {
      expect(row.getAttribute('aria-hidden')).toBe('true');
    }
    const first = doc.querySelectorAll(
      '#dedupe-table tbody tr[data-row="first"]',
    ).length;
    const caption = doc.querySelector('#dedupe-table caption')?.textContent;
    expect(caption).toContain(String(first));
    expect(caption).toContain(String(first + repeats.length));
  });

  // The statement's claim and the table under it are the same sample.
  it('states the numbers of the sample the table shows', () => {
    const { rows, sections } = dedupeCounts();
    expect([rows, sections]).toEqual([13, 4]);
    const heading = doc.getElementById('problem-title')?.textContent ?? '';
    const numbers = heading.match(/\d+/g)?.map(Number);
    expect(numbers).toEqual([rows, sections]);
  });

  it('builds the story grid from plan H in the capture', () => {
    const story = storyBlocks(locale);
    const grid = doc.querySelector('.story__grid');
    const placed = (el: Element | null | undefined) => {
      const classes = [...(el?.classList ?? [])];
      const pick = (prefix: string) =>
        Number(classes.find((c) => c.startsWith(prefix))?.slice(prefix.length));
      return {
        day: pick('d-'),
        start: pick('h-') * 60,
        span: pick('span-') * 60,
        id: el?.querySelector('.story__id')?.textContent,
        name: el?.querySelector('.story__name')?.textContent ?? null,
        section: el?.querySelector('.story__sec')?.textContent,
        time: el?.querySelector('.story__time')?.textContent,
      };
    };
    const blocks = [
      ...(grid?.querySelectorAll('.story__block:not(.story__landed)') ?? []),
    ];
    expect(blocks.map(placed)).toEqual(
      story.blocks.map((b) => ({
        day: b.day,
        start: b.start,
        span: b.end - b.start,
        id: b.subjectId,
        name: b.name,
        section: b.section,
        time: b.time,
      })),
    );
    expect(story.blocks.map((b) => [b.day, b.start])).toEqual([
      [1, 540],
      [2, 540],
      [4, 540],
      [5, 540],
      [1, 780],
      [2, 780],
    ]);
    expect([story.ghost.subjectId, story.ghost.section]).toEqual([
      '01006021',
      '3',
    ]);
    expect([story.landed.subjectId, story.landed.section]).toEqual([
      '01006021',
      '5',
    ]);
    // The landed section is named like every other block, in Thai through the host's own
    // word for the term the tone rules reserve.
    expect(story.landed.name).toBe(
      locale === 'th'
        ? 'ปฏิบัติฟิสิกส์ทั่วไป 1'
        : 'GENERAL PHYSICS LABORATORY 1',
    );
    expect(placed(grid?.querySelector('.story__landed'))).toMatchObject({
      day: 3,
      start: 780,
      span: 180,
      id: '01006021',
      name: story.landed.name,
    });
    const layers = [...(grid?.querySelectorAll('.ghost__layer') ?? [])];
    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.querySelector('.story__name')?.textContent).toBe(
        story.ghost.name,
      );
    }
    expect(placed(grid?.querySelector('.story__ghost'))).toMatchObject({
      day: 2,
      start: 540,
      span: 180,
    });
    expect([story.credits, story.subjects]).toEqual([19, 7]);
  });

  it('names the cached assets by the hash of their content', () => {
    const versioned = urls(doc).filter((value) =>
      /^\/(?:assets\/site\.(?:css|js)|assets\/brand\/|shots\/)/.test(value),
    );
    expect(versioned.length).toBeGreaterThan(10);
    for (const value of versioned) {
      const target = siteFile(value);
      expect(target, value).not.toBeNull();
      expect(value.split('?')[1], value).toBe(`v=${contentHash(target ?? '')}`);
    }
  });

  it('holds no markup the content security policy would block', () => {
    expect(doc.querySelectorAll('style, [style]')).toHaveLength(0);
    expect(doc.querySelectorAll('meta[http-equiv]')).toHaveLength(0);
    for (const el of doc.querySelectorAll('*')) {
      for (const name of el.getAttributeNames()) {
        expect(name.startsWith('on'), `${el.tagName} ${name}`).toBe(false);
      }
    }
    for (const value of urls(doc)) {
      expect(/^(?:javascript|data):/.test(value), value).toBe(false);
    }
  });

  // Each pinned scene carries a rail and a keep scrolling cue, so a long hold never
  // reads as a page that has stopped. They are decoration: hidden from assistive
  // technology and holding nothing that takes focus.
  it('marks the pinned scene meters as decoration', () => {
    for (const pin of ['.dedupe-pin', '.story__pin']) {
      const meters = doc.querySelectorAll(`${pin} .scene-meter`);
      expect(meters.length, pin).toBe(1);
      const meter = meters[0];
      expect(meter?.getAttribute('aria-hidden')).toBe('true');
      expect(meter?.querySelector('.scene-cue')?.textContent.trim()).not.toBe(
        '',
      );
      expect(meter?.querySelector('.scene-cue svg')).not.toBeNull();
      expect(meter?.querySelector('a, button, input, [tabindex]')).toBeNull();
    }
    // Each sits just under its scene's content, where the reader's eye already is.
    expect(doc.querySelectorAll('.dedupe-stage > .scene-meter')).toHaveLength(
      1,
    );
    expect(doc.querySelectorAll('.story__grid > .scene-meter')).toHaveLength(1);
  });

  it('follows the copy tone rules', () => {
    const text = visibleText(doc);
    expect(EMOJI.test(text)).toBe(false);
    expect(text.match(DECORATIVE)).toBeNull();
    expect(text.includes('!')).toBe(false);
    const lower = text.toLowerCase();
    for (const word of BANNED) {
      expect(lower.includes(word), word).toBe(false);
    }
    if (locale === 'th') {
      for (const term of BANNED_THAI) {
        expect(text.includes(term), term).toBe(false);
      }
    }
  });
});

describe('Thai line breaking', () => {
  it('keeps every listed compound of the Thai page on one line', () => {
    const doc = load('index.html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const loose: string[] = [];
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      if (node.parentElement?.closest('.nw') != null) continue;
      const text = node.textContent ?? '';
      loose.push(...THAI_KEEP.filter((word) => text.includes(word)));
    }
    expect(THAI_KEEP.length).toBeGreaterThan(10);
    expect(loose).toEqual([]);
  });
});

describe('site files', () => {
  it('match what pnpm site:build renders from the sources', async () => {
    const files = await siteTextFiles();
    expect([...files.keys()].sort()).toEqual([
      '404.html',
      'en/404.html',
      'en/index.html',
      'index.html',
      'sitemap.xml',
    ]);
    for (const [relative, content] of files) {
      expect(readFileSync(join(SITE, relative), 'utf8'), relative).toBe(
        content,
      );
    }
  });

  it('serves the sitemap and the robots rules', () => {
    expect(readFileSync(join(SITE, 'robots.txt'), 'utf8')).toContain(
      `Sitemap: ${ORIGIN}/sitemap.xml`,
    );
    const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
    for (const loc of [`${ORIGIN}/`, `${ORIGIN}/en/`]) {
      expect(sitemap).toContain(`<loc>${loc}</loc>`);
    }
    expect(sitemap.match(/hreflang="x-default"/g)).toHaveLength(2);
  });

  it.each([
    ['404.html', 'th'],
    ['en/404.html', 'en'],
  ])('keeps the not found page %s out of the index', (file, lang) => {
    const doc = load(file);
    expect(doc.documentElement.lang).toBe(lang);
    expect(
      doc.querySelector('h1')?.closest('[lang]')?.getAttribute('lang'),
    ).toBe(lang);
    expect(
      doc.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex');
    for (const value of urls(doc)) {
      const target = siteFile(value);
      if (target !== null) {
        expect(existsSync(target), value).toBe(true);
      }
    }
  });

  // The font is served at a fixed path under a year long immutable cache, so a subset
  // regenerated in place would leave returning visitors on the old glyphs for a year.
  // Pinning its hash makes such an edit fail here; a new subset takes a new file name,
  // and this hash moves with it.
  it('never changes the display font in place', () => {
    const font = readFileSync(join(SITE, 'assets/fonts/kcp-display.woff2'));
    expect(createHash('sha256').update(font).digest('hex')).toBe(
      '8a40a0047c48358d30aad097d5e6739d8da1122d4664524c514fd5818756ac4a',
    );
  });

  it('tints every subject as the product does', () => {
    const css = readFileSync(join(SITE, 'assets/site.css'), 'utf8');
    EVENT_PALETTE.forEach((color, index) => {
      const rule = new RegExp(
        String.raw`\.subject-${String(index)} \{[^}]*--subject: ([^;]+);[^}]*--tint: ([^;]+);`,
      ).exec(css);
      expect(rule?.[1], `subject-${String(index)}`).toBe(color.toLowerCase());
      expect(rule?.[2], `subject-${String(index)}`).toBe(
        tintOverWhite(color, EVENT_TINT_ALPHA),
      );
    });
  });

  // Progressive enhancement: a reader without the script, or who prefers reduced motion,
  // sees every block. Any rule that hides or moves something at rest therefore applies
  // only under the .motion class the script sets. The FAQ chevron's turn is a state,
  // not motion.
  it('hides and moves nothing at rest outside the motion class', () => {
    const css = readFileSync(join(SITE, 'assets/site.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    const offenders: string[] = [];
    for (const [, prelude = '', body = ''] of css.matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    )) {
      const decls = body.split(';').map((d) => d.trim());
      const hides = decls.some((d) => /^opacity:\s*0$/.test(d));
      const moves = decls.some((d) => {
        const value = /^transform:\s*(.+)$/.exec(d)?.[1];
        return (
          value !== undefined && value !== 'none' && value !== 'rotate(180deg)'
        );
      });
      if (!hides && !moves) continue;
      for (const selector of prelude.split(',')) {
        if (!selector.trim().startsWith('.motion')) {
          offenders.push(selector.trim());
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // The pinned hero stage is a window tall box that starts above the frame it centres,
  // over the install buttons; were it to take the pointer, a click on a button's centre
  // would land on the empty stage and do nothing.
  it('lets the pinned hero stage pass the pointer through to the buttons', () => {
    const rules = cssRules();
    const pins = rules.filter(
      (rule) =>
        rule.selectors.some((s) => s.endsWith('.hero__pin')) &&
        rule.decls.includes('position: sticky'),
    );
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(pin.decls).toContain('pointer-events: none');
    }
    expect(
      rules.some(
        (rule) =>
          rule.selectors.some((s) => s.endsWith('.frame')) &&
          rule.decls.includes('pointer-events: auto'),
      ),
    ).toBe(true);
  });

  // A short phone gives few pixels of scroll to a track sized in screens alone, and a
  // steady scroll would pass a scene's end state before it had held. Every pinned scene
  // track keeps a pixel floor under its screen based length, its --pinned scroll, which
  // also sizes the track and the scene's rail.
  it('keeps a pixel floor under every pinned scene track', () => {
    const tracks = cssRules().filter((rule) =>
      rule.selectors.some(
        (s) => s === '.motion .dedupe-track' || s === '.motion .story__track',
      ),
    );
    const pinned = tracks.flatMap((rule) =>
      rule.decls.filter((d) => d.startsWith('--pinned:')),
    );
    expect(pinned.length).toBeGreaterThanOrEqual(3);
    for (const length of pinned) {
      expect(length).toMatch(/max\(\d+svh[^,]*, \d+px\)/);
    }
    const heights = tracks.flatMap((rule) =>
      rule.decls.filter((d) => d.startsWith('height:')),
    );
    expect(heights.length).toBe(2);
    for (const height of heights) {
      expect(height).toBe(
        'height: calc(100svh - var(--header-h) + var(--pinned))',
      );
    }
    // Every rail fills a tenth of a pixel for each pixel of pinned scroll.
    const rail = cssRules().find((rule) =>
      rule.selectors.includes('.motion .scene-rail'),
    );
    expect(rail?.decls).toContain(
      'width: min(calc(var(--pinned) / 10), 100vw - 72px)',
    );
  });

  // The closing band is the page's last call to action: its mark, heading and badges
  // rise on their own view like every revealed block, so they stand at full strength
  // once their top is 85 percent down the window, and the band clips its glow without
  // becoming a scroll container that would capture that view.
  it('lets the closing heading and badges finish rising as a revealed block does', () => {
    const rules = cssRules();
    const animation = (selector: string) =>
      rules
        .find(
          (rule) =>
            rule.selectors.includes(selector) &&
            rule.decls.some((d) => d.startsWith('animation-timeline:')),
        )
        ?.decls.filter((d) => d.startsWith('animation-'));
    const reveal = animation('.motion:not(.no-sda) [data-reveal]');
    const range = reveal?.find((d) => d.startsWith('animation-range:'));
    expect(reveal).toContain('animation-timeline: view()');
    for (const selector of [
      '.motion:not(.no-sda) .download__mark',
      '.motion:not(.no-sda) .download .statement__h',
      '.motion:not(.no-sda) .download .cta-row',
    ]) {
      const decls = animation(selector);
      expect(decls).toContain('animation-timeline: view()');
      expect(decls?.find((d) => d.startsWith('animation-range:'))).toBe(range);
    }
    const band = rules.find(
      (rule) =>
        rule.selectors.includes('.download') &&
        rule.decls.some((d) => d.startsWith('overflow')),
    );
    expect(band?.decls.filter((d) => d.startsWith('overflow')).at(-1)).toBe(
      'overflow: clip',
    );
  });

  // A Firefox visitor finds the Firefox badge first. site.js moves it in the document,
  // so focus reaches the badges in the order they show; the stylesheet never reorders
  // them on screen alone.
  it('never reorders the install badges on screen alone', () => {
    const reordered = cssRules().filter(
      (rule) =>
        rule.selectors.some((s) => /\.stores?\b|\.store--/.test(s)) &&
        rule.decls.some(
          (d) =>
            d.startsWith('order:') || /^flex-direction: \S*reverse/.test(d),
        ),
    );
    expect(reordered).toEqual([]);
  });

  // The pinned scenes follow the scroll through intersection observers and scroll
  // driven animations only, never through an event fired on every scroll frame. The one
  // exception is the keep scrolling cue: while it shows, the reader's first wheel, touch
  // or key hides it, through passive listeners that are removed together once it hides.
  it('listens to no scroll or touch move event, and to a nudge only while the cue shows', () => {
    const script = readFileSync(join(SITE, 'assets/site.js'), 'utf8');
    expect(script).not.toMatch(
      /addEventListener\(\s*['"](?:scroll|wheel|touchmove|touchstart|keydown)/,
    );
    expect(script).not.toMatch(/\bon(?:scroll|wheel|touchmove)\b/);
    expect(script).not.toMatch(/['"](?:scroll|touchmove)['"]/);
    expect(script).toContain(
      "const NUDGES = ['wheel', 'touchstart', 'keydown'];",
    );
    const listeners = [...script.matchAll(/addEventListener\(([^)]*)/g)].map(
      ([, args = '']) => args.replace(/\s+/g, ' '),
    );
    const nudges = listeners.filter((args) => args.startsWith('type,'));
    expect(nudges).toHaveLength(1);
    expect(nudges[0]).toMatch(/passive: true, signal: nudged\.signal/);
    expect(script).toMatch(/listening\?\.abort\(\)/);
  });

  // The rail and the cue show only under the motion class, so a reader without the
  // script or with reduced motion meets neither.
  it('shows the pinned scene meters only under the motion class', () => {
    const outside = cssRules().filter((rule) =>
      rule.selectors.some(
        (s) => s.includes('.scene-') && !s.startsWith('.motion'),
      ),
    );
    expect(outside.length).toBeGreaterThan(0);
    for (const rule of outside) {
      expect(rule.decls.filter(Boolean)).toEqual(['display: none']);
    }
  });

  // A released scene leaves on purpose rather than sliding off at once, at the pace of
  // the scroll: on a scroll driven browser over the exit range of its track, elsewhere
  // from --leave, which site.js steps from the sentinels past the release. Neither end
  // state hides it outright.
  it('gives each pinned scene a designed exit', () => {
    const rules = cssRules();
    for (const pin of ['.dedupe-pin', '.story__pin']) {
      const scrolled = rules.find(
        (rule) =>
          rule.selectors.includes(`.motion:not(.no-sda) ${pin}`) &&
          rule.decls.some((d) => d.startsWith('animation-timeline:')),
      );
      expect(scrolled?.decls, pin).toContain(
        'animation-range: exit 0% exit 80%',
      );
      const leaving = rules.filter((rule) =>
        rule.selectors.includes(`.motion.no-sda ${pin}`),
      );
      const fades = leaving.flatMap((rule) =>
        rule.decls.filter((d) => d.startsWith('opacity:')),
      );
      expect(fades, pin).toEqual(['opacity: calc(1 - 0.8 * var(--leave, 0))']);
      expect(
        leaving.some((rule) =>
          rule.decls.some(
            (d) => d.startsWith('transform:') && d.includes('var(--leave, 0)'),
          ),
        ),
        pin,
      ).toBe(true);
    }
  });

  // A slow reader in a pinned hold always sees the content move with the scroll, not
  // only the rail: each hold has highlights on a window of the pinned scroll, played on
  // the track's view timeline where the browser has one and from --progress elsewhere.
  it('moves the content of every pinned hold with the scroll', () => {
    const rules = cssRules();
    const scrolled = (target: string) =>
      rules.some(
        (rule) =>
          rule.selectors.some(
            (s) => s.startsWith('.motion:not(.no-sda) ') && s.includes(target),
          ) &&
          rule.decls.includes('animation-timeline: --scene') &&
          rule.decls.some(
            (d) =>
              d.startsWith('animation-range:') && d.includes('var(--from)'),
          ),
      );
    const stepped = (target: string) =>
      rules.some(
        (rule) =>
          rule.selectors.some(
            (s) => s.startsWith('.motion.no-sda ') && s.includes(target),
          ) && rule.decls.some((d) => d.includes('var(--progress, 0)')),
      );
    for (const target of [
      '.dedupe::before',
      ".dedupe tr[data-row='first']::before",
      ".dedupe tr[data-row='first'] .dedupe__chip::before",
      '.ghost__danger::after',
      '.story__chip::after',
      '.story__ghost::after',
      '.story__ghost::before',
      '.story__readout::before',
    ]) {
      expect(scrolled(target), target).toBe(true);
      expect(stepped(target), target).toBe(true);
    }
    const cards = rules.find((rule) =>
      rule.selectors.includes('.motion:not(.no-sda) .story__card::before'),
    );
    expect(cards?.decls).toContain('animation-timeline: --scene, --scene');
    expect(stepped('.story__card::before')).toBe(true);
  });

  // A revealed block fades in step with the scroll, so a steady scroll never sees it
  // jump most of the way to full strength in one frame; only its rise is eased.
  it('fades every revealed block linearly with the scroll', () => {
    const css = readFileSync(join(SITE, 'assets/site.css'), 'utf8');
    const fade = /@keyframes reveal-fade \{([\s\S]*?)\n\}/.exec(css)?.[1];
    expect(fade).toBeDefined();
    expect(fade).not.toContain('animation-timing-function');
    const reveal = cssRules().find((rule) =>
      rule.selectors.includes('.motion:not(.no-sda) [data-reveal]'),
    );
    expect(reveal?.decls).toContain(
      'animation: reveal-fade linear both, reveal-rise linear both',
    );
  });

  it('loads no remote url from the stylesheet', () => {
    const css = readFileSync(join(SITE, 'assets/site.css'), 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      expect(match[1]?.startsWith('/'), match[1]).toBe(true);
    }
  });
});

interface WranglerConfig {
  name?: string;
  main?: string;
  compatibility_date?: string;
  assets?: Record<string, string>;
  routes?: { pattern?: string; custom_domain?: boolean }[];
  workers_dev?: boolean;
}

describe('Cloudflare hosting', () => {
  it('deploys site/ as static assets on the kcp.cecs.sh custom domain', () => {
    const file = join(ROOT, 'wrangler.jsonc');
    const parsed = ts.parseConfigFileTextToJson(
      file,
      readFileSync(file, 'utf8'),
    );
    expect(parsed.error).toBeUndefined();
    // The parser returns the JSON as any; the fields read here are checked below.
    const config = parsed.config as WranglerConfig;
    expect(config.name).toBe('kcp-landing');
    expect(config.main).toBeUndefined();
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.assets).toEqual({
      directory: './site',
      html_handling: 'auto-trailing-slash',
      not_found_handling: '404-page',
    });
    expect(config.routes).toEqual([
      { pattern: 'kcp.cecs.sh', custom_domain: true },
    ]);
    expect(config.workers_dev).toBe(false);
  });

  it('sends the security headers on every path', () => {
    const all = headerRule('/*');
    const csp = all.find((line) =>
      line.startsWith('Content-Security-Policy: '),
    );
    for (const directive of [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp, directive).toContain(directive);
    }
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
    expect(all).toContain(
      'Strict-Transport-Security: max-age=63072000; includeSubDomains',
    );
    expect(all).toContain('X-Content-Type-Options: nosniff');
    expect(all).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(all.some((line) => line.startsWith('Permissions-Policy: '))).toBe(
      true,
    );
    // Values of a header set by two matching rules are joined, so the catch all rule
    // never sets the cache policy the narrower rules own.
    expect(all.some((line) => line.startsWith('Cache-Control'))).toBe(false);
  });

  it('revalidates the pages and caches the versioned assets for a year', () => {
    for (const page of ['/', '/en/']) {
      expect(headerRule(page)).toEqual(['Cache-Control: no-cache']);
    }
    for (const assets of ['/assets/*', '/shots/*']) {
      expect(headerRule(assets)).toEqual([
        'Cache-Control: public, max-age=31536000, immutable',
      ]);
    }
  });

  it('redirects the guessed Thai path to the root', () => {
    const rules = readFileSync(join(SITE, '_redirects'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line !== '' && !line.startsWith('#'));
    expect(rules).toEqual(['/th / 301', '/th/ / 301', '/th/* / 301']);
  });

  it('keeps no GitHub Pages configuration', () => {
    expect(existsSync(join(SITE, 'CNAME'))).toBe(false);
    expect(existsSync(join(ROOT, '.github', 'workflows', 'pages.yml'))).toBe(
      false,
    );
  });
});

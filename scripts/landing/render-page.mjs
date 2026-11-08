// Renders one locale of the landing page to static HTML (ADR-0066). The page carries
// no framework runtime: plain HTML, one local stylesheet, and one deferred script that
// only enhances the dedupe table and the Firefox button order. Copy comes from
// copy.th.mjs and copy.en.mjs, the dedupe rows and counts from site-data.mjs, and the
// image files from the encoder's manifest.

import { shotPath } from './shots.mjs';

export const ORIGIN = 'https://kcp.cecs.sh';
export const CHROME_URL =
  'https://chromewebstore.google.com/detail/bkjijmajieoojchaknjdpbkaomnofnef';
export const FIREFOX_URL =
  'https://addons.mozilla.org/firefox/addon/course-planner-for-kmitl/';
export const REPO_URL = 'https://github.com/txasw/kmitl-course-planner';
const PRIVACY_URL = `${REPO_URL}/blob/main/docs/PRIVACY.md`;
const ISSUES_URL = `${REPO_URL}/issues`;

// Stroke icons drawn from the lucide set the extension already ships (ISC license).
const STROKE =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const ICONS = {
  puzzle: `<svg class="icon" width="20" height="20" ${STROKE}><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>`,
  globe: `<svg class="icon" width="20" height="20" ${STROKE}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  chevron: `<svg class="icon faq__chevron" width="20" height="20" ${STROKE}><path d="m6 9 6 6 6-6"/></svg>`,
  lock: `<svg class="icon" width="14" height="14" ${STROKE}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
};

/** The KCP mark, the extension icon drawn inline. Decorative where it sits beside text. */
export function mark(size, className = 'mark') {
  return `<svg class="${className}" width="${String(size)}" height="${String(size)}" viewBox="0 0 128 128" aria-hidden="true" focusable="false"><rect width="128" height="128" rx="28" fill="#E35205"/><g fill="#FFFFFF"><rect x="22" y="22" width="38" height="38" rx="6"/><rect x="68" y="22" width="38" height="38" rx="6"/><rect x="22" y="68" width="38" height="38" rx="6"/></g><rect x="68" y="68" width="38" height="38" rx="6" fill="#B8400A"/></svg>`;
}

function attr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

function srcset(id, locale, entry, ext) {
  return entry.widths
    .map((w) => `${shotPath(id, locale, w, ext)} ${String(w)}w`)
    .join(', ');
}

function manifestEntry(manifest, id, locale) {
  const entry = manifest[`${id}-${locale}`];
  if (entry === undefined) {
    throw new Error(
      `No encoded image for ${id}-${locale}. Run pnpm site:encode.`,
    );
  }
  return entry;
}

/**
 * A screenshot as a picture element: AVIF, then WebP, with the img naming the WebP at
 * the fallback width and the intrinsic size, so the box is reserved before the bytes
 * arrive.
 */
export function picture(manifest, id, locale, options) {
  const entry = manifestEntry(manifest, id, locale);
  const sizes = options.sizes;
  const art = options.art ?? [];
  const artSources = art
    .map((source) => {
      const artEntry = manifestEntry(manifest, source.id, locale);
      return ['avif', 'webp']
        .map(
          (ext) =>
            `<source media="${source.media}" type="image/${ext}" srcset="${srcset(source.id, locale, artEntry, ext)}" sizes="${source.sizes}">`,
        )
        .join('');
    })
    .join('');
  const sources = ['avif', 'webp']
    .map(
      (ext) =>
        `<source type="image/${ext}" srcset="${srcset(id, locale, entry, ext)}" sizes="${sizes}">`,
    )
    .join('');
  const loading = options.eager
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';
  const width = entry.fallback;
  const height = entry.sizes[String(width)];
  return `<picture>${artSources}${sources}<img src="${shotPath(id, locale, width, 'webp')}" width="${String(width)}" height="${String(height)}" alt="${attr(options.alt)}" ${loading}${options.className === undefined ? '' : ` class="${options.className}"`}></picture>`;
}

/**
 * The preload hint for the hero image on wide screens, where it is the largest paint
 * on a tall window. A phone gets no preload: its crop starts below the first screen,
 * and a high priority request would only compete with the stylesheet and the font.
 */
function heroPreload(manifest, locale) {
  const hero = manifestEntry(manifest, 's-hero', locale);
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset('s-hero', locale, hero, 'avif')}" imagesizes="${HERO_SIZES}" media="(min-width: 640px)" fetchpriority="high">`;
}

const HERO_SIZES =
  '(min-width: 1440px) 1264px, calc(100vw - 2 * clamp(20px, 5vw, 64px))';
const CROP_SIZES = 'calc(100vw - 40px)';
const PLATE_8 = '(min-width: 1024px) 792px, calc(100vw - 40px)';
// The exam pair splits the eight image columns three to five, so the exam schedule is
// shown large enough to read beside the narrow exam card.
const PAIR_NARROW =
  '(min-width: 1024px) 288px, (min-width: 640px) calc(34vw - 12px), calc(100vw - 40px)';
const PAIR_WIDE =
  '(min-width: 1024px) 480px, (min-width: 640px) calc(56vw - 20px), calc(100vw - 40px)';
const INSET = '(min-width: 640px) 340px, calc(100vw - 40px)';
const PROBLEM_SHOT =
  '(min-width: 1280px) 384px, (min-width: 520px) 480px, calc(100vw - 40px)';
const FULL = '(min-width: 1280px) 1200px, calc(100vw - 40px)';

// The touch note leads, so a phone visitor reads that the stores install on a computer
// before any button. The hero keeps its fine print short: the trust line first, then
// the web version note in one clause; the download band carries the full note.
function ctaRow(copy, size) {
  const hero = size === 'hero';
  return `<p class="cta-coarse">${copy.cta.coarse}</p>
<div class="cta-row cta-row--${size}">
<a class="cta cta--chrome" href="${CHROME_URL}">${ICONS.puzzle}<span class="cta__text"><span class="cta__label">${copy.cta.chrome}</span><span class="cta__sub">${copy.cta.chromeSub}</span></span></a>
<a class="cta cta--firefox" href="${FIREFOX_URL}">${ICONS.puzzle}<span class="cta__text"><span class="cta__label">${copy.cta.firefox}</span><span class="cta__sub">${copy.cta.firefoxSub}</span></span></a>
<button type="button" class="cta cta--soon" aria-disabled="true" aria-describedby="web-soon-note-${size}">${ICONS.globe}<span class="cta__text"><span class="cta__label">${copy.cta.web} <span class="badge">${copy.cta.webBadge}</span></span></span></button>
</div>
${
  hero
    ? `<p class="micro">${copy.hero.fine}</p>
`
    : ''
}<p class="cta-note" id="web-soon-note-${size}">${hero ? copy.cta.webNoteShort : copy.cta.webNote}</p>`;
}

// A phone shows a plate's crop where one exists: the desktop capture scaled to a phone
// would set the product's text at a few pixels.
const PHONE = '(max-width: 639px)';

function figure(
  manifest,
  id,
  locale,
  alt,
  caption,
  sizes,
  className = 'plate',
  crop = null,
) {
  const art =
    crop === null ? [] : [{ id: crop, media: PHONE, sizes: CROP_SIZES }];
  return `<figure class="${className}">${picture(manifest, id, locale, { alt, sizes, className: 'plate__img', art })}<figcaption>${caption}</figcaption></figure>`;
}

// The section links name the page they belong to only when the header sits on another
// page, the not found page, so they never point at an anchor the page lacks.
function header(copy, base = '') {
  const other = copy.other;
  return `<a class="skip" href="#content">${copy.skip}</a>
<header class="site-header">
<div class="container site-header__inner">
<a class="brand" href="${copy.path}">${mark(28)}<span class="brand__word" lang="en">KCP</span><span class="visually-hidden">${copy.nav.home}</span></a>
<nav class="site-nav" aria-label="${copy.nav.label}">
<ul>
<li class="site-nav__wide"><a href="${base}#features">${copy.nav.features}</a></li>
<li class="site-nav__wide"><a href="${base}#get-started">${copy.nav.start}</a></li>
<li class="site-nav__wide"><a href="${base}#faq">${copy.nav.faq}</a></li>
<li><a href="${other.href}" lang="${other.lang}" hreflang="${other.lang}">${other.text}</a></li>
<li><a class="nav-install" href="${base}#download">${copy.install}</a></li>
</ul>
</nav>
</div>
</header>`;
}

function ruler() {
  const hours = [];
  for (let h = 8; h <= 18; h += 1) {
    hours.push(`<span>${String(h).padStart(2, '0')}:00</span>`);
  }
  return `<div class="field" aria-hidden="true"><div class="field__ruler">${hours.join('')}</div></div>`;
}

// Thai sets no space between the two phrases of the headline, so the break between them
// is a <wbr>; English joins them with a plain space.
function hero(copy, manifest) {
  const locale = copy.lang;
  return `<section class="hero" aria-labelledby="hero-title">
${ruler()}
<div class="container hero__inner">
<div class="hero__text">
<h1 id="hero-title"><span class="hero__lockup">${copy.hero.lockup}</span><span class="hero__display">${copy.hero.line1}${copy.lang === 'th' ? '<wbr>' : ' '}<span class="hero__break">${copy.hero.line2}</span></span></h1>
<p class="lede">${copy.hero.lede}</p>
${ctaRow(copy, 'hero')}
</div>
<div class="frame">
<div class="frame__bar" aria-hidden="true"><span class="frame__dots"><i></i><i></i><i></i></span><span class="frame__url">${ICONS.lock}<span>regis.reg.kmitl.ac.th/#/teach_table_selector</span></span></div>
${picture(manifest, 's-hero', locale, {
  alt: copy.hero.alt,
  sizes: HERO_SIZES,
  eager: true,
  className: 'frame__img',
  art: [{ id: 's-hero-crop', media: PHONE, sizes: CROP_SIZES }],
})}
</div>
</div>
</section>`;
}

function problem(copy, manifest, rowsHtml, counts) {
  const p = copy.problem;
  const headers = p.headers
    .map((h) => `<th scope="col" role="columnheader">${h}</th>`)
    .join('');
  return `<section class="band problem" aria-labelledby="problem-title">
<div class="container problem__grid">
<div class="problem__text">
<h2 id="problem-title">${p.h2}</h2>
<p class="body">${p.body}</p>
<div class="dedupe-wrap" data-dedupe data-label="${attr(p.toggle)}" data-merged="${attr(p.merged(counts))}" data-unmerged="${attr(p.unmerged(counts))}">
<table class="dedupe" id="dedupe-table" role="table">
<caption>${p.caption(counts)}</caption>
<thead role="rowgroup"><tr role="row">${headers}</tr></thead>
<tbody role="rowgroup">
${rowsHtml}
</tbody>
</table>
<p class="dedupe__result">${p.staticResult(counts)}</p>
<p class="visually-hidden" role="status" aria-live="polite" data-dedupe-status></p>
</div>
</div>
${figure(manifest, 's-catalog-dedupe', copy.lang, p.shotAlt, p.shotCaption, PROBLEM_SHOT, 'plate problem__shot')}
</div>
</section>`;
}

function feature(id, h3, body, media, modifier = '') {
  return `<article class="feature${modifier}" aria-labelledby="${id}-title">
<div class="feature__caption"><h3 id="${id}-title">${h3}</h3><p class="body">${body}</p></div>
<div class="feature__media">${media}</div>
</article>`;
}

function features(copy, manifest) {
  const l = copy.lang;
  const c = copy;
  const narrow = ['n-catalog', 'n-day', 'n-sheet']
    .map(
      (id, i) =>
        `<figure class="narrow"><div class="narrow__bar" aria-hidden="true"><span class="frame__url">${ICONS.lock}<span>regis.reg.kmitl.ac.th</span></span></div>${picture(manifest, id, l, { alt: c.layouts.alts[i], sizes: '(min-width: 1024px) 340px, 280px', className: 'narrow__img' })}<figcaption>${c.layouts.figs[i]}</figcaption></figure>`,
    )
    .join('');
  const perms = c.privacy.perms
    .map(
      ([token, reason]) =>
        `<div class="perm"><dt lang="en">${token}</dt><dd>${reason}</dd></div>`,
    )
    .join('');
  return `<section class="features" id="features" aria-labelledby="features-title">
<div class="container">
<h2 id="features-title" class="features__title">${c.featuresH2}</h2>
${feature('search', c.search.h3, c.search.body, figure(manifest, 's-search-form', l, c.search.alt, c.search.h3, PLATE_8, 'plate plate--column'))}
${feature('conflict', c.conflict.h3, c.conflict.body, `<div class="stack">${figure(manifest, 's-drag-blocked', l, c.conflict.alt1, c.conflict.fig1, PLATE_8, 'plate', 's-drag-blocked-crop')}${figure(manifest, 's-feedback-alternatives', l, c.conflict.alt2, c.conflict.fig2, PLATE_8, 'plate', 's-feedback-crop')}</div>`)}
${feature('exam', c.exam.h3, c.exam.body, `<div class="pair">${figure(manifest, 's-exam-row', l, c.exam.alt1, c.exam.fig1, PAIR_NARROW)}${figure(manifest, 's-summary', l, c.exam.alt2, c.exam.fig2, PAIR_WIDE, 'plate', 's-summary-crop')}</div>`)}
${feature('layouts', c.layouts.h3, c.layouts.body, `<div class="strip" role="region" aria-label="${attr(c.layouts.region)}" tabindex="0">${narrow}</div><p class="footnote">${c.layouts.footnote}</p>`, ' feature--wide')}
${feature('export', c.export.h3, c.export.body, `<div class="posters">${figure(manifest, 'x-share169', l, c.export.alt1, '', FULL, 'poster poster--wide')}${figure(manifest, 'x-phone-portrait', l, c.export.alt2, '', '(min-width: 1024px) 264px, 40vw', 'poster poster--phone')}</div><p class="footnote">${c.export.templates}</p>`, ' feature--wide')}
${feature('plans', c.plans.h3, c.plans.body, `<div class="stack">${figure(manifest, 's-updates', l, c.plans.alt1, c.plans.fig1, PLATE_8)}${figure(manifest, 's-plan-menu', l, c.plans.alt2, c.plans.fig2, INSET, 'plate plate--inset')}</div>`)}
</div>
<div class="privacy-band">
<div class="container">
${feature('privacy', c.privacy.h3, c.privacy.body, `<h4>${c.privacy.heading}</h4><dl class="perms">${perms}</dl><p><a class="text-link" href="${PRIVACY_URL}">${c.privacy.link}</a></p>`)}
</div>
</div>
</section>`;
}

function more(copy, manifest) {
  const items = copy.more.items
    .map(
      ([term, def]) =>
        `<div class="more__item"><dt>${term}</dt><dd>${def}</dd></div>`,
    )
    .join('');
  return `<section class="more" aria-labelledby="more-title">
<div class="container more__grid">
<div><h2 id="more-title">${copy.more.h2}</h2><dl class="more__list">${items}</dl></div>
${figure(manifest, 's-suggest', copy.lang, copy.more.alt, copy.more.fig, FULL, 'plate', 's-suggest-crop')}
</div>
</section>`;
}

function steps(copy, manifest) {
  const items = copy.steps.items
    .map(
      ([title, body], i) =>
        `<li class="step"><span class="step__num" aria-hidden="true">${String(i + 1)}</span><h3 class="step__title">${title}</h3><p>${body}</p></li>`,
    )
    .join('');
  return `<section class="steps" id="get-started" aria-labelledby="steps-title">
<div class="container">
<h2 id="steps-title">${copy.steps.h2}</h2>
<p class="body steps__intro">${copy.steps.intro}</p>
<ol class="steps__list">${items}</ol>
${figure(manifest, 's-welcome', copy.lang, copy.steps.alt, copy.steps.fig, '(min-width: 640px) 448px, calc(100vw - 40px)', 'plate steps__shot')}
</div>
</section>`;
}

function download(copy, version) {
  return `<section class="band download" id="download" aria-labelledby="download-title">
<div class="container download__grid">
${mark(96, 'mark download__mark')}
<div>
<h2 id="download-title">${copy.download.h2}</h2>
<p class="body">${copy.download.body}</p>
${ctaRow(copy, 'band')}
<p class="micro">${copy.download.meta(version, `<a class="text-link" href="${REPO_URL}">${copy.download.source}</a>`)}</p>
</div>
</div>
</section>`;
}

function faq(copy) {
  const items = copy.faq.items
    .map(
      ([q, a]) =>
        `<details class="faq__item"><summary><span>${q}</span>${ICONS.chevron}</summary><p>${a}</p></details>`,
    )
    .join('');
  return `<section class="faq" id="faq" aria-labelledby="faq-title">
<div class="container"><h2 id="faq-title">${copy.faq.h2}</h2><div class="faq__list">${items}</div></div>
</section>`;
}

function footer(copy) {
  const f = copy.footer;
  const other = copy.other;
  return `<footer class="site-footer">
<div class="container site-footer__grid">
<div class="site-footer__text"><p>${f.disclaimer}</p><p>${f.sitePrivacy}</p></div>
<nav aria-label="${f.linksLabel}"><ul class="site-footer__links">
<li><a href="${CHROME_URL}" lang="en">Chrome Web Store</a></li>
<li><a href="${FIREFOX_URL}" lang="en">Firefox Add-ons</a></li>
<li><a href="${REPO_URL}">${f.source}</a></li>
<li><a href="${PRIVACY_URL}">${f.privacy}</a></li>
<li><a href="${ISSUES_URL}">${f.issues}</a></li>
<li><a href="${other.href}" lang="${other.lang}" hreflang="${other.lang}">${other.text}</a></li>
</ul></nav>
<p class="site-footer__legal">${f.trademarks}</p>
<p class="site-footer__legal">${f.license}</p>
</div>
</footer>`;
}

export function jsonLd(copy, version) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: 'KCP',
        alternateName: [
          'KCP KMITL',
          'Course Planner for KMITL',
          'ตัววางแผนตารางเรียน สจล.',
        ],
        inLanguage: ['th', 'en'],
        publisher: { '@id': `${ORIGIN}/#author` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${ORIGIN}/#app`,
        name: 'KCP: Course Planner for KMITL',
        alternateName: [
          'KCP',
          'KCP KMITL',
          'Course Planner for KMITL',
          'ตัววางแผนตารางเรียน สจล.',
        ],
        url: `${ORIGIN}${copy.path}`,
        description: copy.description,
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Browser extension',
        operatingSystem: 'Windows, macOS, Linux, ChromeOS',
        // browserRequirements belongs to WebApplication; an installed extension states
        // the browser it runs in as a software requirement.
        softwareRequirements:
          'Chrome, Microsoft Edge, Brave, Opera or Firefox on a computer',
        softwareVersion: version,
        inLanguage: copy.lang,
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'THB',
          availability: 'https://schema.org/InStock',
        },
        installUrl: [CHROME_URL, FIREFOX_URL],
        downloadUrl: [CHROME_URL, FIREFOX_URL],
        sameAs: [CHROME_URL, FIREFOX_URL, REPO_URL],
        image: `${ORIGIN}/og/og-${copy.lang}.png`,
        screenshot: [
          `${ORIGIN}/shots/s-hero-${copy.lang}-1440.webp`,
          `${ORIGIN}/shots/x-share169-${copy.lang}-1440.webp`,
        ],
        license: 'https://opensource.org/licenses/MIT',
        author: {
          '@type': 'Person',
          '@id': `${ORIGIN}/#author`,
          name: 'txasw',
          url: 'https://github.com/txasw',
        },
      },
    ],
  };
  return JSON.stringify(graph);
}

/** The head shared by the pages: meta, alternates, social cards and the stylesheet. */
export function head(copy, { title, description, canonical, preload, ld }) {
  const og = `${ORIGIN}/og/og-${copy.lang}.png`;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${attr(description)}">
${
  canonical === null
    ? '<meta name="robots" content="noindex">'
    : `<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="th" href="${ORIGIN}/">
<link rel="alternate" hreflang="en" href="${ORIGIN}/en/">
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`
}
<meta name="theme-color" content="#FFFFFF">
<meta name="color-scheme" content="light">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/kcp-display.woff2" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
<meta property="og:type" content="website">
<meta property="og:site_name" content="KCP">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${canonical ?? `${ORIGIN}/`}">
<meta property="og:locale" content="${copy.ogLocale}">
<meta property="og:locale:alternate" content="${copy.ogLocaleAlt}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${attr(copy.ogImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${og}">
${ld === null ? '' : `<script type="application/ld+json">${ld}</script>`}`;
}

/** The whole landing page for one locale. */
export function renderPage(copy, { manifest, rowsHtml, counts, version }) {
  return `<!doctype html>
<html lang="${copy.lang}">
<head>
${head(copy, {
  title: copy.title,
  description: copy.description,
  canonical: `${ORIGIN}${copy.path}`,
  preload: heroPreload(manifest, copy.lang),
  ld: jsonLd(copy, version),
})}
</head>
<body>
${header(copy)}
<main id="content" tabindex="-1">
${hero(copy, manifest)}
${problem(copy, manifest, rowsHtml, counts)}
${features(copy, manifest)}
${more(copy, manifest)}
${steps(copy, manifest)}
${download(copy, version)}
${faq(copy)}
</main>
${footer(copy)}
</body>
</html>
`;
}

/** The not found page, both languages on one page since the host serves one 404. */
export function renderNotFound(th, en) {
  const block = (copy) =>
    `<div lang="${copy.lang}" class="notfound__block"><h${copy.lang === 'th' ? '1' : '2'}>${copy.notFound.title}</h${copy.lang === 'th' ? '1' : '2'}><p class="body">${copy.notFound.body}</p><p><a class="text-link" href="${copy.path}">${copy.notFound.back}</a></p></div>`;
  return `<!doctype html>
<html lang="th">
<head>
${head(th, { title: `${th.notFound.title} | KCP`, description: th.description, canonical: null, preload: '', ld: null })}
</head>
<body>
${header(th, th.path)}
<main id="content" tabindex="-1" class="notfound">
<div class="container">${mark(64)}${block(th)}${block(en)}</div>
</main>
${footer(th)}
</body>
</html>
`;
}

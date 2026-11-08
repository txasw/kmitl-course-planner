// Renders one locale of the landing page to static HTML (ADR-0066). The page carries
// no framework runtime: plain HTML, one local stylesheet, and one small script in the
// head that turns the motion on and enhances the page; without it every block shows its
// final state. Copy comes from copy.th.mjs and copy.en.mjs, the dedupe rows and
// counts from site-data.mjs, and the image files from the encoder's manifest.

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
  search: `<svg class="icon" width="24" height="24" ${STROKE}><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`,
  listChecks: `<svg class="icon" width="24" height="24" ${STROKE}><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></svg>`,
  columns: `<svg class="icon" width="24" height="24" ${STROKE}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`,
  users: `<svg class="icon" width="24" height="24" ${STROKE}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>`,
};

// The four facts of the and more block, in copy order.
const FACT_ICONS = [ICONS.search, ICONS.listChecks, ICONS.columns, ICONS.users];

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

// The frame is never wider than the container, and on a short window it is narrower,
// sized so the whole product fits the window when it stands.
const HERO_SIZES =
  '(min-width: 1328px) 1200px, calc(100vw - 2 * clamp(32px, 5vw, 64px))';
const CROP_SIZES = 'calc(100vw - 40px)';
const EXAM_SIZES = '(min-width: 1024px) 480px, calc(100vw - 40px)';
const UPDATES_SIZES = '(min-width: 1024px) 680px, calc(100vw - 40px)';
const FULL =
  '(min-width: 1328px) 1200px, calc(100vw - 2 * clamp(20px, 5vw, 64px))';
// The phone wallpaper overlaps the poster at a fifth of the container.
const PHONE_POSTER =
  '(min-width: 1328px) 240px, (min-width: 640px) 18vw, 220px';

// The touch note leads, so a phone visitor reads that the stores install on a computer
// before any button. The hero ends at one fine line: its web version note is read out
// by the disabled button, while the badge already says it is coming. The closing band
// shows the note.
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
    ? `<p class="micro hero__fine">${copy.hero.fine}</p>
<p class="visually-hidden" id="web-soon-note-${size}">${copy.cta.webNoteShort}</p>`
    : `<p class="cta-note" id="web-soon-note-${size}">${copy.cta.webNoteShort}</p>`
}`;
}

// A phone shows the hero crop: the desktop capture scaled to a phone would set the
// product's text at a few pixels.
const PHONE = '(max-width: 639px)';

/** A screenshot plate with no caption: the statement beside it says what it shows. */
function plate(manifest, id, locale, alt, sizes, className = 'plate') {
  return `<figure class="${className}" data-reveal>${picture(manifest, id, locale, { alt, sizes, className: 'plate__img' })}</figure>`;
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
<li class="site-nav__wide"><a href="${base}#faq">${copy.nav.faq}</a></li>
<li class="site-nav__narrow"><a href="${base}#faq">${copy.nav.faqShort}</a></li>
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
</div>
<div class="hero__track">
<div class="hero__pin">
<div class="frame-rise"><div class="frame">
<div class="frame__bar" aria-hidden="true"><span class="frame__dots"><i></i><i></i><i></i></span><span class="frame__url">${ICONS.lock}<span>regis.reg.kmitl.ac.th/#/teach_table_selector</span></span></div>
${picture(manifest, 's-hero', locale, {
  alt: copy.hero.alt,
  sizes: HERO_SIZES,
  eager: true,
  className: 'frame__img',
  art: [{ id: 's-hero-crop', media: PHONE, sizes: CROP_SIZES }],
})}
</div></div>
</div>
</div>
</section>`;
}

/** A statement: one headline and one line under it, the unit every screen is built on. */
function statement(id, h2, sub) {
  return `<div class="statement">
<h2 id="${id}-title" class="statement__h" data-reveal>${h2}</h2>
<p class="statement__sub" data-reveal>${sub}</p>
</div>`;
}

function problem(copy, rowsHtml, counts, search) {
  const p = copy.problem;
  const headers = p.headers
    .map((h) => `<th scope="col" role="columnheader">${h}</th>`)
    .join('');
  // The counter repeats what the caption and the live status already say, so it is
  // hidden from assistive technology. The toggle is added to the controls by site.js,
  // which also reads how many rows stay and go to size the merge, and the card element
  // is the foot of the stage card that rises as the merged table shrinks.
  return `<section class="screen problem" aria-labelledby="problem-title">
<div class="container">
${statement('problem', p.h2(search), p.sub)}
</div>
<div class="container dedupe-track">
<div class="dedupe-pin" data-dedupe data-label="${attr(p.toggle)}" data-merged="${attr(p.merged(counts))}" data-unmerged="${attr(p.unmerged(counts))}" data-kept="${String(counts.sections)}" data-gone="${String(counts.rows - counts.sections)}">
<div class="dedupe-stage">
<div class="dedupe-card" aria-hidden="true"></div>
<p class="count" aria-hidden="true"><span class="count__rows">${p.countRows(counts)}</span> <span class="count__join">${p.countJoin}</span> <span class="count__sections">${p.countSections(counts)}</span></p>
<div class="dedupe-controls"></div>
<div class="dedupe-table">
<table class="dedupe" id="dedupe-table" role="table">
<caption>${p.caption(counts)}<span class="visually-hidden" data-dedupe-state></span></caption>
<thead role="rowgroup"><tr role="row">${headers}</tr></thead>
<tbody role="rowgroup">
${rowsHtml}
</tbody>
</table>
<p class="dedupe__result">${p.staticResult(counts)}</p>
</div>
<p class="visually-hidden" role="status" aria-live="polite" data-dedupe-status></p>
</div>
</div>
</div>
</section>`;
}

// The story grid covers the working day from 08:00 to 18:00 on the hour, so a block is
// placed by a day class, a start hour class and a span class that site.css defines for
// each orientation; no position is computed in the browser and none sits in a style
// attribute.
const STORY_FIRST_HOUR = 8;
const STORY_LAST_HOUR = 18;

function placement(block) {
  const hour = block.start / 60;
  const span = (block.end - block.start) / 60;
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(span) ||
    hour < STORY_FIRST_HOUR ||
    hour + span > STORY_LAST_HOUR
  ) {
    throw new Error(
      `${block.subjectId} ${block.section} is off the story grid.`,
    );
  }
  return `d-${String(block.day)} h-${String(hour)} span-${String(span)}`;
}

/** One block's skin as the product draws it: name first, the section in a corner chip,
 * the time quiet at the foot. */
function storyCard(block, extra = '') {
  return `<div class="story__card ${block.subjectClass}${extra}"><span class="story__name">${block.name}</span><span class="story__sec">${block.section}</span><span class="story__time">${block.time}</span></div>`;
}

function storyGrid(copy, story) {
  const hours = [];
  for (let h = STORY_FIRST_HOUR; h <= STORY_LAST_HOUR; h += 1) {
    hours.push(`<span><span>${String(h).padStart(2, '0')}:00</span></span>`);
  }
  const days = [1, 2, 3, 4, 5]
    .map((day) => {
      const label = [...story.blocks, story.landed].find(
        (b) => b.day === day,
      )?.dayLabel;
      return `<span class="story__day d-${String(day)}">${label ?? ''}</span>`;
    })
    .join('');
  const blocks = story.blocks
    .map((block, i) => {
      const blocker = block === story.blocker ? ' is-blocker' : '';
      return `<div class="story__block ${placement(block)}${blocker}" data-b="${String(i)}">${storyCard(block)}</div>`;
    })
    .join('');
  const g = story.ghost;
  const [chipLine1, chipLine2] = copy.story.chip(story.blocker);
  const ghost = `<div class="story__ghost ${placement(g)}"><div class="ghost__lift"><div class="ghost__layer ghost__danger"><span class="story__name">${g.name}</span><span class="story__sec">${g.section}</span></div><div class="ghost__layer ghost__success"><span class="story__name">${g.name}</span><span class="story__sec">${story.landed.section}</span></div>${storyCard(story.landed, ' ghost__layer ghost__block')}</div><p class="story__chip"><span>${chipLine1}</span><span>${chipLine2}</span></p></div>`;
  return `<div class="story__grid" aria-hidden="true">
<div class="story__rules"></div>
<div class="story__axis">${hours.join('')}</div>
${days}
${blocks}
<div class="story__block story__landed ${placement(story.landed)}">${storyCard(story.landed)}</div>
${ghost}
<p class="story__readout">${copy.story.readout(story)}</p>
</div>`;
}

function storySection(copy, story) {
  const beats = copy.story.beats
    .map((beat) => `<li class="story__beat">${beat}</li>`)
    .join('');
  return `<section class="story" id="features" aria-labelledby="story-title">
<div class="story__track">
<div class="container story__pin">
<div class="story__text">
<h2 id="story-title" class="story__h">${copy.story.h2}</h2>
<ol class="story__beats">${beats}</ol>
</div>
${storyGrid(copy, story)}
</div>
</div>
</section>`;
}

function exam(copy, manifest) {
  const c = copy.exam;
  return `<section class="screen screen--full exam" aria-labelledby="exam-title">
<div class="container screen__grid">
${statement('exam', c.h2, c.sub)}
${plate(manifest, 's-exam-row', copy.lang, c.alt1, EXAM_SIZES, 'plate exam__plate')}
</div>
</section>`;
}

function exportScreen(copy, manifest) {
  const c = copy.export;
  const l = copy.lang;
  return `<section class="screen export" aria-labelledby="export-title">
<div class="container">
${statement('export', c.h2, c.sub)}
<div class="posters">${plate(manifest, 'x-share169', l, c.alt1, FULL, 'poster poster--wide')}${plate(manifest, 'x-phone-portrait', l, c.alt2, PHONE_POSTER, 'poster poster--phone')}</div>
</div>
</section>`;
}

function plans(copy, manifest) {
  const c = copy.plans;
  return `<section class="screen screen--full plans" aria-labelledby="plans-title">
<div class="container screen__grid">
${statement('plans', c.h2, c.sub)}
${plate(manifest, 's-updates', copy.lang, c.alt1, UPDATES_SIZES, 'plate plans__plate')}
</div>
</section>`;
}

function more(copy) {
  const items = copy.more.items
    .map(
      ([term, def], i) =>
        `<div class="fact" data-reveal data-i="${String(i)}">${FACT_ICONS[i] ?? ''}<dt>${term}</dt><dd>${def}</dd></div>`,
    )
    .join('');
  return `<section class="screen more" aria-labelledby="more-title">
<div class="container">
<h2 id="more-title" class="statement__h" data-reveal>${copy.more.h2}</h2>
<dl class="facts">${items}</dl>
</div>
</section>`;
}

function privacy(copy) {
  const c = copy.privacy;
  const perms = c.perms
    .map(
      ([token, reason]) =>
        `<div class="perm"><dt lang="en">${token}</dt><dd>${reason}</dd></div>`,
    )
    .join('');
  return `<section class="screen screen--full privacy" id="privacy" aria-labelledby="privacy-title">
<div class="container screen__grid">
${statement('privacy', c.h2, c.sub)}
<div class="privacy__perms">
<h3>${c.heading}</h3>
<dl class="perms">${perms}</dl>
<p><a class="text-link" href="${PRIVACY_URL}" hreflang="en">${c.link}</a></p>
</div>
</div>
</section>`;
}

function download(copy, version) {
  return `<section class="download" id="download" aria-labelledby="download-title">
<div class="container download__inner">
${mark(112, 'mark download__mark')}
<h2 id="download-title" class="statement__h">${copy.download.h2}</h2>
<p class="statement__sub">${copy.download.body}</p>
${ctaRow(copy, 'band')}
<p class="micro">${copy.download.meta(version, `<a class="text-link" href="${REPO_URL}">${copy.download.source}</a>`)}</p>
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
  return `<section class="screen faq" id="faq" aria-labelledby="faq-title">
<div class="container"><h2 id="faq-title" class="statement__h" data-reveal>${copy.faq.h2}</h2><div class="faq__list">${items}</div></div>
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
<li><a href="${PRIVACY_URL}" hreflang="en">${f.privacy}</a></li>
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
<script src="/assets/site.js"></script>
<link rel="stylesheet" href="/assets/site.css">
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
<meta name="twitter:image:alt" content="${attr(copy.ogImageAlt)}">
${ld === null ? '' : `<script type="application/ld+json">${ld}</script>`}`;
}

/**
 * Thai compounds the browser's line breaker would split, which a Thai reader sees as a
 * broken word: ลง and ทะเบียน on two lines reads as two words. Each stays short enough
 * that it never overflows a 320 px column.
 */
export const THAI_KEEP = [
  'เว็บไซต์ลงทะเบียน',
  'วันพฤหัสบดี',
  'ภาคการศึกษา',
  'ภาพพื้นหลัง',
  'คอมพิวเตอร์',
  'ลงทะเบียน',
  'ตารางเรียน',
  'กลุ่มเรียน',
  'วันอังคาร',
  'โอเพนซอร์ส',
  'เบราว์เซอร์',
  'ส่วนขยาย',
  'วันจันทร์',
  'วันศุกร์',
  'หน่วยกิต',
  'ตารางสอบ',
  'ผลค้นหา',
  'กลางภาค',
  'ปลายภาค',
  'มุมขวาล่าง',
  'เปิดเผย',
  'ที่นั่ง',
  'ใช้งาน',
  'คัดลอก',
  'สีเขียว',
  'ติดตั้ง',
  'สีแดง',
  'วันพุธ',
  'ชนกัน',
  'รายสัปดาห์',
  'รายวิชา',
  'หลักสูตร',
  'ลากวาง',
  'วันสอบ',
  'ผู้สอน',
  'ทุกครั้ง',
  'ค่าเดิม',
  'ค่าใหม่',
  'บัญชีผู้ใช้',
  'เซิร์ฟเวอร์',
  'สาธารณะ',
  'โทรศัพท์',
  'เวอร์ชัน',
  'ระหว่างพัฒนา',
  'ข้อมูลล่าสุด',
];

// Longest first, so a longer compound wins over a shorter one inside it.
const THAI_KEEP_PATTERN = new RegExp(
  [...THAI_KEEP].sort((a, b) => b.length - a.length).join('|'),
  'g',
);

/**
 * Wrap every listed compound in the text of a Thai page in a span that keeps it on one
 * line. Only text between tags changes, so no attribute, alt text or structured data
 * ever carries the markup.
 */
export function keepThaiWords(html) {
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(
            THAI_KEEP_PATTERN,
            (word) => `<span class="nw">${word}</span>`,
          ),
    )
    .join('');
}

/** The whole landing page for one locale. */
export function renderPage(
  copy,
  { manifest, rowsHtml, counts, search, story, version },
) {
  const body = `${header(copy)}
<main id="content" tabindex="-1">
${hero(copy, manifest)}
${problem(copy, rowsHtml, counts, search)}
${storySection(copy, story)}
${exam(copy, manifest)}
${exportScreen(copy, manifest)}
${plans(copy, manifest)}
${more(copy)}
${privacy(copy)}
${download(copy, version)}
${faq(copy)}
</main>
${footer(copy)}`;
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
${copy.lang === 'th' ? keepThaiWords(body) : body}
</body>
</html>
`;
}

/**
 * A not found page with both languages, led by one. The host serves the 404.html nearest
 * the missing path, so a miss under /en/ gets the English led page and any other miss
 * the Thai led one at the root.
 */
export function renderNotFound(lead, other) {
  const block = (copy, level) =>
    `<div lang="${copy.lang}" class="notfound__block"><h${level}>${copy.notFound.title}</h${level}><p class="body">${copy.notFound.body}</p><p><a class="text-link" href="${copy.path}">${copy.notFound.back}</a></p></div>`;
  const body = `${header(lead, lead.path)}
<main id="content" tabindex="-1" class="notfound">
<div class="container">${mark(64)}${block(lead, 1)}${block(other, 2)}</div>
</main>
${footer(lead)}`;
  return `<!doctype html>
<html lang="${lead.lang}">
<head>
${head(lead, { title: `${lead.notFound.title} | KCP`, description: lead.description, canonical: null, preload: '', ld: null })}
</head>
<body>
${keepThaiWords(body)}
</body>
</html>
`;
}

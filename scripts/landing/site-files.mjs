// The text files of the landing site (ADR-0066): both language pages, a not found page
// led by each language, and the sitemap with its language alternates, rendered and formatted
// exactly as they are committed in site/. build-site.mjs writes them, and the site test
// renders them again and compares, so the committed pages never drift from their
// sources. The output depends only on the repository, never on the date or the machine.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettier from 'prettier';
import { th } from './copy.th.mjs';
import { en } from './copy.en.mjs';
import { ORIGIN, renderNotFound, renderPage } from './render-page.mjs';
import {
  dedupeCounts,
  extensionVersion,
  renderDedupeRows,
  storyBlocks,
} from './site-data.mjs';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const SITE = path.join(ROOT, 'site');

// The stylesheet, the script, the brand marks and the screenshots are served with a year long immutable
// cache (site/_headers), so every page reference carries a hash of the file's content:
// a changed file gets a new URL and a returning visitor never sees a stale copy. The
// font is left out because the stylesheet names it too; a new subset takes a new file
// name instead. Absolute URLs, as in the structured data, are left as they are.
const VERSIONED =
  /(?<=["\s,])\/(?:assets\/site\.(?:css|js)|assets\/brand\/[\w.-]+|shots\/[\w.-]+)(?=["\s,])/g;

function versionAssets(html) {
  return html.replace(VERSIONED, (url) => {
    const hash = createHash('sha256')
      .update(readFileSync(path.join(SITE, url)))
      .digest('hex')
      .slice(0, 10);
    return `${url}?v=${hash}`;
  });
}

async function format(relative, source) {
  const file = path.join(SITE, relative);
  const options = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(source, { ...options, filepath: file });
}

// No lastmod: a date taken from the clock would change the file on every build, and a
// guessed one would be wrong. Crawlers read the language alternates either way.
function sitemap() {
  const alternates = [
    ['th', `${ORIGIN}/`],
    ['en', `${ORIGIN}/en/`],
    ['x-default', `${ORIGIN}/`],
  ]
    .map(
      ([lang, href]) =>
        `<xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`,
    )
    .join('\n    ');
  const urls = [`${ORIGIN}/`, `${ORIGIN}/en/`]
    .map(
      (loc) => `  <url>
    <loc>${loc}</loc>
    ${alternates}
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

/** Every generated text file of the site, keyed by its path inside site/. */
export async function siteTextFiles() {
  const manifest = JSON.parse(
    readFileSync(
      path.join(ROOT, 'scripts', 'landing', 'shots.manifest.json'),
      'utf8',
    ),
  );
  const counts = dedupeCounts();
  const version = extensionVersion();
  const files = new Map();
  for (const copy of [th, en]) {
    const relative = copy.lang === 'th' ? 'index.html' : 'en/index.html';
    const html = renderPage(copy, {
      manifest,
      rowsHtml: renderDedupeRows(copy.lang),
      counts,
      story: storyBlocks(copy.lang),
      version,
    });
    files.set(relative, await format(relative, versionAssets(html)));
  }
  files.set(
    '404.html',
    await format('404.html', versionAssets(renderNotFound(th, en))),
  );
  files.set(
    'en/404.html',
    await format('en/404.html', versionAssets(renderNotFound(en, th))),
  );
  files.set('sitemap.xml', sitemap());
  return files;
}

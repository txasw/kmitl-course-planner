// Writes the landing site into site/ (ADR-0066): the pages and the sitemap from
// site-files.mjs, and the favicons rasterized from the extension icon. The pages are
// generated so the dedupe table, the counts around it and the version are always read
// from their sources, never typed by hand. Run with pnpm site:build after editing the
// copy, the renderer, the stylesheet or the script, and after pnpm site:encode when the
// images change.

import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { SITE_VERSION_FILE, siteVersion } from './site-data.mjs';
import { ROOT, SITE, siteTextFiles } from './site-files.mjs';

// The page states the released version in site-version.json, while it may already
// describe features that wait in pending changesets or in a release not yet live on both
// stores. Both are the normal state between releases, so the build only reminds: bump
// site-version.json once the release is live on both stores, then rebuild (ADR-0066).
const changesetDir = path.join(ROOT, '.changeset');
const pending = [];
for (const name of await readdir(changesetDir)) {
  if (!name.endsWith('.md') || name === 'README.md') continue;
  const text = await readFile(path.join(changesetDir, name), 'utf8');
  if (/^['"]?[\w@/-]+['"]?:\s*['"]?(?:minor|major)['"]?\s*$/m.test(text)) {
    pending.push(name);
  }
}
if (pending.length > 0) {
  console.warn(
    `warning: ${String(pending.length)} pending minor or major changesets. The page may describe features the stated version lacks; deploy only after that release is live on both stores.`,
  );
}
const stated = siteVersion();
const { version: packaged } = JSON.parse(
  await readFile(path.join(ROOT, 'package.json'), 'utf8'),
);
if (stated !== packaged) {
  console.warn(
    `note: the page states ${stated} and package.json holds ${packaged}. Once ${packaged} is live on both stores, set it in ${SITE_VERSION_FILE} and rebuild.`,
  );
}

for (const [relative, content] of await siteTextFiles()) {
  const file = path.join(SITE, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  console.log(`wrote site/${relative}`);
}

const icon = path.join(ROOT, 'assets', 'icon.svg');
await copyFile(icon, path.join(SITE, 'favicon.svg'));
await sharp(icon, { density: 384 })
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(path.join(SITE, 'favicon-32.png'));
await sharp(icon, { density: 384 })
  .resize(180, 180)
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(SITE, 'apple-touch-icon.png'));
console.log('wrote the favicons');

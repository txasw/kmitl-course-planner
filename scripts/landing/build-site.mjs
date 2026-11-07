// Writes the landing site into site/ (ADR-0066): the pages from site-files.mjs, and the
// favicons rasterized from the extension icon. The pages are generated so the dedupe
// table, the counts around it and the version are always read from their sources, never
// typed by hand. Run with pnpm site:build after editing the copy, the renderer, the
// stylesheet or the script, and after pnpm site:encode when the images change.

import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, SITE, siteTextFiles } from './site-files.mjs';

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

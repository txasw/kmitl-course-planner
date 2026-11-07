// Encodes the captured landing page masters into the committed site images
// (ADR-0066). Every master becomes AVIF and WebP at each width listed in shots.mjs,
// plus one JPEG fallback, and the widths and dimensions written are recorded in
// shots.manifest.json for the page renderer. AVIF keeps full chroma so thin Thai
// strokes and small coloured accents do not smear. The open graph images are
// compressed as palette PNGs. Run after pnpm site:shots; never edits the pixels.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { LOCALES, SHOTS } from './shots.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const masters = path.join(root, 'test-results', 'landing-masters');
const outDir = path.join(root, 'site', 'shots');
const ogDir = path.join(root, 'site', 'og');
const manifestPath = path.join(
  root,
  'scripts',
  'landing',
  'shots.manifest.json',
);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(ogDir, { recursive: true });

const manifest = {};
let total = 0;

for (const [id, spec] of Object.entries(SHOTS)) {
  for (const locale of LOCALES) {
    const source = path.join(masters, `${id}-${locale}.png`);
    if (!existsSync(source)) {
      throw new Error(`Missing master ${source}. Run pnpm site:shots first.`);
    }
    const meta = await sharp(source).metadata();
    const widths = [
      ...new Set(spec.widths.map((w) => Math.min(w, meta.width))),
    ];
    const entry = { widths, sizes: {} };
    for (const width of widths) {
      const height = Math.round((meta.height * width) / meta.width);
      entry.sizes[width] = height;
      const base = path.join(outDir, `${id}-${locale}-${String(width)}`);
      const resized = () => sharp(source).resize({ width, kernel: 'lanczos3' });
      await resized()
        .avif({ quality: 62, chromaSubsampling: '4:4:4', effort: 6 })
        .toFile(`${base}.avif`);
      await resized()
        .webp({ quality: 82, smartSubsample: true, effort: 6 })
        .toFile(`${base}.webp`);
    }
    const fallback = Math.min(spec.fallback, meta.width);
    entry.fallback = fallback;
    entry.sizes[fallback] = Math.round((meta.height * fallback) / meta.width);
    await sharp(source)
      .resize({ width: fallback, kernel: 'lanczos3' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(outDir, `${id}-${locale}-${String(fallback)}.jpg`));
    manifest[`${id}-${locale}`] = entry;
    total += 1;
  }
}

for (const locale of LOCALES) {
  const source = path.join(masters, `og-${locale}.png`);
  const bytes = await readFile(source);
  await sharp(bytes)
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(path.join(ogDir, `og-${locale}.png`));
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `encoded ${String(total)} masters into ${path.relative(root, outDir)}`,
);

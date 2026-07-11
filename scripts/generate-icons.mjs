// Rasterizes assets/icon.svg into the committed PNG icon set that the manifest
// ships. Run `pnpm icons` after editing the SVG, then commit the PNGs. The store
// and Firefox source builds consume the committed PNGs, so this script never runs
// during wxt build or wxt zip.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets', 'icon.svg');
const outDir = path.join(root, 'public', 'icon');
const sizes = [16, 32, 48, 96, 128];

const svg = await readFile(source);

for (const size of sizes) {
  const out = path.join(outDir, `${size}.png`);
  await sharp(svg, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${path.relative(root, out)}`);
}

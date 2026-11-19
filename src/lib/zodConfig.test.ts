import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import './zodConfig';

// The entrypoints whose bundles build schemas. The paths resolve from the project root
// because the jsdom test environment does not expose a file scheme import.meta.url.
const ENTRYPOINTS = [
  'src/entrypoints/background.ts',
  'src/entrypoints/regis.content/index.tsx',
];

function firstImport(path: string): string | undefined {
  const source = readFileSync(resolve(process.cwd(), path), 'utf8');
  return /^import\s[^;]*;/m.exec(source)?.[0];
}

describe('zod configuration', () => {
  it('runs the validation library in jitless mode', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('still validates object schemas in jitless mode', () => {
    const schema = z.object({ id: z.string() });
    expect(schema.safeParse({ id: '135224' }).success).toBe(true);
    expect(schema.safeParse({ id: 135224 }).success).toBe(false);
  });

  it('is the first import of every entrypoint', () => {
    // Zod decides whether to compile when the first object schema is built, at module
    // load, so the config must evaluate before any module that declares a schema.
    for (const path of ENTRYPOINTS) {
      expect(firstImport(path)).toBe("import '@/lib/zodConfig';");
    }
  });
});

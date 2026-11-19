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

// Counts every call of the Function constructor, plain or with new, while the body runs,
// then restores the real constructor. Zod reads the global Function when it probes and
// when it compiles, so swapping the global sees both.
function countFunctionCalls(body: () => void): number {
  const original = globalThis.Function;
  let calls = 0;
  globalThis.Function = new Proxy(original, {
    apply(target, thisArg, args: unknown[]) {
      calls += 1;
      return Reflect.apply(target, thisArg, args) as unknown;
    },
    construct(target, args: unknown[], newTarget) {
      calls += 1;
      return Reflect.construct(target, args, newTarget) as object;
    },
  });
  try {
    body();
  } finally {
    globalThis.Function = original;
  }
  return calls;
}

function buildAndParseObject(): void {
  const schema = z.object({ id: z.string(), seats: z.number() });
  schema.parse({ id: '135224', seats: 40 });
  schema.parse({ id: '135340', seats: 0 });
}

describe('zod jitless behaviour', () => {
  it('never calls the Function constructor to build or parse an object schema', () => {
    expect(countFunctionCalls(buildAndParseObject)).toBe(0);
  });

  it('would call the Function constructor without jitless, so the count above is real', () => {
    // The control runs last because a probe without jitless caches its result for the
    // rest of this file. The config is restored even if the body throws.
    z.config({ jitless: false });
    try {
      expect(countFunctionCalls(buildAndParseObject)).toBeGreaterThan(0);
    } finally {
      z.config({ jitless: true });
    }
  });
});

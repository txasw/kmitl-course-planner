import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';
import th from './th.json';

// Fails on a dictionary key that no source string names, so a key whose last caller
// went stays out of both dictionaries rather than lingering as copy nobody reads. A
// key counts as referenced when a string literal in product source spells it out,
// whether it reaches t() directly or travels as a typed key in a record such as a
// template's labelKey. Test files are not scanned, so a test cannot keep a key alive.

// Prefixes completed at run time from a typed union, as in t(`exam.${kind}`). A key
// under one of them is referenced through the template rather than a literal. Each
// prefix must still head a template in source, so the list cannot outlive its caller.
const DYNAMIC_KEY_PREFIXES = [
  'exam.',
  'compare.sort.',
  'suggest.objective.',
  'suggest.group.',
  'suggest.segment.',
] as const;

const SRC_DIR = resolve(process.cwd(), 'src');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)
      ? [full]
      : [];
  });
}

interface SourceStrings {
  literals: Set<string>;
  templateHeads: Set<string>;
}

// Reads strings through the TypeScript parser, so a key named only in a comment does
// not count as a reference.
function collectSourceStrings(files: string[]): SourceStrings {
  const literals = new Set<string>();
  const templateHeads = new Set<string>();
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        literals.add(node.text);
      } else if (ts.isTemplateExpression(node)) {
        templateHeads.add(node.head.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { literals, templateHeads };
}

const strings = collectSourceStrings(collectSourceFiles(SRC_DIR));

describe('dictionary key references', () => {
  it('names every dictionary key in product source', () => {
    const unreferenced = Object.keys(th).filter(
      (key) =>
        !strings.literals.has(key) &&
        !DYNAMIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );
    expect(unreferenced).toEqual([]);
  });

  it('keeps each dynamic prefix tied to a template that builds it', () => {
    const stale = DYNAMIC_KEY_PREFIXES.filter(
      (prefix) => !strings.templateHeads.has(prefix),
    );
    expect(stale).toEqual([]);
  });
});

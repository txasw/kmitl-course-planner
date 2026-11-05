// Turn the raw HTML fragments the API returns for teacher and rule lists into
// plain text lines. The API wraps each entry in its own <div>, for example
// "<div>อ. A</div><div>ผศ. ดร. B</div>". This is the only module allowed to touch
// those raw HTML strings; every other module consumes the parsed string array.
//
// Normalization runs in the background service worker, which has no DOM, so this
// cannot use DOMParser. It extracts each <div> body with a scanner, strips any
// inner tags, and decodes HTML entities to text. It reads text only and never
// evaluates the markup, so hostile input cannot inject nodes or run script.
//
// Only a known set of HTML elements is stripped. The rule text uses angle
// brackets as plain qualifiers, for example "<สองปริญญา>" and "<Dual Degree>",
// and those distinguish the eligible programs, so any bracketed text whose name
// is not a known element stays as written.

const KNOWN_ELEMENTS = [
  'div',
  'br',
  'span',
  'p',
  'font',
  'b',
  'i',
  'u',
  'strong',
  'em',
  'a',
  'ul',
  'ol',
  'li',
  'img',
  'script',
  'style',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
].join('|');

// Attribute values may hold a ">" inside quotes, so a quoted value is consumed
// whole rather than ending the tag early.
const ATTRIBUTES = String.raw`(?:"[^"]*"|'[^']*'|[^'">])*`;

const DIV_PATTERN = new RegExp(
  String.raw`<div(?=[\s/>])${ATTRIBUTES}>(.*?)<\/div\s*>`,
  'gis',
);
const TAG_PATTERN = new RegExp(
  String.raw`<\/?(?:${KNOWN_ELEMENTS})(?=[\s/>])${ATTRIBUTES}>`,
  'gi',
);
// Block level elements end a line of flowing text, so the free text pass turns each
// of their tags into a line break before the remaining inline tags are stripped.
const BLOCK_BOUNDARY_PATTERN = new RegExp(
  String.raw`<\/?(?:div|p|br|ul|ol|li|table|thead|tbody|tfoot|tr|caption)(?=[\s/>])${ATTRIBUTES}>`,
  'gi',
);
// Script and style bodies are code, not text, so they go with their tags. An
// unclosed element drops everything after it.
const RAW_TEXT_PATTERN = new RegExp(
  String.raw`<(script|style)(?=[\s/>])${ATTRIBUTES}>[\s\S]*?(?:<\/\1\s*>|$)`,
  'gi',
);
const ENTITY_PATTERN = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Strip tags first so a real element is removed, then decode entities so an
// entity encoded angle bracket survives as literal text rather than a tag.
function cleanLine(fragment: string): string {
  return decodeEntities(fragment.replace(TAG_PATTERN, '')).trim();
}

/**
 * Parse an HTML fragment and return the trimmed text of each <div> as a separate
 * line, dropping empty entries. When the fragment has no <div> wrapper the whole
 * text content is returned as a single line.
 */
export function sanitizeToLines(html: string): string[] {
  const markup = html.replace(RAW_TEXT_PATTERN, '');
  const divMatches = [...markup.matchAll(DIV_PATTERN)];
  if (divMatches.length > 0) {
    return divMatches
      .map((match) => cleanLine(match[1] ?? ''))
      .filter((line) => line.length > 0);
  }
  const text = cleanLine(markup);
  return text.length > 0 ? [text] : [];
}

/**
 * Read a free text field that may mix plain text with markup, such as a remark that
 * ends in "<div><font color=...>...</font></div>". Unlike {@link sanitizeToLines},
 * text outside any wrapper is kept: every block boundary and existing line break
 * starts a new line, and empty lines are dropped.
 */
export function sanitizeTextToLines(html: string): string[] {
  return html
    .replace(RAW_TEXT_PATTERN, '')
    .replace(BLOCK_BOUNDARY_PATTERN, '\n')
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
}

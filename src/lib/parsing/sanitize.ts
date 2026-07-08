// Turn the raw HTML fragments the API returns for teacher and rule lists into
// plain text lines. The API wraps each entry in its own <div>, for example
// "<div>อ. A</div><div>ผศ. ดร. B</div>". This is the only module allowed to touch
// those raw HTML strings; every other module consumes the parsed string array.
//
// Normalization runs in the background service worker, which has no DOM, so this
// cannot use DOMParser. It extracts each <div> body with a scanner, strips any
// inner tags, and decodes HTML entities to text. It reads text only and never
// evaluates the markup, so hostile input cannot inject nodes or run script.

const DIV_PATTERN = /<div[^>]*>(.*?)<\/div>/gis;
const TAG_PATTERN = /<[^>]*>/g;
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
  const divMatches = [...html.matchAll(DIV_PATTERN)];
  if (divMatches.length > 0) {
    return divMatches
      .map((match) => cleanLine(match[1] ?? ''))
      .filter((line) => line.length > 0);
  }
  const text = cleanLine(html);
  return text.length > 0 ? [text] : [];
}

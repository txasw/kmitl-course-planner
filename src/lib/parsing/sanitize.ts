// Turn the raw HTML fragments the API returns for teacher and rule lists into
// plain text lines. The API wraps each entry in its own <div>, for example
// "<div>อ. A</div><div>ผศ. ดร. B</div>". This is the only module allowed to touch
// those raw HTML strings; every other module consumes the parsed string array.

/**
 * Parse an HTML fragment and return the trimmed text of each <div> as a separate
 * line, dropping empty entries. When the fragment has no <div> wrapper the whole
 * text content is returned as a single line. Reads text content only and never
 * evaluates the markup, so hostile input cannot inject nodes or run script.
 */
export function sanitizeToLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const divs = doc.querySelectorAll('div');
  if (divs.length > 0) {
    return [...divs]
      .map((div) => div.textContent.trim())
      .filter((line) => line.length > 0);
  }
  const text = doc.body.textContent.trim();
  return text.length > 0 ? [text] : [];
}

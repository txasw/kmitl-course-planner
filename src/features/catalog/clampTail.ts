// Finds where the hidden part of a line clamp starts, so the clamp can stop painting it. A
// line clamp hides the lines past its count by clipping its box at the foot of the last
// line it shows, but the hidden lines are still laid out and painted under that clip. A Thai
// line carries its upper vowels and tone marks above its own line box, and a stacked pair of
// marks rises into the foot of the line above it, inside the clip, so a mark of the first
// hidden line can paint beside the ellipsis. Splitting the text at the start of the first
// hidden line lets the caller paint that part transparent: the layout and the ellipsis stay
// exactly as the clamp drew them, the full text stays in the accessibility tree, and no ink
// of a hidden line shows.
//
// The start is found by a binary search over the text offsets, reading the line of each
// character from the centre of its box against the centre of the first character's, so a
// fallback font that sits a few pixels off the line box still reads on its own line.

interface Located {
  node: Text;
  offset: number;
}

/** The text nodes under an element in order, with the offset each one starts at. */
function textNodes(root: Element): { node: Text; start: number }[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: { node: Text; start: number }[] = [];
  let start = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Text) {
      nodes.push({ node, start });
      start += node.length;
    }
  }
  return nodes;
}

function locate(
  nodes: { node: Text; start: number }[],
  index: number,
): Located | null {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const entry = nodes[i];
    if (entry !== undefined && index >= entry.start) {
      return { node: entry.node, offset: index - entry.start };
    }
  }
  return null;
}

/**
 * The text offset where the first line past `lines` starts, or null when every character
 * sits within the shown lines or the layout cannot be read, such as in a test document.
 */
export function clampTailOffset(root: Element, lines: number): number | null {
  const lineHeight = parseFloat(getComputedStyle(root).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return null;
  const nodes = textNodes(root);
  const last = nodes[nodes.length - 1];
  if (last === undefined) return null;
  const total = last.start + last.node.length;
  const range = root.ownerDocument.createRange();
  if (typeof range.getBoundingClientRect !== 'function') return null;

  // The centre of the box of the first character at or after an index that draws a box,
  // with the index it was read at; a forced break or a collapsed space draws none.
  const centreFrom = (index: number): { centre: number; at: number } | null => {
    for (let at = index; at < total; at += 1) {
      const place = locate(nodes, at);
      if (place === null) return null;
      range.setStart(place.node, place.offset);
      range.setEnd(place.node, place.offset + 1);
      const box = range.getBoundingClientRect();
      if (box.height > 0) return { centre: box.top + box.height / 2, at };
    }
    return null;
  };

  const first = centreFrom(0);
  if (first === null) return null;
  const lineOf = (centre: number) =>
    Math.round((centre - first.centre) / lineHeight);

  // The search keeps the first index whose character sits on a hidden line.
  let low = first.at;
  let high = total;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const read = centreFrom(middle);
    if (read === null || lineOf(read.centre) >= lines) {
      high = middle;
    } else {
      low = read.at + 1;
    }
  }
  return low < total ? low : null;
}

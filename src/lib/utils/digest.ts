// A short opaque digest of a string, for comparing two values without keeping either.
// It is a 53 bit mix of two multiplicative hashes, seeded so that a caller who seeds it
// at random per document gets a value that means nothing outside that document. It is
// not a cryptographic hash and protects nothing on its own; it only keeps the original
// text out of the places a value may travel, such as a store or a log.

/** The seeded digest of a string, written in base 36. */
export function opaqueDigest(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

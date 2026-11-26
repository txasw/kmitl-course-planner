// The SHA-256 of a text as lower case hex, through the Web Crypto API the worker and Node
// both carry, so the fingerprint script and the worker hash the same way (ADR-0079).

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

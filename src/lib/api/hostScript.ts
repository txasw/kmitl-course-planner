// Fetches one host app script by its exact name, for the host check (ADR-0079). The
// worker builds the address itself from a name that matches the app script pattern, on
// the host's own script folder, and never takes an address from the page. It is one GET
// of a public static file: no cookie or referrer is sent, a redirect is refused, and the
// body is read as text up to a size bound and never evaluated. One attempt only, as on
// every registration page (ADR-0075).
//
// The outcome is read when the file arrived whole and is held to what it is; unreadable
// when the host served a file KCP will not read, too large or not UTF-8, which the
// same name will serve again; failed when the request did not complete, which a later
// visit may retry.

import { APP_SCRIPT_NAME } from '../regis/hostContract';
import type { GatewayEnv } from './types';

/** The host's script folder; the page loads its app script from here. */
export const HOST_SCRIPT_BASE = 'https://regis.reg.kmitl.ac.th/js/';

/** The largest app script KCP reads; the tested builds are under 1.8 MB. */
export const HOST_SCRIPT_MAX_BYTES = 8 * 1024 * 1024;

/** How long the one attempt may take. */
export const HOST_SCRIPT_TIMEOUT_MS = 20_000;

export type HostScriptOutcome =
  | { kind: 'read'; source: string }
  | { kind: 'unreadable' }
  | { kind: 'failed' };

/** The address of an app script by its exact name, or null for any other name. */
export function hostScriptUrl(name: string): string | null {
  return APP_SCRIPT_NAME.test(name) ? `${HOST_SCRIPT_BASE}${name}` : null;
}

function isScript(response: Response): boolean {
  const type = response.headers.get('content-type') ?? '';
  return /^(?:application|text)\/(?:x-)?javascript(?:;|$)/i.test(type.trim());
}

async function readBounded(
  response: Response,
): Promise<Uint8Array | 'tooLarge'> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > HOST_SCRIPT_MAX_BYTES) {
    return 'tooLarge';
  }
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > HOST_SCRIPT_MAX_BYTES) {
      await reader.cancel();
      return 'tooLarge';
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchHostScript(
  name: string,
  env: Pick<GatewayEnv, 'fetch'>,
): Promise<HostScriptOutcome> {
  const url = hostScriptUrl(name);
  if (url === null) return { kind: 'unreadable' };
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, HOST_SCRIPT_TIMEOUT_MS);
  try {
    const response = await env.fetch(url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    // A missing file or a page served in its place may be a deploy in progress.
    if (!response.ok || !isScript(response)) return { kind: 'failed' };
    const body = await readBounded(response);
    if (body === 'tooLarge') return { kind: 'unreadable' };
    try {
      const source = new TextDecoder('utf-8', { fatal: true }).decode(body);
      return { kind: 'read', source };
    } catch {
      return { kind: 'unreadable' };
    }
  } catch {
    // A timeout, a refused redirect, or a lost connection: the request did not complete.
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

// Storage keys and the current schema version. All persisted data lives under a
// single versioned root key so a migration runner can reason about the whole blob
// at once. Corrupt blobs are moved aside under a timestamped quarantine key.

/** The single root key holding the persisted plan data. */
export const ROOT_KEY = 'kcp:v1';

/** The schema version the current build reads and writes. */
export const CURRENT_SCHEMA_VERSION = 1;

/** Key under which a corrupt root blob is preserved for later export. */
export function quarantineKey(timestamp: string): string {
  return `kcp:quarantine:${timestamp}`;
}

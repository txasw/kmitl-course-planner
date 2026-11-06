// The worker owned install record. The worker writes it once, when the extension is
// first installed, and never overwrites a valid record, so installedAt keeps the
// first install time across updates. The content script only reads it to learn that
// a welcome is due. Reads validate through Zod like every storage read; a malformed
// or absent blob loads as null.

import { z } from 'zod';
import type { StorageAdapter } from './repo';
import { INSTALL_KEY } from './keys';

export const installRecordSchema = z.object({
  schemaVersion: z.literal(1),
  installedAt: z.iso.datetime(),
  version: z.string().min(1),
});
export type InstallRecord = z.infer<typeof installRecordSchema>;

export interface InstallRepository {
  load(): Promise<InstallRecord | null>;
  /**
   * Writes the record for this install unless a valid one exists. created reports
   * whether this call wrote it, which is how the worker tells a first install from a
   * repeated install event such as a temporary reload.
   */
  record(version: string): Promise<{ created: boolean }>;
}

export interface InstallRepositoryOptions {
  now?: () => string;
}

export function createInstallRepository(
  adapter: StorageAdapter,
  options: InstallRepositoryOptions = {},
): InstallRepository {
  const now = options.now ?? (() => new Date().toISOString());

  async function load(): Promise<InstallRecord | null> {
    const parsed = installRecordSchema.safeParse(
      await adapter.get(INSTALL_KEY),
    );
    return parsed.success ? parsed.data : null;
  }

  return {
    load,
    async record(version) {
      if ((await load()) !== null) return { created: false };
      // A blob that fails validation is replaced rather than kept, because content
      // reads it as null and would otherwise never learn of the install.
      const fresh: InstallRecord = {
        schemaVersion: 1,
        installedAt: now(),
        version,
      };
      await adapter.set(INSTALL_KEY, fresh);
      return { created: true };
    },
  };
}

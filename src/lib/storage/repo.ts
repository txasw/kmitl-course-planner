// The plan repository over an injected key value adapter. Keeping the adapter
// abstract makes the migration, validation, and quarantine logic pure and fully
// testable with an in memory fake; the concrete browser.storage.local binding is
// wired where the worker and content script live. On load, a corrupt blob is
// moved to a quarantine key and a fresh root is returned, so viewing a plan is
// never blocked and stored data is never silently overwritten with garbage.

import { z } from 'zod';
import { planSchema } from '../domain/plan';
import {
  ok,
  err,
  storageError,
  type Result,
  type StorageError,
} from '../utils/result';
import { ROOT_KEY, CURRENT_SCHEMA_VERSION, quarantineKey } from './keys';
import { runMigrations, MIGRATIONS, type Migration } from './migrations';

export const persistedRootSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  plans: z.array(planSchema),
});
export type PersistedRoot = z.infer<typeof persistedRootSchema>;

const versionSchema = z.object({ schemaVersion: z.number() });

/** Minimal async key value store the repository reads and writes. */
export interface StorageAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export type LoadOutcome =
  | { status: 'ok'; root: PersistedRoot }
  | { status: 'fresh'; root: PersistedRoot }
  | { status: 'quarantined'; root: PersistedRoot; quarantineKey: string }
  | { status: 'refused'; reason: string };

export interface PlanRepository {
  load(): Promise<LoadOutcome>;
  save(root: PersistedRoot): Promise<Result<void, StorageError>>;
}

export interface RepositoryOptions {
  now?: () => string;
  migrations?: Migration[];
}

/** A valid, empty persisted root at the current schema version. */
export function emptyRoot(): PersistedRoot {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, plans: [] };
}

export function createPlanRepository(
  adapter: StorageAdapter,
  options: RepositoryOptions = {},
): PlanRepository {
  const now = options.now ?? (() => new Date().toISOString());
  const migrations = options.migrations ?? MIGRATIONS;

  async function quarantine(raw: unknown): Promise<LoadOutcome> {
    const key = quarantineKey(now());
    await adapter.set(key, raw);
    await adapter.set(ROOT_KEY, emptyRoot());
    return { status: 'quarantined', root: emptyRoot(), quarantineKey: key };
  }

  async function load(): Promise<LoadOutcome> {
    const raw = await adapter.get(ROOT_KEY);
    if (raw === undefined || raw === null) {
      return { status: 'fresh', root: emptyRoot() };
    }
    const version = versionSchema.safeParse(raw);
    if (!version.success) {
      return quarantine(raw);
    }
    const migrated = runMigrations(
      raw,
      version.data.schemaVersion,
      CURRENT_SCHEMA_VERSION,
      migrations,
    );
    if (!migrated.ok) {
      return { status: 'refused', reason: migrated.error.message };
    }
    const validated = persistedRootSchema.safeParse(migrated.value);
    if (!validated.success) {
      return quarantine(raw);
    }
    return { status: 'ok', root: validated.data };
  }

  async function save(
    root: PersistedRoot,
  ): Promise<Result<void, StorageError>> {
    const validated = persistedRootSchema.safeParse(root);
    if (!validated.success) {
      return err(storageError('refusing to persist an invalid plan root'));
    }
    await adapter.set(ROOT_KEY, validated.data);
    return ok(undefined);
  }

  return { load, save };
}

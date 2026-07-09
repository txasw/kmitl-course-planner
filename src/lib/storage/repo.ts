// The plan repository over an injected key value adapter. Keeping the adapter
// abstract makes the migration, validation, and quarantine logic pure and fully
// testable with an in memory fake; the concrete browser.storage.local binding is
// wired where the worker and content script live. On load, a corrupt blob is
// moved to a quarantine key and a fresh root is returned, so viewing a plan is
// never blocked and stored data is never silently overwritten with garbage.

import { z } from 'zod';
import { planSchema, type Plan } from '../domain/plan';
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

// The root shape without validating each plan, so a single invalid plan can be
// quarantined on its own rather than discarding every saved plan.
const rootShapeSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  plans: z.array(z.unknown()),
});

/** Minimal async key value store the repository reads and writes. */
export interface StorageAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Every stored key, for a prefix scoped bulk clear. Optional for fakes. */
  keys?(): Promise<string[]>;
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
    const shape = rootShapeSchema.safeParse(migrated.value);
    if (!shape.success) {
      // The root itself is malformed, so there is nothing to salvage per plan.
      return quarantine(raw);
    }
    // Validate each plan on its own, so one bad plan is quarantined while the rest
    // load. A total quarantine would lose every plan for a single corrupt one.
    const valid: Plan[] = [];
    const invalid: unknown[] = [];
    for (const candidate of shape.data.plans) {
      const parsed = planSchema.safeParse(candidate);
      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        invalid.push(candidate);
      }
    }
    if (invalid.length > 0) {
      const key = quarantineKey(now());
      await adapter.set(key, invalid);
      const root: PersistedRoot = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        plans: valid,
      };
      await adapter.set(ROOT_KEY, root);
      return { status: 'quarantined', root, quarantineKey: key };
    }
    return {
      status: 'ok',
      root: { schemaVersion: CURRENT_SCHEMA_VERSION, plans: valid },
    };
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

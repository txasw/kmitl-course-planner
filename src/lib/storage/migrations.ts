// The ordered schema migration runner. Each migration upgrades the stored blob by
// exactly one version. The runner refuses to load a blob whose version is newer
// than the build supports, so a downgrade never silently corrupts data. Version 1
// is the base shape, so no migrations exist yet; the runner is generic and tested
// with synthetic migrations so the mechanism is proven before it is needed.

import {
  ok,
  err,
  storageError,
  type Result,
  type StorageError,
} from '../utils/result';

export interface Migration {
  /** The schema version this migration produces. */
  readonly to: number;
  migrate(data: unknown): unknown;
}

/** Ordered migrations by target version. Empty until a schema change lands. */
export const MIGRATIONS: Migration[] = [];

/**
 * Apply migrations to bring `data` from `fromVersion` up to `target`. Returns an
 * error when the stored version is newer than the target or when a required
 * intermediate migration is missing, rather than mutating incompatible data.
 */
export function runMigrations(
  data: unknown,
  fromVersion: number,
  target: number,
  migrations: Migration[] = MIGRATIONS,
): Result<unknown, StorageError> {
  if (fromVersion > target) {
    return err(
      storageError(
        `stored schema version ${String(fromVersion)} is newer than supported version ${String(target)}`,
      ),
    );
  }
  let current = data;
  let version = fromVersion;
  while (version < target) {
    const next = migrations.find((migration) => migration.to === version + 1);
    if (next === undefined) {
      return err(
        storageError(`no migration to schema version ${String(version + 1)}`),
      );
    }
    current = next.migrate(current);
    version = next.to;
  }
  return ok(current);
}

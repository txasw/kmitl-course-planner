// The two content owned records of the registration helper (ADR-0076): the kits the
// prepare action built, and the checklist marks the student set. Each is a versioned
// list of per plan items. A read validates each item through Zod on its own, so one bad
// item is moved aside under a quarantine key while the rest load, as the plan
// repository does; a blob whose root is malformed is moved aside whole. A blob from a
// newer schema is refused and never overwritten, so a downgrade cannot destroy it. The
// plan root is untouched, so neither record changes the plan schema version.

import { z } from 'zod';
import {
  registrationKitSchema,
  type RegistrationKit,
} from '../regis/kitSchema';
import { checklistMarksSchema, type ChecklistMarks } from '../regis/checklist';
import { createSerialQueue } from '../utils/serialQueue';
import type { StorageAdapter } from './repo';
import { CHECKLIST_KEY, REGKIT_KEY, quarantineKey } from './keys';

const LIST_VERSION = 1;

/** How many plans keep a kit or marks; the oldest beyond it drop on save. */
export const REGIS_RECORD_LIMIT = 12;

export interface ListRepository<T> {
  load(): Promise<T[]>;
  /** Replace the item for a plan, or remove it when the item is null. */
  put(planId: string, item: T | null): Promise<T[]>;
}

const rootSchema = z.object({
  schemaVersion: z.number(),
  items: z.array(z.unknown()),
});

interface ListOptions<T> {
  key: string;
  tag: string;
  schema: z.ZodType<T>;
  planIdOf: (item: T) => string;
  now?: () => string;
}

function createListRepository<T>(
  adapter: StorageAdapter,
  options: ListOptions<T>,
): ListRepository<T> {
  const { key, tag, schema, planIdOf } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const enqueue = createSerialQueue();
  let refused = false;

  async function setAside(raw: unknown): Promise<void> {
    await adapter.set(quarantineKey(`${tag}:${now()}`), raw);
  }

  async function read(): Promise<T[]> {
    const raw = await adapter.get(key);
    if (raw === undefined || raw === null) return [];
    const root = rootSchema.safeParse(raw);
    if (!root.success) {
      await setAside(raw);
      await adapter.remove(key);
      return [];
    }
    if (root.data.schemaVersion > LIST_VERSION) {
      refused = true;
      return [];
    }
    const valid: T[] = [];
    const invalid: unknown[] = [];
    for (const candidate of root.data.items) {
      const parsed = schema.safeParse(candidate);
      if (parsed.success) valid.push(parsed.data);
      else invalid.push(candidate);
    }
    if (invalid.length > 0 || root.data.schemaVersion !== LIST_VERSION) {
      if (invalid.length > 0) await setAside(invalid);
      await adapter.set(key, { schemaVersion: LIST_VERSION, items: valid });
    }
    return valid;
  }

  async function put(planId: string, item: T | null): Promise<T[]> {
    const current = await read();
    if (refused) return current;
    const rest = current.filter((entry) => planIdOf(entry) !== planId);
    const items = (item === null ? rest : [item, ...rest]).slice(
      0,
      REGIS_RECORD_LIMIT,
    );
    await adapter.set(key, { schemaVersion: LIST_VERSION, items });
    return items;
  }

  return {
    load: () => enqueue(read),
    put: (planId, item) => enqueue(() => put(planId, item)),
  };
}

export function createRegKitRepository(
  adapter: StorageAdapter,
  now?: () => string,
): ListRepository<RegistrationKit> {
  return createListRepository(adapter, {
    key: REGKIT_KEY,
    tag: 'regkit',
    schema: registrationKitSchema,
    planIdOf: (kit) => kit.planId,
    ...(now === undefined ? {} : { now }),
  });
}

export function createChecklistRepository(
  adapter: StorageAdapter,
  now?: () => string,
): ListRepository<ChecklistMarks> {
  return createListRepository(adapter, {
    key: CHECKLIST_KEY,
    tag: 'checklist',
    schema: checklistMarksSchema,
    planIdOf: (marks) => marks.planId,
    ...(now === undefined ? {} : { now }),
  });
}

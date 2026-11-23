// The two content owned records of the registration helper (ADR-0076): the kits the
// prepare action built, and the section groups the student chose for a registration. Each is a versioned
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
import { sectionChoicesSchema, type SectionChoices } from '../regis/choices';
import { createSerialQueue } from '../utils/serialQueue';
import type { StorageAdapter } from './repo';
import { CHECKLIST_KEY, FILL_KEY, REGKIT_KEY, quarantineKey } from './keys';

const LIST_VERSION = 1;

/** How many plans keep a kit or choices; the oldest beyond it drop on save. */
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

export function createChoicesRepository(
  adapter: StorageAdapter,
  now?: () => string,
): ListRepository<SectionChoices> {
  return createListRepository(adapter, {
    key: CHECKLIST_KEY,
    tag: 'checklist',
    schema: sectionChoicesSchema,
    planIdOf: (choices) => choices.planId,
    ...(now === undefined ? {} : { now }),
  });
}

/** The student's fill switch and the latched host builds; fill is on by default. */
export const fillSettingsSchema = z.object({
  off: z.boolean(),
  latched: z.array(z.string().max(120)).max(20),
});
export type FillSettings = z.infer<typeof fillSettingsSchema>;

export interface FillSettingsRepository {
  load(): Promise<FillSettings>;
  save(settings: FillSettings): Promise<void>;
}

export const DEFAULT_FILL_SETTINGS: FillSettings = { off: false, latched: [] };

/** A read that does not validate falls back to the defaults, latching nothing. */
export function createFillSettingsRepository(
  adapter: StorageAdapter,
): FillSettingsRepository {
  return {
    async load() {
      const parsed = fillSettingsSchema.safeParse(await adapter.get(FILL_KEY));
      return parsed.success ? parsed.data : DEFAULT_FILL_SETTINGS;
    },
    async save(settings) {
      await adapter.set(FILL_KEY, settings);
    },
  };
}

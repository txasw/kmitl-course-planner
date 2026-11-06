// The worker owned tab intents in storage.session. When the worker opens a regis tab
// it records why: open asks the content script in that tab to open the panel, and
// welcome marks the tab the welcome belongs to after install. The record also notes
// when a welcome was granted, so only one tab per browser session shows it. The
// session area keeps this across a worker restart and clears it when the browser
// closes; each intent also expires on its own after a minute.
//
// Every operation runs through one serialized queue, and run(step) lets the worker
// put several of them, together with an await such as tabs.create, into a single
// step. A content script that mounts quickly and asks for its intent then waits for
// the step that records it instead of finding nothing. The queue lives in the store
// instance, so the worker creates one store and shares it.

import { z } from 'zod';
import { createSerialQueue } from '../utils/serialQueue';
import type { StorageAdapter } from './repo';
import { TAB_INTENTS_KEY, TAB_INTENT_TTL_MS } from './keys';

export const TAB_INTENT_KINDS = ['open', 'welcome'] as const;
export type TabIntentKind = (typeof TAB_INTENT_KINDS)[number];

const tabIntentSchema = z.object({
  tabId: z.number().int().nonnegative(),
  kind: z.enum(TAB_INTENT_KINDS),
  expiresAt: z.number(),
});
export type TabIntent = z.infer<typeof tabIntentSchema>;

export const tabIntentsRecordSchema = z.object({
  schemaVersion: z.literal(1),
  intents: z.array(tabIntentSchema),
  welcomeClaimedAt: z.iso.datetime().optional(),
});
export type TabIntentsRecord = z.infer<typeof tabIntentsRecordSchema>;

/** The operations a queued step may run; each also runs queued on the store. */
export interface TabIntentOperations {
  /** Records an intent for a tab, replacing its earlier intent of that kind. */
  add(tabId: number, kind: TabIntentKind): Promise<void>;
  /** True once for a tab with an unexpired open intent, which it then removes. */
  consume(tabId: number): Promise<boolean>;
  /** The tab of the newest unexpired open intent, or null. */
  pendingOpenTab(): Promise<number | null>;
  /** The tab of an unexpired welcome intent, or null. */
  pendingWelcomeTab(): Promise<number | null>;
  /**
   * Grants the welcome to a tab at most once per browser session. While a welcome
   * intent names another tab, the claim is denied; once it expires, any tab may
   * claim.
   */
  claimWelcome(tabId: number): Promise<boolean>;
}

export interface TabIntentStore extends TabIntentOperations {
  /**
   * Runs a step with no other operation in between. The operations passed to the
   * step are valid only while it runs; calling the store's own methods inside a
   * step would wait for the step itself and never resolve.
   */
  run<T>(step: (intents: TabIntentOperations) => Promise<T>): Promise<T>;
}

export interface TabIntentStoreOptions {
  now?: () => number;
  ttlMs?: number;
}

function emptyRecord(): TabIntentsRecord {
  return { schemaVersion: 1, intents: [] };
}

function newestTab(intents: TabIntent[], kind: TabIntentKind): number | null {
  let newest: TabIntent | null = null;
  for (const intent of intents) {
    if (intent.kind !== kind) continue;
    if (newest === null || intent.expiresAt >= newest.expiresAt) {
      newest = intent;
    }
  }
  return newest?.tabId ?? null;
}

export function createTabIntentStore(
  adapter: StorageAdapter,
  options: TabIntentStoreOptions = {},
): TabIntentStore {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? TAB_INTENT_TTL_MS;
  const enqueue = createSerialQueue();

  // Expired intents are dropped from every read, so they never answer a query and
  // leave storage with the next write.
  async function read(): Promise<TabIntentsRecord> {
    const parsed = tabIntentsRecordSchema.safeParse(
      await adapter.get(TAB_INTENTS_KEY),
    );
    const record = parsed.success ? parsed.data : emptyRecord();
    const at = now();
    return {
      ...record,
      intents: record.intents.filter((intent) => intent.expiresAt > at),
    };
  }

  async function write(record: TabIntentsRecord): Promise<void> {
    await adapter.set(TAB_INTENTS_KEY, record);
  }

  const operations: TabIntentOperations = {
    async add(tabId, kind) {
      const record = await read();
      const others = record.intents.filter(
        (intent) => intent.tabId !== tabId || intent.kind !== kind,
      );
      await write({
        ...record,
        intents: [...others, { tabId, kind, expiresAt: now() + ttlMs }],
      });
    },
    async consume(tabId) {
      const record = await read();
      const remaining = record.intents.filter(
        (intent) => intent.tabId !== tabId || intent.kind !== 'open',
      );
      if (remaining.length === record.intents.length) return false;
      await write({ ...record, intents: remaining });
      return true;
    },
    async pendingOpenTab() {
      return newestTab((await read()).intents, 'open');
    },
    async pendingWelcomeTab() {
      return newestTab((await read()).intents, 'welcome');
    },
    async claimWelcome(tabId) {
      const record = await read();
      if (record.welcomeClaimedAt !== undefined) return false;
      const welcome = record.intents.filter(
        (intent) => intent.kind === 'welcome',
      );
      if (welcome.length > 0 && !welcome.some((i) => i.tabId === tabId)) {
        return false;
      }
      await write({
        ...record,
        intents: record.intents.filter((intent) => intent.kind !== 'welcome'),
        welcomeClaimedAt: new Date(now()).toISOString(),
      });
      return true;
    },
  };

  function run<T>(step: (intents: TabIntentOperations) => Promise<T>) {
    return enqueue(() => step(operations));
  }

  return {
    run,
    add: (tabId, kind) => run((ops) => ops.add(tabId, kind)),
    consume: (tabId) => run((ops) => ops.consume(tabId)),
    pendingOpenTab: () => run((ops) => ops.pendingOpenTab()),
    pendingWelcomeTab: () => run((ops) => ops.pendingWelcomeTab()),
    claimWelcome: (tabId) => run((ops) => ops.claimWelcome(tabId)),
  };
}

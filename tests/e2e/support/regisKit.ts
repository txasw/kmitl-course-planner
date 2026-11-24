// Plans synthetic sections on the search page, then stores a registration kit for them as
// the prepare action would have at a calm time, built from the stored plan entries, so a
// registration helper spec sends no kit read of its own.

import type { Page, Worker } from '@playwright/test';
import { REGKIT_KEY, ROOT_KEY } from '../../../src/lib/storage/keys';
import { expect } from './fixtures';
import { addCourse, syntheticSearch } from './synthetic';

interface StoredEntry {
  subjectId: string;
  teachTableId: string;
  section: string;
  sourceQuery: unknown;
  snapshot: {
    teachTableId: string;
    section: string;
    kind: 'lecture' | 'practice';
    meetings: { day: number }[];
    subjectMeta: {
      nameTh: string;
      nameEn: string;
      credit: number;
      creditStr: string;
    };
  };
}

interface StoredPlan {
  id: string;
  year: string;
  semester: string;
  entries: StoredEntry[];
}

interface WorkerStorage {
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, { plans: StoredPlan[] }>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
    };
  };
}

/** Another section of a planned subject that the kit lists beside the planned one. */
export interface KitAlternative {
  teachTableId: string;
  section: string;
  /** The meeting day, 0 for Sunday. */
  day: number;
}

export interface PlannedKit {
  term: { year: string; semester: string };
  /** The planned section code of each subject. */
  sections: Record<string, string>;
}

export async function planWithKit(
  page: Page,
  serviceWorker: Worker,
  subjectIds: readonly string[],
  alternatives: Readonly<Record<string, readonly KitAlternative[]>> = {},
): Promise<PlannedKit> {
  await syntheticSearch(page);
  for (const subjectId of subjectIds) await addCourse(page, subjectId);
  await expect(page.locator('[data-teach-table-id]')).toHaveCount(
    subjectIds.length,
  );
  // Autosave debounces at 300 ms.
  await page.waitForTimeout(500);
  return serviceWorker.evaluate(
    async ({ root, regkit, now, others }) => {
      // Test only: the debug extension worker carries the storage global above.
      const { local } = (globalThis as unknown as WorkerStorage).chrome.storage;
      const plan = (await local.get(root))[root]?.plans[0];
      if (plan === undefined) throw new Error('no plan');
      const subjects = plan.entries.map((entry) => {
        const meta = entry.snapshot.subjectMeta;
        const extra = (others[entry.subjectId] ?? []).map((other) => ({
          ...entry.snapshot,
          teachTableId: other.teachTableId,
          section: other.section,
          meetings: entry.snapshot.meetings.map((meeting) => ({
            ...meeting,
            day: other.day,
          })),
        }));
        return {
          subjectId: entry.subjectId,
          nameTh: meta.nameTh,
          nameEn: meta.nameEn,
          credit: meta.credit,
          creditStr: meta.creditStr,
          sourceQuery: entry.sourceQuery,
          sections: [entry.snapshot, ...extra],
          plannedIds: [entry.teachTableId],
          options: [entry.snapshot, ...extra].map((section, index) => ({
            ids: [section.teachTableId],
            planned: index === 0,
            fit: 'fits',
            seat: 'open',
            ownCurriculum: null,
          })),
          duplicateCodes: [],
        };
      });
      const kit = {
        planId: plan.id,
        year: plan.year,
        semester: plan.semester,
        preparedAt: now,
        subjects,
        unread: [],
      };
      await local.set({ [regkit]: { schemaVersion: 1, items: [kit] } });
      return {
        term: { year: plan.year, semester: plan.semester },
        sections: Object.fromEntries(
          plan.entries.map((entry) => [entry.subjectId, entry.section]),
        ),
      };
    },
    {
      root: ROOT_KEY,
      regkit: REGKIT_KEY,
      now: new Date().toISOString(),
      others: alternatives,
    },
  );
}

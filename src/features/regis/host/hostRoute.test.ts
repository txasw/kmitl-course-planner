import { afterEach, describe, expect, it } from 'vitest';
import {
  mountReplica,
  type Replica,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import { readHostPage } from './hostDom';

// The reader against the replica of the app.a1e43722 route, which wraps the same panel in
// a route card with the RegistrationHeader, whose subtitle is a second h2 with the semester
// over the year, and the RegistrationPeriods section with its ticking countdown above the
// panel. The panel reads as it did on the earlier builds, and a period outside the open one
// unmounts it, so the page reads as absent until the panel mounts again.

const PLANNED = new Set(['01476107', '01476106']);

let replica: Replica | null = null;

function mount(patch: ReplicaPatch = {}): Replica {
  replica = mountReplica(document, patch, { route: 'a1e43722', poll: 0 });
  return replica;
}

afterEach(() => {
  replica?.destroy();
  document.body.replaceChildren();
  replica = null;
});

function observation() {
  const serializer = new XMLSerializer();
  const before = serializer.serializeToString(document.body);
  const result = readHostPage(document, PLANNED);
  expect(serializer.serializeToString(document.body)).toBe(before);
  expect(replica?.interactions() ?? 0).toBe(0);
  if (result.reading !== 'ok') throw new Error(`reading was ${result.reading}`);
  return result.observation;
}

describe('the route of app.a1e43722', () => {
  it('renders the header, the periods, and the panel in the route card', () => {
    mount({ term: { semester: '2', year: '2569' } });
    const card = document.querySelector('.v-main__wrap > .v-card');
    expect(card?.querySelector('.registration-header h1')?.textContent).toBe(
      'ลงทะเบียนล่วงหน้า ระดับปริญญาตรี',
    );
    expect(
      card?.querySelector('.registration-header .v-card__subtitle h2')
        ?.textContent,
    ).toBe('2 / 2569');
    expect(card?.querySelector('section.registration-periods')).not.toBeNull();
    expect(
      card?.querySelector('.v-card__text.px-0 .row.grey.lighten-2'),
    ).not.toBeNull();
  });

  it('reads the term, the step, the card, the list, and the credits', () => {
    mount({
      term: { semester: '2', year: '2569' },
      list: [
        { subjectId: '01476107', section: '1', kind: 'ท', curriculum: 'CE' },
      ],
    });
    expect(observation()).toEqual({
      step: 2,
      term: { year: '2569', semester: '2' },
      card: {
        status: 'empty',
        subjectId: null,
        colour: 'pending',
        primary: null,
        practice: null,
        practiceSelect: false,
        seats: null,
      },
      list: [
        {
          subjectId: '01476107',
          section: '1',
          kind: 'lecture',
          curriculum: 'CE',
        },
      ],
      credits: { total: 3, min: 9, max: 22 },
      dialog: null,
      toasts: [],
      results: null,
    });
  });

  it('reads the dialogs and the toasts', () => {
    mount({
      add: { value: '01476106', sections: [{ section: '1', kind: 'ท' }] },
      dialog: {
        kind: 'grade',
        subjectId: '01476106',
        prerequisites: ['01476105'],
      },
    });
    expect(observation().dialog).toEqual({
      kind: 'gradeNotAnnounced',
      prerequisites: ['01476105'],
    });
    replica?.set({ dialog: { kind: 'confirm' } });
    expect(observation().dialog?.kind).toBe('confirmSubmit');
    replica?.toast('refused', '01476106');
    expect(observation().toasts).toEqual([
      { kind: 'refused', subjectId: '01476106' },
    ]);
  });

  it('reads the results of the complete step', () => {
    mount({
      step: 3,
      results: [{ subjectId: '01476107', section: '1', kind: 'ท', grade: 'Y' }],
    });
    expect(observation()).toMatchObject({
      step: 3,
      card: null,
      results: [{ subjectId: '01476107', section: '1', result: 'granted' }],
    });
  });

  it('reads no panel outside the period, and an empty one once it mounts again', () => {
    mount({ list: [{ subjectId: '01476107', section: '1', kind: 'ท' }] });
    expect(observation().list).toHaveLength(1);
    for (const period of ['closed', 'before'] as const) {
      replica?.set({ period });
      expect(readHostPage(document, PLANNED)).toEqual({ reading: 'absent' });
      expect(document.querySelector('.v-dialog__content')).toBeNull();
    }
    replica?.set({ period: 'open' });
    expect(observation()).toMatchObject({
      step: 2,
      list: [],
      card: { status: 'searching' },
    });
  });

  it('ticks the countdown in place, adding and removing no element', async () => {
    mount();
    const records: MutationRecord[] = [];
    const watcher = new MutationObserver((list) => records.push(...list));
    watcher.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    const seconds = () =>
      document.querySelectorAll('.period-digits strong')[3]?.textContent;
    const before = seconds();
    replica?.tick();
    await Promise.resolve();
    watcher.disconnect();
    expect(seconds()).not.toBe(before);
    expect(records.some((record) => record.type === 'characterData')).toBe(
      true,
    );
    expect(records.filter((record) => record.type === 'childList')).toEqual([]);
  });

  it('counts each period check and applies the answer it is given once', () => {
    mount();
    replica?.configure({ answer: 'closed' });
    replica?.poll();
    expect(replica?.counters.polls).toBe(1);
    expect(replica?.state.period).toBe('closed');
    replica?.poll();
    expect(replica?.state.period).toBe('closed');
    expect(replica?.counters.polls).toBe(2);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  mountReplica,
  type Replica,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import { observedRoots, readHostPage, readScriptNames } from './hostDom';

// The reader against the static replica of the host's pre registration panel, which
// reproduces the markup of the tested host build. Every case also checks that reading
// left the page exactly as it was and pressed nothing.

const PLANNED = new Set(['01476107', '01476106']);

let replica: Replica | null = null;

function mount(patch: ReplicaPatch = {}): Replica {
  replica = mountReplica(document, patch);
  return replica;
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  replica = null;
});

function read() {
  const serializer = new XMLSerializer();
  const before = serializer.serializeToString(document.body);
  const result = readHostPage(document, PLANNED);
  expect(serializer.serializeToString(document.body)).toBe(before);
  expect(replica?.interactions() ?? 0).toBe(0);
  return result;
}

function observation() {
  const result = read();
  if (result.reading !== 'ok') throw new Error(`reading was ${result.reading}`);
  return result.observation;
}

describe('readHostPage', () => {
  it('reads an empty choose subjects step', () => {
    mount();
    expect(observation()).toEqual({
      step: 2,
      term: { year: '2569', semester: '1' },
      card: {
        status: 'empty',
        subjectId: null,
        colour: 'pending',
        primary: null,
        practice: null,
        practiceSelect: false,
        seats: null,
      },
      list: [],
      credits: { total: 0, min: 9, max: 22 },
      dialog: null,
      toasts: [],
      results: null,
    });
  });

  it('reads the list rows with the kind and the curriculum suffix', () => {
    mount({
      list: [
        { subjectId: '01476107', section: '1', kind: 'ท', curriculum: 'CE' },
        { subjectId: '01476107', section: '101', kind: 'ป' },
        { subjectId: '90641007', section: '2', kind: 'ท', credit: 2 },
      ],
    });
    const seen = observation();
    expect(seen.list).toEqual([
      {
        subjectId: '01476107',
        section: '1',
        kind: 'lecture',
        curriculum: 'CE',
      },
      {
        subjectId: '01476107',
        section: '101',
        kind: 'practice',
        curriculum: null,
      },
      {
        subjectId: '90641007',
        section: '2',
        kind: 'lecture',
        curriculum: null,
      },
    ]);
    expect(seen.credits?.total).toBe(5);
  });

  it('reads the card while the host searches and when it offers sections', () => {
    mount({ add: { value: '01476107', loading: true } });
    expect(observation().card?.status).toBe('searching');
    replica?.set({
      add: {
        value: '01476107',
        sections: [{ section: '1', kind: 'ท' }],
        selected: '1 (CE)',
        practice: { locked: true, section: '101' },
        colour: 'fits',
      },
    });
    expect(observation().card).toEqual({
      status: 'offered',
      subjectId: '01476107',
      colour: 'fits',
      primary: { section: '1', curriculum: 'CE' },
      practice: { section: '101', curriculum: null },
      practiceSelect: false,
      seats: { limit: null, count: 0 },
    });
    replica?.set({
      add: {
        value: '01476107',
        sections: [{ section: '1', kind: 'ท' }],
        selected: '1',
        practice: { locked: false, section: null },
        colour: 'clash',
      },
    });
    expect(observation().card).toMatchObject({
      colour: 'clash',
      practice: null,
      practiceSelect: true,
    });
  });

  it('reads the seats of the selected section for the over subscribed pause', () => {
    mount({
      add: {
        value: '01476107',
        sections: [{ section: '1', kind: 'ท' }],
        selected: '1',
        seats: { limit: 40, count: 45 },
        colour: 'fits',
      },
    });
    expect(observation().card?.seats).toEqual({ limit: 40, count: 45 });
  });

  it('classifies toasts by kind and keeps only a planned subject id', () => {
    mount({ add: { value: '01476107' } });
    replica?.toast('refused', '01476107');
    replica?.toast('clash', '99999999');
    const seen = observation();
    expect(seen.card?.status).toBe('refused');
    expect(seen.toasts).toEqual([
      { kind: 'refused', subjectId: '01476107' },
      { kind: 'clash', subjectId: null },
    ]);
    replica?.toast('alreadyListed', '01476107');
    expect(observation().card?.status).toBe('alreadyListed');
  });

  it('reads the grade not announced dialog as its kind and prerequisite ids', () => {
    mount({
      add: { value: '01476106', sections: [{ section: '1', kind: 'ท' }] },
      dialog: {
        kind: 'grade',
        subjectId: '01476106',
        prerequisites: ['01476105', '01476104'],
      },
    });
    expect(observation().dialog).toEqual({
      kind: 'gradeNotAnnounced',
      prerequisites: ['01476105', '01476104'],
    });
    replica?.set({ dialog: { kind: 'confirm' } });
    expect(observation().dialog).toEqual({
      kind: 'confirmSubmit',
      prerequisites: [],
    });
    replica?.set({ dialog: { kind: 'timeSlot', subjectId: '01476107' } });
    expect(observation().dialog?.kind).toBe('timeSlot');
  });

  it('reads the results, with a pair practice under its lecture', () => {
    mount({
      step: 3,
      results: [
        { subjectId: '01476107', section: '1', kind: 'ท', grade: 'Y' },
        { subjectId: '01476107', section: '101', kind: 'ป', grade: 'Y' },
        {
          subjectId: '01476106',
          section: '2',
          kind: 'ท',
          grade: 'N',
          condition: true,
        },
        { subjectId: '90641007', section: '3', kind: 'ท', grade: '' },
      ],
    });
    const seen = observation();
    expect(seen.card).toBeNull();
    expect(seen.list).toBeNull();
    expect(seen.results).toEqual([
      {
        subjectId: '01476107',
        section: '1',
        kind: 'lecture',
        curriculum: null,
        result: 'granted',
      },
      {
        subjectId: '01476107',
        section: '101',
        kind: 'practice',
        curriculum: null,
        result: 'granted',
      },
      {
        subjectId: '01476106',
        section: '2',
        kind: 'lecture',
        curriculum: null,
        result: 'notGrantedCondition',
      },
      {
        subjectId: '90641007',
        section: '3',
        kind: 'lecture',
        curriculum: null,
        result: 'waiting',
      },
    ]);
    replica?.set({ resultsLoading: true });
    expect(observation().results).toBeNull();
  });

  it('reads the consent step with no card', () => {
    mount({ step: 1 });
    expect(observation()).toMatchObject({ step: 1, card: null, list: null });
  });

  it('keeps no identity, toast text, or dialog text', () => {
    mount({
      add: { value: '01476106', sections: [{ section: '1', kind: 'ท' }] },
      dialog: {
        kind: 'grade',
        subjectId: '01476106',
        prerequisites: ['01476105'],
      },
    });
    replica?.toast('refused', '01476106');
    const text = JSON.stringify(observation());
    for (const secret of [
      '00000000',
      'นักศึกษา',
      'ข้อผิดพลาด',
      'ยกเลิก',
      'ไม่สามารถ',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('is absent before the panel shows', () => {
    expect(read()).toEqual({ reading: 'absent' });
    mount({ step: 0 });
    expect(read()).toEqual({ reading: 'absent' });
  });

  it.each<[string, (doc: Document) => void]>([
    [
      'a second add card',
      (doc) => {
        const card = doc.querySelector('.v-card');
        if (card !== null) card.parentElement?.append(card.cloneNode(true));
      },
    ],
    [
      'a list header without its classes',
      (doc) =>
        doc.querySelector('th.subject-id')?.classList.remove('subject-id'),
    ],
    [
      'an unknown row colour',
      (doc) =>
        doc
          .querySelectorAll('tbody tr')[2]
          ?.setAttribute('style', 'background-color: #000000'),
    ],
    [
      'the choose subjects step without its card',
      (doc) => doc.querySelector('.v-card')?.remove(),
    ],
    [
      'a renamed stepper label',
      (doc) => {
        const label = doc.querySelector('.v-stepper__label');
        if (label !== null) label.textContent = 'Begin';
      },
    ],
    [
      'a section cell that is not a section label',
      (doc) => {
        const cells = doc
          .querySelectorAll('tbody tr')[0]
          ?.querySelectorAll('td');
        const section = cells?.[4];
        if (section !== undefined) section.textContent = 'one';
      },
    ],
  ])('drops the whole reading on %s', (_name, breakIt) => {
    mount({ list: [{ subjectId: '01476107', section: '1', kind: 'ท' }] });
    breakIt(document);
    expect(readHostPage(document, PLANNED)).toEqual({ reading: 'drift' });
  });

  it('drops the reading on a failure it does not name, rather than throwing', () => {
    mount({ list: [{ subjectId: '01476107', section: '1', kind: 'ท' }] });
    const table = document.querySelector('.v-data-table table');
    if (table === null) throw new Error('no table');
    // A host node whose own lookup fails, as a broken or hostile page might give.
    Object.defineProperty(table, 'querySelectorAll', {
      value: () => {
        throw new TypeError('not a node list');
      },
    });
    expect(readHostPage(document, PLANNED)).toEqual({ reading: 'drift' });
  });
});

describe('readScriptNames', () => {
  it('reads only the host build script names from their src', () => {
    for (const src of [
      '/js/chunk-vendors.7ab4925e.js',
      '/js/app.454d9e95.js?x=1',
      '/js/other.js',
    ]) {
      const script = document.createElement('script');
      script.setAttribute('src', src);
      document.head.append(script);
    }
    expect(readScriptNames(document)).toEqual([
      'chunk-vendors.7ab4925e.js',
      'app.454d9e95.js',
    ]);
  });
});

describe('observedRoots', () => {
  it('watches the panel, the dialogs, and the toasts', () => {
    mount({ dialog: { kind: 'confirm' } });
    replica?.toast('submitted', '');
    const targets = observedRoots(document).map(([target]) => target);
    expect(targets).toContain(
      document.querySelector('.row.grey')?.parentElement,
    );
    expect(targets).toContain(document.querySelector('[data-app]'));
    expect(targets).toContain(document.querySelector('.toasted-container'));
    expect(
      targets.filter(
        (target) =>
          target instanceof Element &&
          target.classList.contains('v-dialog__content'),
      ),
    ).toHaveLength(2);
  });

  it('watches the app root until the panel shows', () => {
    mount({ step: 0 });
    expect(observedRoots(document)[0]?.[0]).toBe(
      document.querySelector('[data-app]'),
    );
  });
});

describe('the replica counters', () => {
  it('count a press of a host control and an untrusted event on the page', () => {
    const page = mount();
    const outside = document.createElement('div');
    document.body.append(outside);
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.interactions()).toBe(0);
    const button = [...document.querySelectorAll('button')].find((item) =>
      item.textContent.includes('ดำเนินการต่อ'),
    );
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(page.counters.clicks).toEqual({ continue: 1 });
    expect(page.counters.untrusted).toBe(1);
  });
});

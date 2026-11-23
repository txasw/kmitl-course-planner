import { afterEach, describe, expect, it } from 'vitest';
import {
  mountReplica,
  type Replica,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import type { Plan } from '@/lib/domain/plan';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { plannedSubjectId } from '@/lib/regis/plannedId';
import {
  chooseOption,
  enterSubjectId,
  openMenu,
  pressAcknowledge,
  pressAdd,
} from './hostActuator';
import {
  resolveAcknowledge,
  resolveActivator,
  resolveAdd,
  resolveField,
  resolveOptions,
} from './hostControls';

// The actuator against the replica: it acts on the five allowlisted controls only, checks
// the card and the target again in the same task, and refuses or stops on everything else.

const ID = '01476107';
// Test only: the actuator reads no plan or kit field beyond the subject ids.
const PLAN = { entries: [{ subjectId: ID }] } as unknown as Plan;
const KIT = { subjects: [{ subjectId: ID }] } as unknown as RegistrationKit;

let replica: Replica | null = null;

function mount(patch: ReplicaPatch = {}): Replica {
  replica = mountReplica(document, patch);
  replica.configure({
    delay: 0,
    catalog: { [ID]: { sections: [{ section: '1', kind: 'ท' }] } },
  });
  return replica;
}

afterEach(() => {
  expect(replica?.forbidden() ?? 0).toBe(0);
  document.body.replaceChildren();
  replica = null;
});

function planned() {
  const id = plannedSubjectId(ID, PLAN, KIT);
  if (id === null) throw new Error('not planned');
  return id;
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error('not resolved');
  return value;
}

describe('the fill actuator', () => {
  it('enters the planned id with one input event, as a paste would', () => {
    const page = mount();
    expect(enterSubjectId(required(resolveField(document)), planned())).toBe(
      'done',
    );
    expect(page.counters.reads).toBe(1);
    expect(page.counters.untrustedOn).toEqual({ subjectField: 1 });
  });

  it('never writes into a field that already holds text', () => {
    const page = mount({ add: { value: '0147' } });
    expect(enterSubjectId(required(resolveField(document)), planned())).toBe(
      'stale',
    );
    expect(page.counters.reads).toBe(0);
  });

  it('opens the menu, chooses an option, and presses Add', async () => {
    const page = mount();
    enterSubjectId(required(resolveField(document)), planned());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const activator = required(resolveActivator(document, 'primary'));
    expect(openMenu(activator)).toBe('done');
    const option = required(resolveOptions(document, 'primary'))[0];
    expect(chooseOption(required(option?.control ?? null))).toBe('done');
    expect(pressAdd(required(resolveAdd(document)))).toBe('done');
    expect(page.state.list).toHaveLength(1);
  });

  it('stops without acting while the card is busy or focus is inside it', () => {
    const page = mount({ add: { loading: true } });
    const field = required(resolveField(document));
    expect(enterSubjectId(field, planned())).toBe('stale');
    page.set({ add: {} });
    const fresh = required(resolveField(document));
    fresh.element.ownerDocument
      .querySelector<HTMLElement>('[data-count="continue"]')
      ?.focus();
    expect(enterSubjectId(fresh, planned())).toBe('stale');
    expect(page.counters.untrusted).toBe(0);
  });

  it('stops on any open dialog but presses the grade acknowledgement alone', () => {
    const page = mount({
      dialog: { kind: 'grade', subjectId: ID, prerequisites: ['01476105'] },
    });
    expect(enterSubjectId(required(resolveField(document)), planned())).toBe(
      'stale',
    );
    expect(pressAcknowledge(required(resolveAcknowledge(document)))).toBe(
      'done',
    );
    expect(page.state.dialog).toBeNull();
  });

  it('refuses a handle whose label turned into a commit label', () => {
    mount({ add: { value: ID, selected: '1', colour: 'fits' } });
    const add = required(resolveAdd(document));
    const label = add.element.querySelector('.v-btn__content');
    if (label === null) throw new Error('no label');
    label.textContent = 'ดำเนินการต่อ';
    expect(pressAdd(add)).toBe('refused');
  });

  it('refuses a handle moved into a dialog', () => {
    mount({ add: { value: ID, selected: '1', colour: 'fits' } });
    const add = required(resolveAdd(document));
    const dialog = document.createElement('div');
    dialog.className = 'v-dialog';
    document.body.append(dialog);
    dialog.append(add.element);
    expect(pressAdd(add)).toBe('refused');
  });

  it('accepts only a subject id the plan holds and the kit lists', () => {
    expect(plannedSubjectId('65010001', PLAN, KIT)).toBeNull();
    expect(plannedSubjectId('0147610', PLAN, KIT)).toBeNull();
    expect(plannedSubjectId(ID, PLAN, KIT)?.value).toBe(ID);
  });
});

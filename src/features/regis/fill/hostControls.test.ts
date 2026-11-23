import { afterEach, describe, expect, it } from 'vitest';
import {
  mountReplica,
  type Replica,
  type ReplicaConfig,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import {
  resolveAcknowledge,
  resolveActivator,
  resolveAdd,
  resolveField,
  resolveOptions,
} from './hostControls';

// The allowlist against the replica of the tested host build and its hostile variants.
// Resolving never acts: every case also checks the page saw no press.

let replica: Replica | null = null;

function mount(patch: ReplicaPatch = {}, config: ReplicaConfig = {}): Replica {
  replica = mountReplica(document, patch);
  replica.configure(config);
  return replica;
}

afterEach(() => {
  expect(replica?.interactions() ?? 0).toBe(0);
  document.body.replaceChildren();
  replica = null;
});

const OFFERED: ReplicaPatch = {
  add: {
    value: '01476107',
    sections: [{ section: '1', kind: 'ท' }],
    selected: null,
    colour: 'pending',
  },
};

describe('the host control allowlist', () => {
  it('resolves the subject id field of the add row', () => {
    mount();
    const field = resolveField(document);
    expect(field?.kind).toBe('field');
    expect(field?.element.id).toBe('input-50');
  });

  it('resolves the select activators and the options their listbox holds', () => {
    const page = mount(OFFERED);
    const activator = resolveActivator(document, 'primary');
    expect(activator?.element.getAttribute('aria-owns')).toBe('list-101');
    expect(resolveActivator(document, 'practice')).toBeNull();
    if (activator === null) throw new Error('no activator');
    expect(resolveOptions(document, activator)).toBeNull();
    page.set({
      menu: 'primary',
      add: {
        ...page.state.add,
        sections: [
          { section: '1', kind: 'ท' },
          { section: '2', kind: 'ท', curriculum: 'CE' },
        ],
      },
    });
    const options = resolveOptions(document, activator);
    expect(
      options?.map(({ section, curriculum }) => ({ section, curriculum })),
    ).toEqual([
      { section: '1', curriculum: null },
      { section: '2', curriculum: 'CE' },
    ]);
    expect(options?.[0]?.control.allowed).toHaveLength(1);
  });

  it('resolves the green add button only in its place before continue', () => {
    mount({ add: { ...OFFERED.add, selected: '1', colour: 'fits' } });
    expect(resolveAdd(document)?.element.textContent.trim()).toBe('เพิ่ม');
  });

  it.each(['continueAsAdd', 'swapped'] as const)(
    'resolves no add button when the page is %s',
    (variant) => {
      mount({}, { variant });
      expect(resolveAdd(document)).toBeNull();
    },
  );

  it('resolves the acknowledgement button of the grade dialog only', () => {
    const page = mount({
      ...OFFERED,
      dialog: { kind: 'grade', subjectId: '01476107', prerequisites: [] },
    });
    expect(resolveAcknowledge(document)?.element.textContent.trim()).toBe(
      'รับทราบ',
    );
    page.set({ dialog: { kind: 'confirm' } });
    expect(resolveAcknowledge(document)).toBeNull();
  });

  it.each(['confirmAsGrade', 'gradeConfirmButton'] as const)(
    'resolves nothing in a grade dialog that is %s',
    (variant) => {
      mount(
        {
          dialog: { kind: 'grade', subjectId: '01476107', prerequisites: [] },
        },
        { variant },
      );
      expect(resolveAcknowledge(document)).toBeNull();
    },
  );

  it('resolves nothing when the add card is on the page twice', () => {
    mount();
    const card = document.querySelector('.v-card');
    if (card?.parentElement === null || card === null) throw new Error('card');
    card.parentElement.append(card.cloneNode(true));
    expect(resolveField(document)).toBeNull();
    expect(resolveAdd(document)).toBeNull();
  });
});

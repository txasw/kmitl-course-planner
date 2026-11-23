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
  pressAdd,
} from './hostActuator';
import {
  resolveActivator,
  resolveAdd,
  resolveField,
  resolveOptions,
} from './hostControls';

// A dispatched click runs the activation behaviour of the nearest element on its path
// that has one, not only the listeners of the target: a label clicks the control it
// names, a link navigates, and a button submits the form its form attribute names from
// anywhere on the page. A host markup change that wraps an allowed control this way
// would turn a press of Add or an option into a press of Continue or a form submit, so
// the allowlist resolves nothing and the actuator refuses, and the page sees no press.

const ID = '01476107';
// Test only: the planned id check reads no plan or kit field beyond the subject ids.
const PLAN = { entries: [{ subjectId: ID }] } as unknown as Plan;
const KIT = { subjects: [{ subjectId: ID }] } as unknown as RegistrationKit;

const READY: ReplicaPatch = {
  add: {
    value: ID,
    sections: [{ section: '1', kind: 'ท' }],
    selected: '1',
    colour: 'fits',
  },
};

let replica: Replica | null = null;
let submits = 0;

function mount(patch: ReplicaPatch = READY): Replica {
  replica = mountReplica(document, patch);
  replica.configure({ delay: 0 });
  return replica;
}

afterEach(() => {
  expect(submits).toBe(0);
  expect(window.location.hash).toBe('');
  expect(replica?.forbidden() ?? 0).toBe(0);
  expect(replica?.state.dialog ?? null).toBeNull();
  document.body.replaceChildren();
  replica = null;
  submits = 0;
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('not resolved');
  return value;
}

function continueButton(): HTMLElement {
  const button = document.querySelector<HTMLElement>('[data-count="continue"]');
  if (button === null) throw new Error('no continue');
  button.id = 'host-continue';
  return button;
}

/** Wrap an element in a label that names the host's Continue button. */
function wrapInLabel(element: Element): void {
  continueButton();
  const label = document.createElement('label');
  label.htmlFor = 'host-continue';
  element.replaceWith(label);
  label.append(element);
}

/** A form elsewhere on the page that counts its submits. */
function farForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'far-form';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  document.body.append(form);
  return form;
}

describe('the fill guards against activation behaviour', () => {
  it('refuses an option that a label redirects to Continue', () => {
    const page = mount({ ...READY, menu: 'primary' });
    const option = required(resolveOptions(document, 'primary')?.[0]);
    wrapInLabel(option.control.element);
    expect(resolveOptions(document, 'primary')).toBeNull();
    expect(chooseOption(option.control)).toBe('refused');
    expect(page.counters.clicks.continue ?? 0).toBe(0);
  });

  it('refuses an activator inside a label for Continue', () => {
    const page = mount();
    const activator = required(resolveActivator(document, 'primary'));
    const select = activator.element.closest('.v-select');
    wrapInLabel(required(select));
    expect(resolveActivator(document, 'primary')).toBeNull();
    expect(openMenu(activator)).toBe('refused');
    expect(page.counters.clicks.continue ?? 0).toBe(0);
  });

  it('refuses an Add that submits a form elsewhere on the page', () => {
    mount();
    const add = required(resolveAdd(document));
    farForm();
    add.element.removeAttribute('type');
    add.element.setAttribute('form', 'far-form');
    expect(resolveAdd(document)).toBeNull();
    expect(pressAdd(add)).toBe('refused');
  });

  it('refuses an Add that is a submit button by its default type', () => {
    mount();
    const add = required(resolveAdd(document));
    add.element.removeAttribute('type');
    expect(resolveAdd(document)).toBeNull();
    expect(pressAdd(add)).toBe('refused');
  });

  it('refuses an option inside a link to another route', () => {
    mount({ ...READY, menu: 'primary' });
    const option = required(resolveOptions(document, 'primary')?.[0]);
    const link = document.createElement('a');
    link.href = '#/registration';
    option.control.element.replaceWith(link);
    link.append(option.control.element);
    expect(resolveOptions(document, 'primary')).toBeNull();
    expect(chooseOption(option.control)).toBe('refused');
  });

  it('refuses an option that is itself a link', () => {
    mount({ ...READY, menu: 'primary' });
    const option = required(resolveOptions(document, 'primary')?.[0]);
    option.control.element.setAttribute('href', '#/registration');
    expect(resolveOptions(document, 'primary')).toBeNull();
    expect(chooseOption(option.control)).toBe('refused');
  });

  it('refuses an Add nested in another host button', () => {
    mount();
    const add = required(resolveAdd(document));
    let outerPresses = 0;
    const outer = document.createElement('div');
    outer.setAttribute('role', 'button');
    outer.addEventListener('click', () => {
      outerPresses += 1;
    });
    add.element.replaceWith(outer);
    outer.append(add.element);
    expect(pressAdd(add)).toBe('refused');
    expect(outerPresses).toBe(0);
  });

  it('refuses a subject field that a form elsewhere owns', () => {
    const page = mount({});
    const field = required(resolveField(document));
    farForm();
    field.element.setAttribute('form', 'far-form');
    const id = required(plannedSubjectId(ID, PLAN, KIT));
    expect(resolveField(document)).toBeNull();
    expect(enterSubjectId(field, id)).toBe('refused');
    expect(page.counters.reads).toBe(0);
  });
});

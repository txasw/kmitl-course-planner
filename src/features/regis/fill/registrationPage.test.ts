import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mountRegistration,
  type RegistrationReplica,
  type RegistrationState,
} from '../../../../tests/e2e/host/registration/replica.js';
import { isDeniedLabel } from './denylist';
import { addCard, resolveAcknowledge, resolveAdd } from './hostControls';

// The fill resolvers against the hand written replica of the regular registration page,
// modelled on the host build of 2026-11-23 only. KCP stays at L0 there and never runs a
// resolver, so this guards the next layer down: even with the add card anchor stubbed to
// resolve to any card or area of the page, no resolver returns a control of the add,
// change, and withdraw area or of the queue panel, and the denylist refuses every one of
// their labels but Add, which only the local add resolver may name.

const stub = vi.hoisted(() => ({ card: null as Element | null }));

vi.mock('../host/hostDom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../host/hostDom')>();
  return {
    ...actual,
    cardsHeaded: (doc: Document, heading: readonly string[]) =>
      stub.card === null ? actual.cardsHeaded(doc, heading) : [stub.card],
  };
});

const COMMIT_CONTROLS = [
  'acdAdd',
  'acdChange',
  'acdWithdraw',
  'acdConfirm',
  'queueCancel',
  'queueConfirm',
];

let replica: RegistrationReplica | null = null;

function mount(state: RegistrationState): RegistrationReplica {
  replica = mountRegistration(document, { state });
  return replica;
}

afterEach(() => {
  expect(replica?.interactions() ?? 0).toBe(0);
  stub.card = null;
  document.body.replaceChildren();
  replica = null;
});

function commitControls(): HTMLElement[] {
  return COMMIT_CONTROLS.flatMap((name) => [
    ...document.querySelectorAll<HTMLElement>(`[data-count="${name}"]`),
  ]);
}

/** Every element a stubbed anchor could stand for: each card and each area of one. */
function anchors(): Element[] {
  return [
    ...document.querySelectorAll('.v-card, .add-change-delete, .queue-panel'),
    document.body,
  ];
}

describe('the resolvers on the regular registration page', () => {
  it.each<RegistrationState>(['REGIS', 'SUMMARY_REGIS', 'closed'])(
    'finds no add card on %s, since the heading has no (ล่วงหน้า) span',
    (state) => {
      mount(state);
      expect(addCard(document)).toBeNull();
      expect(resolveAdd(document)).toBeNull();
      expect(resolveAcknowledge(document)).toBeNull();
    },
  );

  it('resolves the local add once the anchor is stubbed, so the stub reaches the resolver', () => {
    mount('REGIS');
    stub.card = document.querySelector('.v-card--flat');
    expect(resolveAdd(document)?.element.getAttribute('data-count')).toBe(
      'add',
    );
  });

  it('never resolves a commit or queue control, whatever the anchor resolves to', () => {
    mount('SUMMARY_REGIS');
    const forbidden = commitControls();
    expect(forbidden).toHaveLength(COMMIT_CONTROLS.length);
    for (const anchor of anchors()) {
      stub.card = anchor;
      expect(addCard(document)).toBe(anchor);
      const add = resolveAdd(document);
      const acknowledge = resolveAcknowledge(document);
      expect(forbidden).not.toContain(add?.element);
      expect(forbidden).not.toContain(acknowledge?.element);
    }
  });

  it('refuses every commit and queue label but Add, which needs its own handle', () => {
    mount('SUMMARY_REGIS');
    const labels = commitControls().map((element) => ({
      name: element.getAttribute('data-count'),
      denied: isDeniedLabel(element.textContent),
    }));
    expect(labels).toEqual([
      { name: 'acdAdd', denied: false },
      { name: 'acdChange', denied: true },
      { name: 'acdWithdraw', denied: true },
      { name: 'acdConfirm', denied: true },
      { name: 'queueCancel', denied: true },
      { name: 'queueConfirm', denied: true },
    ]);
  });
});

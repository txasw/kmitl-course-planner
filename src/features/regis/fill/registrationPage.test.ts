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
// resolver, and the add card anchor, whose heading needs the (ล่วงหน้า) span, is the first
// barrier. This guards the next layer down: with the anchor stubbed to resolve to any card
// or area of the page, no resolver returns a control of the add, change, and withdraw area
// or of the queue panel. The local add resolver needs the button after its block to read
// Continue, so it refuses the area's Add even when the area's confirm is coloured as the
// continue button is. The denylist refuses every label of those controls but Add.

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

function mount(
  state: RegistrationState,
  variant?: 'orangeConfirm',
): RegistrationReplica {
  replica = mountRegistration(
    document,
    variant === undefined ? { state } : { state, variant },
  );
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

  it.each([undefined, 'orangeConfirm'] as const)(
    'never resolves a commit or queue control, whatever the anchor resolves to (%s)',
    (variant) => {
      mount('SUMMARY_REGIS', variant);
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
    },
  );

  it('refuses the area Add when its confirm is coloured as the continue button', () => {
    mount('SUMMARY_REGIS', 'orangeConfirm');
    const area = document.querySelector('.add-change-delete');
    // The area matches every structural check of the local add but the Continue label.
    expect(
      area?.querySelector('.v-data-table')?.nextElementSibling
        ?.nextElementSibling,
    ).toHaveClass('deep-orange');
    stub.card = area;
    expect(resolveAdd(document)).toBeNull();
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

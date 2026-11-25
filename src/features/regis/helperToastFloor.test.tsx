import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { toSnapshot } from '@/lib/planner/transaction';
import { Launcher } from '@/features/shell/Launcher';
import { Toaster } from '@/features/shell/Toaster';
import { TOAST_REGION_ID } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { planStore } from '@/features/plans/planStore';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { fillStore } from './fill/fillRun';
import { CARD_ID, setCollapsed, startVisit } from './helperStore';
import { HELPER_TOAST_GAP } from './helperToastFloor';
import { hostStore } from './host/hostStore';
import { RegisHelper } from './RegisHelper';
import { regisStore } from './regisStore';

// On a helper page on a phone the toast region floats above the card, or above the
// launcher while the card is collapsed or too tall to leave room, so a toast never covers
// the launcher's checklist count or the card's controls.

const COURSE = makeCourse({
  subjectId: '01476107',
  sections: [makeSection({ teachTableId: 'T1', subjectId: '01476107' })],
});
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      snapshot: toSnapshot(COURSE, COURSE.sections[0] ?? makeSection()),
    }),
  ],
});

// A 844 px tall screen: the launcher's top at 776, the card's top as each test sets it.
let cardTop = 500;

function rectOf(node: HTMLElement): DOMRect {
  const at = (top: number, bottom: number) =>
    DOMRect.fromRect({ x: 0, y: top, width: 390, height: bottom - top });
  if (node.id === CARD_ID) return at(cardTop, 764);
  if (node.id === 'kcp-launcher') return at(776, 824);
  if (node.id === TOAST_REGION_ID) {
    const bottom = Number.parseFloat(node.style.bottom);
    return at(0, 844 - (Number.isFinite(bottom) ? bottom : 16));
  }
  return at(0, 0);
}

function renderPage() {
  window.location.hash = '#/pre_registration';
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
  });
  render(
    <>
      <RegisHelper />
      <Launcher />
      <Toaster />
    </>,
  );
  const region = document.getElementById(TOAST_REGION_ID);
  if (region === null) throw new Error('no toast region');
  return region;
}

beforeEach(() => {
  installViewport(390);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return rectOf(this);
    },
  );
  regisStore.setState({ kits: [], choices: [] });
  hostStore.setState({
    health: { status: 'healthy' },
    page: null,
    term: { year: '2569', semester: '1' },
  });
  startVisit();
  cardTop = 500;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fillStore.setState({ run: { status: 'idle' }, stop: false, shown: null });
  act(() => {
    uiStore.getState().close();
  });
  window.location.hash = '';
});

describe('the toast region on a helper page on a phone', () => {
  it('floats above the open card', () => {
    const region = renderPage();
    expect(region.style.bottom).toBe(
      `${String(844 - 500 + HELPER_TOAST_GAP)}px`,
    );
  });

  it('floats above the launcher while the card is collapsed', () => {
    const region = renderPage();
    act(() => {
      setCollapsed(true);
    });
    expect(region.style.bottom).toBe(
      `${String(844 - 776 + HELPER_TOAST_GAP)}px`,
    );
  });

  it('floats above the launcher when the card leaves no room above it', () => {
    cardTop = 40;
    const region = renderPage();
    expect(region.style.bottom).toBe(
      `${String(844 - 776 + HELPER_TOAST_GAP)}px`,
    );
  });

  it('rests at its own place on a wide screen', () => {
    installViewport(1280);
    const region = renderPage();
    expect(region.style.bottom).toBe('');
  });
});

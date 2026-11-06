import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  vi,
  type Mock,
} from 'vitest';
import { dragStore } from '@/features/planner/dragStore';
import { makeSection } from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import {
  CATALOG_COLUMN_ID,
  CATALOG_HIDE_ID,
  CATALOG_RAIL_ID,
  CATALOG_TOGGLE_ID,
  POINTER_TOGGLE_GUARD_MS,
  closeSheet,
  finishCatalogSlide,
  hideCatalog,
  readMotionToken,
  showCatalog,
} from './catalogVisibility';
import { uiStore } from './uiStore';

// The pointer guard keeps its last toggle time in module scope, so each test starts its
// clock well past the previous test's window instead of resetting the module.
let clock = 0;

function advance(ms: number): void {
  clock += ms;
}

function mountControls(): { rail: HTMLButtonElement; hide: HTMLButtonElement } {
  const rail = document.createElement('button');
  rail.id = CATALOG_RAIL_ID;
  const hide = document.createElement('button');
  hide.id = CATALOG_HIDE_ID;
  document.body.append(rail, hide);
  return { rail, hide };
}

beforeEach(() => {
  advance(10_000);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  dragStore.getState().clearBlockMove();
  uiStore.getState().setCatalogVisible(true);
});

describe('catalog visibility funnel', () => {
  it('hides the column and focuses the rail, then shows it and focuses the hide control', () => {
    const { rail, hide } = mountControls();
    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
    expect(rail).toHaveFocus();

    showCatalog(rail, 0);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(hide).toHaveFocus();
  });

  it('focuses a named target when showing the column', () => {
    const { rail } = mountControls();
    const course = document.createElement('div');
    course.id = 'kcp-course-target';
    course.tabIndex = -1;
    document.body.append(course);
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 0, course.id);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(course).toHaveFocus();
  });

  it.each([0, 1])(
    'does nothing while a block move is in flight, at detail %i',
    (detail) => {
      const { rail, hide } = mountControls();
      const section = makeSection({ teachTableId: 'p' });
      dragStore.getState().startBlockMove(section, [section], null);

      hideCatalog(hide, detail);
      expect(uiStore.getState().catalogVisible).toBe(true);

      uiStore.getState().setCatalogVisible(false);
      showCatalog(rail, detail);
      expect(uiStore.getState().catalogVisible).toBe(false);
    },
  );

  it('ends a double click on the rail with the column shown', () => {
    const { rail, hide } = mountControls();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);
    // The second click of the pair lands on the hide control at the same point.
    advance(POINTER_TOGGLE_GUARD_MS + 50);
    hideCatalog(hide, 2);
    expect(uiStore.getState().catalogVisible).toBe(true);
  });

  it('ignores a second pointer toggle inside the window but not a keyboard one', () => {
    const { rail, hide } = mountControls();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 1);
    advance(POINTER_TOGGLE_GUARD_MS - 1);
    hideCatalog(hide, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);

    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
  });

  it('accepts a pointer toggle once the window has passed', () => {
    const { rail, hide } = mountControls();
    hideCatalog(hide, 1);
    advance(POINTER_TOGGLE_GUARD_MS);
    showCatalog(rail, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);
  });
});

// jsdom has no Web Animations API. These fakes record every effect the slide starts and
// answer getAnimations per element with the effects still running, which is all the funnel
// reads. Each fake is cast to Animation because it implements only the members the funnel
// calls: id, cancel and finish.
interface FakeEffect {
  element: Element;
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  options: KeyframeAnimationOptions;
  running: boolean;
  id: string;
  cancel: Mock<() => void>;
  finish: Mock<() => void>;
}

describe('catalog slide', () => {
  let effects: FakeEffect[] = [];

  function fakeAnimate(
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ): Animation {
    const timing = typeof options === 'object' ? options : {};
    const effect: FakeEffect = {
      element: this,
      keyframes,
      options: timing,
      running: true,
      id: timing.id ?? '',
      cancel: vi.fn(() => {
        effect.running = false;
      }),
      finish: vi.fn(() => {
        effect.running = false;
      }),
    };
    effects.push(effect);
    return effect as unknown as Animation;
  }

  function fakeGetAnimations(this: Element): Animation[] {
    return effects.filter(
      (effect) => effect.element === this && effect.running,
    ) as unknown as Animation[];
  }

  function mountColumn(): {
    column: HTMLElement;
    shadow: HTMLElement;
    rail: HTMLButtonElement;
    hide: HTMLButtonElement;
  } {
    const column = document.createElement('div');
    column.id = CATALOG_COLUMN_ID;
    column.style.setProperty('--kcp-duration-fast', '150ms');
    column.style.setProperty('--kcp-duration-base', '200ms');
    column.style.setProperty('--kcp-ease-enter', 'cubic-bezier(0.2, 0, 0, 1)');
    column.style.setProperty('--kcp-ease-exit', 'cubic-bezier(0.4, 0, 1, 1)');
    const shadow = document.createElement('span');
    shadow.setAttribute('data-catalog-shadow', '');
    const hide = document.createElement('button');
    hide.id = CATALOG_HIDE_ID;
    column.append(shadow, hide);
    const rail = document.createElement('button');
    rail.id = CATALOG_RAIL_ID;
    document.body.append(column, rail);
    return { column, shadow, rail, hide };
  }

  function on(element: Element): FakeEffect[] {
    return effects.filter((effect) => effect.element === element);
  }

  beforeEach(() => {
    effects = [];
    Element.prototype.animate = fakeAnimate;
    vi.spyOn(Element.prototype, 'getAnimations').mockImplementation(
      fakeGetAnimations,
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'animate');
    vi.unstubAllGlobals();
  });

  it('slides the column in by transform over the base duration and fades its shadow', () => {
    const { column, shadow, rail } = mountColumn();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 0);

    const [slide, ...rest] = on(column);
    expect(rest).toHaveLength(0);
    expect(slide?.keyframes).toEqual({
      transform: ['translateX(-100%)', 'none'],
    });
    expect(slide?.options).toMatchObject({
      duration: 200,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'none',
    });
    const [fade] = on(shadow);
    expect(fade?.keyframes).toEqual({ opacity: [1, 0] });
    expect(fade?.options).toMatchObject({ duration: 200 });
  });

  it('slides the column out over the fast duration and keeps it visible until the end', () => {
    const { column, shadow, hide } = mountColumn();
    hideCatalog(hide, 0);

    const keyframes = on(column).map((effect) => effect.keyframes);
    expect(keyframes).toEqual([
      { transform: ['none', 'translateX(-100%)'] },
      { visibility: ['visible', 'hidden'] },
    ]);
    for (const effect of on(column)) {
      expect(effect.options).toMatchObject({
        duration: 150,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'none',
      });
    }
    expect(on(shadow).map((effect) => effect.keyframes)).toEqual([
      { opacity: [0, 1] },
    ]);
  });

  it('cancels a running slide before it starts the next', () => {
    const { rail, hide } = mountColumn();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 0);
    const showing = [...effects];
    expect(showing).toHaveLength(2);

    hideCatalog(hide, 0);
    for (const effect of showing) {
      expect(effect.cancel).toHaveBeenCalledOnce();
    }
    expect(effects.filter((effect) => effect.running)).toHaveLength(3);
  });

  it('changes at once with no effect when motion is reduced', () => {
    installViewport(1440, { reducedMotion: true });
    const { rail, hide } = mountColumn();
    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
    showCatalog(rail, 0);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(effects).toHaveLength(0);
  });

  it('stays instant when a motion token cannot be read', () => {
    const { column, hide } = mountColumn();
    column.style.removeProperty('--kcp-duration-fast');
    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
    expect(effects).toHaveLength(0);
  });

  it('finishes a running slide on request', () => {
    const { rail } = mountColumn();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 0);
    finishCatalogSlide(document);
    for (const effect of effects) {
      expect(effect.finish).toHaveBeenCalledOnce();
    }
  });

  it('reads a duration token in milliseconds in either unit', () => {
    const element = document.createElement('div');
    document.body.append(element);
    element.style.setProperty('--kcp-duration-base', '200ms');
    expect(readMotionToken(element, '--kcp-duration-base')).toBe(200);
    element.style.setProperty('--kcp-duration-base', '.2s');
    expect(readMotionToken(element, '--kcp-duration-base')).toBe(200);
    element.style.setProperty('--kcp-duration-base', '');
    expect(readMotionToken(element, '--kcp-duration-base')).toBe(0);
    expect(readMotionToken(element, '--kcp-missing')).toBe(0);
  });
});

describe('closeSheet', () => {
  it('closes the sheet and moves focus to the header toggle', () => {
    const control = document.createElement('button');
    const toggle = document.createElement('button');
    toggle.id = CATALOG_TOGGLE_ID;
    document.body.append(control, toggle);
    uiStore.getState().setSheetOpen(true);
    closeSheet(control);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(toggle).toHaveFocus();
  });
});

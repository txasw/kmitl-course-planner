// The first run product tour (ADR-0074): a spotlight on one real control per step and a
// small card that names the step, says what the control does in one sentence, counts the
// steps, and carries Back, Next (Finish on the last step) and Skip. It renders into the
// panel node, above every layer of the panel, so it shares the panel's shadow scoped
// styles and its language.
//
// The layer covers the panel and takes every press, so nothing under it changes while a
// step points at it; the spotlight is a hole in the dim, the spread of its own box shadow,
// so the target stays lit but is shown, not operated. The card is a modal dialog labelled
// by its title and described by its sentence. Focus moves to Next as the tour opens, Tab
// stays inside the card, and Escape skips. A polite region inside the card speaks each
// step after the first, since Next keeps focus as the steps change and focus alone would
// not say that the card did. When the tour ends, focus moves to the control the last step
// pointed at when it can take focus, else to the panel, so it never falls to the host page.
//
// A step first lays out the view it lives in, then waits a few frames for its control to
// show. A step whose control never shows is left out and the count follows, so the card
// never points at a hidden element. The card's place comes from the pure placeTourCard,
// which keeps it in one place across steps unless that would cover the spotlight. The
// spotlight glides between targets and holds still under reduced motion.

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useStore } from 'zustand';
import {
  availableSteps,
  indexAfterDrop,
  TOUR_STEPS,
  type TourStep,
} from '@/lib/onboarding/tour';
import {
  placeTourCard,
  type Box,
  type Size,
} from '@/lib/onboarding/tourPlacement';
import type { OnboardingRepository, TourMark } from '@/lib/storage/onboarding';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { useOpenSurface } from '@/features/shell/attentionStore';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { toastStore } from '@/features/shell/toastStore';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import {
  activeElementWithin,
  useFocusTrap,
} from '@/features/shell/useFocusTrap';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { onboardingStore } from './onboardingStore';
import { openProductTour } from './openProductTour';
import { recordTourOutcome } from './recordOnboardingMoment';
import {
  hasTarget,
  isShown,
  resolveAnchor,
  revealWithin,
  showTourView,
  type ResolvedAnchor,
} from './tourAnchors';

/** How many frames a step waits for its control to show before it is left out. */
const RESOLVE_FRAMES = 12;

/** The room the spotlight leaves around its control, in CSS pixels. */
const SPOT_PAD = 4;

/** The least room the spotlight keeps from the panel edge, so its 2 px ring shows. */
const SPOT_EDGE = 2;

const CONTROLS_SELECTOR = 'a[href], button:not([disabled]), [tabindex="0"]';

const NEXT_BUTTON = `inline-flex w-full items-center justify-center rounded-kcp bg-primary-strong px-4 py-2 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_RING}`;

const QUIET_BUTTON = `inline-flex shrink-0 items-center justify-center rounded-kcp px-2.5 py-1 text-sm text-ink-soft hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`;

export interface ProductTourProps {
  /** Only the patch: the tour's end is recorded through the repository. */
  record: Pick<OnboardingRepository, 'patch'>;
}

export function ProductTour({ record }: ProductTourProps) {
  const open = useStore(onboardingStore, (state) => state.tourOpen);
  const panel = usePanelPortal();
  return open && panel !== null ? (
    <OpenProductTour record={record} panel={panel} />
  ) : null;
}

interface OpenProductTourProps extends ProductTourProps {
  panel: HTMLElement;
}

interface Shown {
  step: TourStep;
  resolved: ResolvedAnchor;
}

/**
 * The control focus returns to when the tour ends: the target or a control inside it. In
 * a group with a roving tab stop, such as the search tabs or the day chips, that is the
 * stop, the selected or checked item, rather than the group's first item.
 */
function returnTarget(element: HTMLElement): HTMLElement | null {
  if (element.matches(CONTROLS_SELECTOR)) return element;
  return (
    element.querySelector<HTMLElement>('[tabindex="0"]') ??
    element.querySelector<HTMLElement>(CONTROLS_SELECTOR)
  );
}

function sameBox(a: Box | null, b: Box): boolean {
  return (
    a !== null &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}

/**
 * The panel's size and the room the card leaves at its head and foot: the device safe
 * areas, and at the foot the phone bottom nav as well, so the card rests above the nav with
 * its gutter rather than cutting through the nav labels.
 */
interface PanelFrame extends Size {
  insetTop: number;
  insetBottom: number;
}

function OpenProductTour({ record, panel }: OpenProductTourProps) {
  const { t, language } = useTranslation();
  const tier = useLayoutTier();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Null until the first frame after the tour opens. The tour can open in the same render
  // that leaves the export page, and only once that render commits does the panel hold
  // the edit workspace whose controls the steps point at.
  const [steps, setSteps] = useState<readonly TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const direction = useRef<1 | -1>(1);
  const [shown, setShown] = useState<Shown | null>(null);
  const [spot, setSpot] = useState<Box | null>(null);
  const [frame, setFrame] = useState<PanelFrame | null>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  // Whether the student has moved between steps, after which each step is spoken.
  const [moved, setMoved] = useState(false);

  useOpenSurface(true);
  // A toast from before the tour would only return over the card's foot once it ends.
  useEffect(() => {
    toastStore.getState().dismiss();
  }, []);
  useFocusTrap(cardRef, shown !== null);

  const end = useCallback(
    (outcome: TourMark['outcome']) => {
      recordTourOutcome(record, outcome);
      const element = shown?.resolved.element;
      commitThenFocus(
        () => {
          onboardingStore.getState().endTour();
        },
        () => [element === undefined ? null : returnTarget(element), panel],
        { preventScroll: true },
      );
      toastStore.getState().show('success', t('tour.ended'), {
        label: t('tour.replay'),
        run: openProductTour,
      });
    },
    [panel, record, shown, t],
  );

  const endRef = useRef(end);
  useEffect(() => {
    endRef.current = end;
  }, [end]);

  const skip = useCallback(() => {
    end('skipped');
  }, [end]);
  useEscapeLayer(cardRef, skip, shown !== null);

  // Measures the target and the panel into the spotlight box, the same way on the frame
  // a step first shows and on every frame after.
  const measure = useCallback(
    (element: HTMLElement): void => {
      const frame = panel.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      // A control flush with the panel edge keeps its ring inside the panel, where it
      // can be seen, rather than spilling the padding past the screen edge.
      const left = Math.max(SPOT_EDGE, box.left - frame.left - SPOT_PAD);
      const top = Math.max(SPOT_EDGE, box.top - frame.top - SPOT_PAD);
      const right = Math.min(
        frame.width - SPOT_EDGE,
        box.right - frame.left + SPOT_PAD,
      );
      const bottom = Math.min(
        frame.height - SPOT_EDGE,
        box.bottom - frame.top + SPOT_PAD,
      );
      const next: Box = {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(Math.max(0, right - left)),
        height: Math.round(Math.max(0, bottom - top)),
      };
      setSpot((current) => (sameBox(current, next) ? current : next));
      const probe = probeRef.current;
      const safeBottom =
        probe === null
          ? 0
          : frame.height - probe.offsetTop - probe.offsetHeight;
      // The nav pads itself clear of the safe area, so its top bounds the foot alone.
      const nav = panel.querySelector('[data-bottom-nav]');
      const navFoot =
        nav === null
          ? 0
          : Math.round(frame.bottom - nav.getBoundingClientRect().top);
      const measured: PanelFrame = {
        width: frame.width,
        height: frame.height,
        insetTop: probe?.offsetTop ?? 0,
        insetBottom: Math.max(safeBottom, navFoot),
      };
      setFrame((current) =>
        current !== null &&
        current.width === measured.width &&
        current.height === measured.height &&
        current.insetTop === measured.insetTop &&
        current.insetBottom === measured.insetBottom
          ? current
          : measured,
      );
    },
    [panel],
  );

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setSteps(
        availableSteps(TOUR_STEPS, (target) => hasTarget(panel, target)),
      );
    });
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [panel]);

  // Lay out the step's view, then wait for its control. A step whose control never shows
  // is left out, and the tour moves on in the direction it was going. A tier change lays
  // the step out again for the new tier. A tour with no step left ends as finished, since
  // nothing was missed; it ends on the next frame, outside React's commit, so the focus
  // move that ending makes can flush its own render.
  useEffect(() => {
    if (steps === null) return undefined;
    const step = steps[index];
    if (step === undefined) {
      const handle = requestAnimationFrame(() => {
        endRef.current('completed');
      });
      return () => {
        cancelAnimationFrame(handle);
      };
    }
    showTourView(step.view, tier);
    let frame = 0;
    let handle = 0;
    const look = (): void => {
      const resolved = resolveAnchor(panel, step);
      if (resolved !== null) {
        revealWithin(resolved.element, panel);
        measure(resolved.element);
        setShown({ step, resolved });
        return;
      }
      frame += 1;
      if (frame < RESOLVE_FRAMES) {
        handle = requestAnimationFrame(look);
        return;
      }
      setSteps((current) =>
        current === null
          ? current
          : current.filter((candidate) => candidate !== step),
      );
      setIndex(indexAfterDrop(index, direction.current));
    };
    handle = requestAnimationFrame(look);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [steps, index, panel, tier, measure]);

  // Follow the target every frame while a step shows, since a scroll, a resize, or a late
  // layout can move it, and find it again if a render replaced its node. Focus that a
  // view change pulled out of the card, as the catalog sheet does when it opens, returns
  // to Next.
  useEffect(() => {
    if (shown === null) return undefined;
    let handle = 0;
    let element = shown.resolved.element;
    const follow = (): void => {
      if (!isShown(element)) {
        const again = resolveAnchor(panel, shown.step);
        if (again !== null) element = again.element;
      }
      measure(element);
      const card = cardRef.current;
      if (card !== null) {
        setCardHeight(card.offsetHeight);
        const active = activeElementWithin(card);
        if (active === null || !card.contains(active)) {
          nextRef.current?.focus({ preventScroll: true });
        }
      }
      handle = requestAnimationFrame(follow);
    };
    handle = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [shown, panel, measure]);

  // The card's height is read before paint on each step, so the frame a step first shows
  // places the card with its own height, not none or the last step's; the follow loop
  // keeps it current after that.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card !== null) setCardHeight(card.offsetHeight);
  }, [shown]);

  // Focus starts on Next once the first step shows.
  const firstShown = shown !== null;
  useLayoutEffect(() => {
    if (firstShown) nextRef.current?.focus({ preventScroll: true });
  }, [firstShown]);

  const tourSteps = steps ?? [];
  const shownIndex = shown === null ? -1 : tourSteps.indexOf(shown.step);
  const count = fillTemplate(t('tour.count'), {
    current: String(shownIndex + 1),
    total: String(tourSteps.length),
  });

  // The first step is read with the dialog as focus lands in it; each step shown after a
  // move is spoken here, in the same render that shows it.
  const announcement =
    moved && shown !== null && shownIndex === index
      ? `${count} ${t(shown.step.title)} ${t(shown.resolved.anchor.body)}`
      : '';

  const last = shownIndex === tourSteps.length - 1;
  const handleNext = (): void => {
    if (last) {
      end('completed');
      return;
    }
    direction.current = 1;
    setMoved(true);
    setIndex(shownIndex + 1);
  };
  const handleBack = (): void => {
    direction.current = -1;
    setMoved(true);
    setIndex(Math.max(0, shownIndex - 1));
  };

  const placement =
    spot === null || frame === null || frame.width === 0
      ? null
      : placeTourCard({
          panel: frame,
          spot,
          cardHeight,
          insetTop: frame.insetTop,
          insetBottom: frame.insetBottom,
        });

  return createPortal(
    <div
      lang={language}
      data-product-tour=""
      className="absolute inset-0 z-tooltip text-ink"
    >
      {/* Takes the device safe areas as its offsets, so the card can clear a notch or a
          home indicator that CSS reports only as env() values. */}
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-(--kcp-safe-top) bottom-(--kcp-safe-bottom)"
      />
      {spot === null ? (
        <div aria-hidden="true" className="kcp-tour-dim absolute inset-0" />
      ) : (
        <div
          aria-hidden="true"
          data-tour-spot=""
          className="kcp-tour-spot absolute"
          style={{
            left: spot.x,
            top: spot.y,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}
      {shown === null ? null : (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          tabIndex={-1}
          data-tour-card=""
          className={`absolute flex flex-col gap-1 rounded-kcp bg-surface px-4 pt-2 pb-4 shadow-kcp outline-none ${
            placement === null ? 'invisible' : ''
          }`}
          style={
            placement === null
              ? { left: 16, right: 16, bottom: 16 }
              : { left: placement.x, top: placement.y, width: placement.width }
          }
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span aria-hidden="true" className="flex shrink-0 gap-1">
              {tourSteps.map((step, position) => (
                <span
                  key={step.id}
                  className={`block h-1 w-3.5 rounded-full ${
                    position <= shownIndex ? 'bg-ink' : 'bg-border'
                  }`}
                />
              ))}
            </span>
            <span className="text-xs text-ink-soft tabular-nums">{count}</span>
            <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
              {shownIndex > 0 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className={`${QUIET_BUTTON} gap-0.5`}
                >
                  <ChevronLeft
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className="shrink-0"
                  />
                  {t('tour.back')}
                </button>
              ) : null}
              <button type="button" onClick={skip} className={QUIET_BUTTON}>
                {t('tour.skip')}
              </button>
            </span>
          </div>
          <h2 id={titleId} className="text-base font-semibold break-words">
            {t(shown.step.title)}
          </h2>
          <p id={bodyId} className="text-sm break-words text-ink-soft">
            {t(shown.resolved.anchor.body)}
          </p>
          <div className="mt-3">
            <button
              ref={nextRef}
              type="button"
              onClick={handleNext}
              className={NEXT_BUTTON}
            >
              {t(last ? 'tour.finish' : 'tour.next')}
            </button>
          </div>
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement}
          </p>
        </div>
      )}
    </div>,
    panel,
  );
}

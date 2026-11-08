// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file. It runs in the head, before the stylesheet, so the classes that
// switch the motion on exist before the first layout and nothing shifts or flashes:
// .motion unless the reader prefers reduced motion, and .no-sda where the browser has no
// scroll driven animations, so the stylesheet plays each moment from the classes this
// file adds as blocks come into view. The two pinned scenes step on their own clock in
// every browser once the scroll crosses each of their lines. It also marks a Firefox
// visitor so the Firefox badge comes first, and carries the section in the address
// across the language switch. It listens to no scroll event, sends nothing anywhere and
// stores nothing.

(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Every moment needs an observer to find its place, so a browser without one keeps
  // the still page.
  function syncMotion() {
    root.classList.toggle(
      'motion',
      !reduce.matches && 'IntersectionObserver' in window,
    );
  }

  syncMotion();
  reduce.addEventListener('change', syncMotion);
  if (!CSS.supports('animation-timeline: view()')) {
    root.classList.add('no-sda');
  }
  if (navigator.userAgent.includes('Firefox/')) {
    root.classList.add('is-firefox');
  }

  const scrollDriven = () => !root.classList.contains('no-sda');

  /** Copy a numeric data attribute into a custom property through the CSSOM. */
  function indexVar(el, data, name) {
    const value = el.getAttribute(data);
    if (value !== null) {
      el.style.setProperty(name, value);
    }
  }

  // Path B: each block reveals once, the first time a fifth of it is in view.
  function revealOnView() {
    const blocks = document.querySelectorAll('[data-reveal]');
    if (scrollDriven()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );
    blocks.forEach((block) => {
      observer.observe(block);
    });
  }

  // Path B: the closing band plays once, when a third of it is in view.
  function playClose() {
    const band = document.querySelector('.download');
    if (band === null || scrollDriven()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          band.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(band);
  }

  // Path B: the hero frame stands up once its track is well in view; a third of the
  // track on a window that pins it, a fifth elsewhere.
  function standHeroFrame() {
    const track = document.querySelector('.hero__track');
    if (
      track === null ||
      scrollDriven() ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }
    const pinned = window.matchMedia(
      '(min-width: 768px) and (min-height: 680px)',
    );
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry !== undefined &&
          entry.intersectionRatio >= (pinned.matches ? 0.35 : 0.2)
        ) {
          track.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: [0.2, 0.35] },
    );
    observer.observe(track);
  }

  // The header is 56 px tall on a phone and 64 px elsewhere, as site.css sets
  // --header-h. A media query answers without a layout, so setting up the scenes never
  // forces the first layout inside the script's own task.
  const narrow = window.matchMedia('(max-width: 639px)');
  const headerHeight = () => (narrow.matches ? 56 : 64);

  /**
   * Watch zero height sentinels placed at fractions of a pinned track's scroll distance,
   * and report the index of the last one above the line under the header, or -1. The
   * observed band runs from far above the window down to that line, so a fast scroll
   * that jumps a sentinel past the line in one frame still changes its state.
   */
  function watchSentinels(track, fractions, onIndex) {
    const sentinels = fractions.map((fraction) => {
      const sentinel = document.createElement('div');
      sentinel.className = 'sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.setProperty('--at', String(fraction));
      track.append(sentinel);
      return sentinel;
    });
    const above = new Set();
    let observer = null;
    const build = () => {
      observer?.disconnect();
      above.clear();
      const bottom = Math.max(0, window.innerHeight - headerHeight());
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const index = sentinels.indexOf(entry.target);
            if (entry.isIntersecting) {
              above.add(index);
            } else {
              above.delete(index);
            }
          });
          onIndex(above.size === 0 ? -1 : Math.max(...above));
        },
        { rootMargin: `100000px 0px -${String(bottom)}px 0px` },
      );
      sentinels.forEach((sentinel) => {
        observer.observe(sentinel);
      });
    };
    build();
    window.addEventListener('resize', build);
  }

  // A step that has played stays in view this long before a queued step follows it.
  const HOLD = 600;
  // Stepping back plays the reverse transitions, which are short.
  const STEP_BACK = 350;

  /**
   * Move a scene one step at a time toward the step its scroll position asks for. Each
   * step plays on its own clock, its transition in site.css, and the next step waits
   * until it has finished and held, so a fast flick that crosses every line at once still
   * shows each step whole instead of a blur, while a slow reader, whose lines come further
   * apart than that, sees no wait. Scrolling back steps down the same way.
   */
  function stepper(el, durations) {
    let shown = 0;
    let wanted = 0;
    let timer = 0;
    const advance = () => {
      timer = 0;
      if (shown === wanted) return;
      const forward = wanted > shown;
      const wait = forward ? (durations[shown] ?? 0) + HOLD : STEP_BACK;
      shown += forward ? 1 : -1;
      el.dataset.step = String(shown);
      timer = window.setTimeout(advance, wait);
    };
    el.dataset.step = '0';
    return (index) => {
      wanted = index + 1;
      if (timer === 0) advance();
    };
  }

  // The dedupe stage plays two steps: the repeats fade while the counter turns from rows
  // to sections, then the sections close up and take their labels. The thirteen rows
  // hold before the first line and the merged sections hold for most of the track after
  // the second. Each number is the step's longest transition in site.css, in ms.
  const DEDUPE_STEPS = [0.16, 0.32];
  const DEDUPE_TIMES = [900, 1200];

  function enhanceDedupe(pin) {
    const track = pin.closest('.dedupe-track');
    if (track === null) return;
    pin.querySelectorAll('tbody tr').forEach((row) => {
      indexVar(row, 'data-i', '--i');
      indexVar(row, 'data-slot', '--t');
    });
    // How many rows stay and go, which size the merged card.
    indexVar(pin, 'data-kept', '--kept');
    indexVar(pin, 'data-gone', '--gone');
    watchSentinels(track, DEDUPE_STEPS, stepper(pin, DEDUPE_TIMES));
  }

  // The story's three beats start at these fractions of its pinned scroll; the first
  // while the dark band is still rising to the header, so the grid is drawn by the time
  // it pins. Each beat then holds for about a third of the track before the next.
  const STORY_BEATS = [-0.15, 0.34, 0.65];
  const STORY_TIMES = [1000, 1000, 1100];

  function enhanceStory(track) {
    const pin = track.querySelector('.story__pin');
    if (pin === null) return;
    track.querySelectorAll('.story__block[data-b]').forEach((block) => {
      indexVar(block, 'data-b', '--b');
    });
    watchSentinels(track, STORY_BEATS, stepper(pin, STORY_TIMES));
  }

  // Both language pages share their section ids, so switching language keeps the reader
  // at the section the address names instead of returning them to the top.
  const SHARED_SECTIONS = new Set(['features', 'privacy', 'faq', 'download']);

  function keepSectionAcrossLanguages() {
    document.querySelectorAll('a[lang][hreflang]').forEach((link) => {
      link.addEventListener('click', () => {
        const id = window.location.hash.slice(1);
        if (SHARED_SECTIONS.has(id)) {
          link.hash = id;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.fact[data-i]').forEach((fact) => {
      indexVar(fact, 'data-i', '--i');
    });
    revealOnView();
    standHeroFrame();
    playClose();
    if ('IntersectionObserver' in window) {
      document.querySelectorAll('[data-dedupe]').forEach(enhanceDedupe);
      document.querySelectorAll('.story__track').forEach(enhanceStory);
    }
    keepSectionAcrossLanguages();
  });
})();

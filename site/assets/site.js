// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file. It runs in the head, before the stylesheet, so the classes that
// switch the motion on exist before the first layout and nothing shifts or flashes:
// .motion unless the reader prefers reduced motion, and .no-sda where the browser has no
// scroll driven animations, so the stylesheet plays each moment from the classes this
// file adds as blocks come into view. It also marks a Firefox visitor so the Firefox
// button is the filled one, and carries the section in the address across the language
// switch. It listens to no scroll event, sends nothing anywhere and stores nothing.

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

  /**
   * Watch zero height sentinels placed at fractions of a pinned track's scroll distance,
   * and report the index of the last one above the line under the header, or -1. The
   * observed band runs from far above the window down to that line, so a fast scroll
   * that jumps a sentinel past the line in one frame still changes its state.
   */
  function watchSentinels(track, fractions, onIndex) {
    // Read the header height before the sentinels go in, so the read costs no layout.
    const headerHeight = () =>
      parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 0;
    let header = headerHeight();
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
      const bottom = Math.max(0, window.innerHeight - header);
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
    window.addEventListener('resize', () => {
      header = headerHeight();
      build();
    });
  }

  // The stage pins on any window tall enough to hold it with its densest rows.
  const DEDUPE_PIN = '(min-height: 540px)';

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

    // A pinned stage in a browser with scroll driven animations scrubs the merge on its
    // view timeline; elsewhere the merge plays from .is-merged with transitions.
    const pinned = window.matchMedia(DEDUPE_PIN);
    const drive = () => {
      pin.dataset.drive = scrollDriven() && pinned.matches ? 'scroll' : 'class';
    };
    // The line sits where the sections close up, after the thirteen rows have held and
    // with the track's last quarter left for the merged state to hold.
    watchSentinels(track, [0.4], (index) => {
      pin.classList.toggle('is-merged', index >= 0);
    });
    pinned.addEventListener('change', drive);
    drive();
  }

  // The story's three beats start at these fractions of its pinned scroll; the first
  // while the dark band is still rising to the header, so the grid is drawn by the time
  // it pins. Each beat then holds for about a third of the track before the next.
  const STORY_BEATS = [-0.15, 0.34, 0.65];

  function enhanceStory(track) {
    const pin = track.querySelector('.story__pin');
    if (pin === null) return;
    track.querySelectorAll('.story__block[data-b]').forEach((block) => {
      indexVar(block, 'data-b', '--b');
    });
    if (scrollDriven()) return;
    pin.dataset.beat = '0';
    watchSentinels(track, STORY_BEATS, (index) => {
      pin.dataset.beat = String(index + 1);
    });
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

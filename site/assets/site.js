// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file. It runs in the head, before the stylesheet, so the classes that
// switch the motion on exist before the first layout and nothing shifts or flashes:
// .motion unless the reader prefers reduced motion, and .no-sda where the browser has no
// scroll driven animations, so the stylesheet plays each moment from the classes this
// file adds as blocks come into view. It also adds the merge toggle to the dedupe table,
// marks a Firefox visitor so the Firefox button is the filled one, and carries the
// section in the address across the language switch. It listens to no scroll event,
// sends nothing anywhere and stores nothing.

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
      const header =
        parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 0;
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
    window.addEventListener('resize', build);
  }

  // The stage pins only where the whole of it fits the window.
  const DEDUPE_PIN =
    '(max-width: 639px) and (min-height: 600px), (min-width: 640px) and (max-width: 1023px) and (min-height: 820px), (min-width: 1024px) and (min-height: 728px)';

  function enhanceDedupe(pin) {
    const track = pin.closest('.dedupe-track');
    const table = pin.querySelector('table');
    const controls = pin.querySelector('.dedupe-controls');
    const status = pin.querySelector('[data-dedupe-status]');
    const state = pin.querySelector('[data-dedupe-state]');
    if (
      track === null ||
      table === null ||
      controls === null ||
      status === null ||
      state === null
    ) {
      return;
    }
    const rows = [...table.querySelectorAll('tbody tr')];
    const repeats = rows.filter((row) => row.dataset.row === 'repeat');
    rows.forEach((row) => {
      indexVar(row, 'data-i', '--i');
      indexVar(row, 'data-slot', '--t');
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dedupe-toggle';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', table.id);
    const box = document.createElement('span');
    box.className = 'dedupe-toggle__box';
    box.setAttribute('aria-hidden', 'true');
    button.append(box, document.createTextNode(pin.dataset.label ?? ''));
    controls.append(button);

    const pinned = window.matchMedia(DEDUPE_PIN);
    const motion = () => root.classList.contains('motion');
    // Pressed by the reader since the stage last left the view.
    let manual = false;
    // Whether the reader has scrolled past the point where the merge happens.
    let past = false;

    const drive = () => {
      pin.dataset.drive =
        scrollDriven() && pinned.matches && !manual ? 'scroll' : 'class';
    };

    // The pressed state, the caption and the live status always name the state shown.
    // The caption keeps naming where the rows came from and adds the state, so the
    // table's name never states a row count the table no longer shows.
    const show = (merged) => {
      if (button.getAttribute('aria-pressed') === String(merged)) return;
      button.setAttribute('aria-pressed', String(merged));
      const text = (merged ? pin.dataset.merged : pin.dataset.unmerged) ?? '';
      state.textContent = ` ${text}`;
      status.textContent = text;
      pin.classList.toggle('is-merged', merged);
      foldRepeats();
    };

    const followScroll = () => motion() && pinned.matches && !manual;

    // Merged repeat rows leave the table. Without motion they are hidden outright; with
    // it they only fade and slide, so they also leave the accessibility tree, and a
    // screen reader finds the same four rows the caption names.
    function foldRepeats() {
      const merged = button.getAttribute('aria-pressed') === 'true';
      repeats.forEach((row) => {
        row.hidden = merged && !motion();
        if (merged && motion()) {
          row.setAttribute('aria-hidden', 'true');
        } else {
          row.removeAttribute('aria-hidden');
        }
      });
    }

    button.addEventListener('click', () => {
      manual = motion();
      drive();
      show(button.getAttribute('aria-pressed') !== 'true');
    });

    watchSentinels(track, [0.45], (index) => {
      past = index >= 0;
      if (followScroll()) show(past);
    });

    // Once the stage leaves the view, the scroll drives the merge again.
    new IntersectionObserver(([entry]) => {
      if (entry === undefined || entry.isIntersecting || !manual) return;
      manual = false;
      drive();
      if (followScroll()) show(past);
    }).observe(track);

    const reset = () => {
      manual = false;
      drive();
      foldRepeats();
    };
    pinned.addEventListener('change', reset);
    reduce.addEventListener('change', reset);
    drive();
  }

  // The story's three beats start at these fractions of its pinned scroll.
  const STORY_BEATS = [0, 0.38, 0.64];

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

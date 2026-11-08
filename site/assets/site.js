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

  function syncMotion() {
    root.classList.toggle('motion', !reduce.matches);
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
    if (scrollDriven() || !('IntersectionObserver' in window)) return;
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

  function enhanceDedupe(pin) {
    const table = pin.querySelector('table');
    const controls = pin.querySelector('.dedupe-controls');
    const status = pin.querySelector('[data-dedupe-status]');
    const state = pin.querySelector('[data-dedupe-state]');
    if (
      table === null ||
      controls === null ||
      status === null ||
      state === null
    ) {
      return;
    }
    const repeats = [...table.querySelectorAll('tr[data-row="repeat"]')];

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

    button.addEventListener('click', () => {
      const merged = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(merged));
      // The caption keeps naming where the rows came from and adds the state shown, so
      // the table's name never states a row count the table no longer shows.
      const text = (merged ? pin.dataset.merged : pin.dataset.unmerged) ?? '';
      state.textContent = ` ${text}`;
      status.textContent = text;
      pin.classList.toggle('is-merged', merged);
      repeats.forEach((row) => {
        row.hidden = merged;
      });
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
    document.querySelectorAll('[data-dedupe]').forEach(enhanceDedupe);
    keepSectionAcrossLanguages();
  });
})();

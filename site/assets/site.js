// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file: it only adds the merge toggle to the dedupe table and marks a
// Firefox visitor so the stylesheet can fill the Firefox button instead of Chrome's.
// It sends nothing anywhere and stores nothing.

if (navigator.userAgent.includes('Firefox/')) {
  document.documentElement.classList.add('is-firefox');
}

const FOLD_MS = 300;
const STAGGER_MS = 24;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function enhanceDedupe(wrap) {
  const table = wrap.querySelector('table');
  const status = wrap.querySelector('[data-dedupe-status]');
  if (table === null || status === null) return;
  const repeats = [...table.querySelectorAll('tr[data-row="repeat"]')];

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dedupe-toggle';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', table.id);
  const box = document.createElement('span');
  box.className = 'dedupe-toggle__box';
  box.setAttribute('aria-hidden', 'true');
  button.append(box, document.createTextNode(wrap.dataset.label ?? ''));
  wrap.insertBefore(button, table);

  let timer = 0;

  repeats.forEach((row, index) => {
    row.style.setProperty('--fold-delay', `${String(index * STAGGER_MS)}ms`);
  });

  function settle(merged) {
    window.clearTimeout(timer);
    const wait = reducedMotion() ? 0 : FOLD_MS + STAGGER_MS * repeats.length;
    timer = window.setTimeout(() => {
      if (merged) {
        repeats.forEach((row) => {
          row.hidden = true;
        });
        wrap.classList.add('is-merged');
      } else {
        wrap.classList.remove('is-unfolding');
      }
    }, wait);
  }

  button.addEventListener('click', () => {
    const merged = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(merged));
    if (merged) {
      wrap.classList.add('is-folding');
      status.textContent = wrap.dataset.merged ?? '';
    } else {
      wrap.classList.remove('is-merged');
      wrap.classList.add('is-unfolding');
      repeats.forEach((row) => {
        row.hidden = false;
      });
      // Read layout once so the rows return at zero height before they unfold.
      void table.offsetHeight;
      wrap.classList.remove('is-folding');
      status.textContent = wrap.dataset.unmerged ?? '';
    }
    settle(merged);
  });
}

document.querySelectorAll('[data-dedupe]').forEach(enhanceDedupe);

// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file: it only adds the merge toggle to the dedupe table, marks a Firefox
// visitor so the stylesheet can fill the Firefox button instead of Chrome's, and carries
// the section in the address across the language switch.
// It sends nothing anywhere and stores nothing.

if (navigator.userAgent.includes('Firefox/')) {
  document.documentElement.classList.add('is-firefox');
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
    state.textContent = ` ${(merged ? pin.dataset.merged : pin.dataset.unmerged) ?? ''}`;
    status.textContent =
      (merged ? pin.dataset.merged : pin.dataset.unmerged) ?? '';
    pin.classList.toggle('is-merged', merged);
    repeats.forEach((row) => {
      row.hidden = merged;
    });
  });
}

document.querySelectorAll('[data-dedupe]').forEach(enhanceDedupe);

// Both language pages share their section ids, so switching language keeps the reader
// at the section the address names instead of returning them to the top.
const SHARED_SECTIONS = new Set(['features', 'privacy', 'faq', 'download']);

document.querySelectorAll('a[lang][hreflang]').forEach((link) => {
  link.addEventListener('click', () => {
    const id = window.location.hash.slice(1);
    if (SHARED_SECTIONS.has(id)) {
      link.hash = id;
    }
  });
});

// The one module that reads the host's pre registration page (ADR-0077). It finds the
// add card, the list table, the result table, the stepper, the term column of the panel
// header, the open dialog and the toasts by the structure and the fixed labels of the
// host's render functions, never by colour alone, and projects only the allowlisted
// course facts. It reads text, classes, and the subject id field's value; it writes
// nothing, dispatches nothing, and calls no host code. The student id and name columns
// of the header are never read. A toast's text is classified and dropped in the same
// function, and a number that is not a planned subject id is not kept. A structure that
// does not read as the contract says is a drift, and the whole reading is dropped.

import {
  CREDIT_RANGE,
  CREDIT_TOTAL,
  HOST_LABELS,
  LIST_HEADER_CLASSES,
  SCRIPT_NAME,
  SECTION_LABEL,
  TERM_TEXT,
  isLabel,
  rowColour,
} from '@/lib/regis/hostContract';
import {
  hostObservationSchema,
  type HostObservation,
} from '@/lib/regis/hostObservation';

export type PageReading =
  | { reading: 'ok'; observation: HostObservation }
  | { reading: 'absent' | 'drift' };

const DRIFT = new Error('host page drift');

function drift(): never {
  throw DRIFT;
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function text(node: Element | null | undefined): string {
  return clean(node?.textContent);
}

/** The element's own text nodes, without the text of its child elements. */
export function ownText(element: Element): string {
  let value = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) value += node.textContent ?? '';
  }
  return clean(value);
}

export function cellsOf(row: Element): Element[] {
  return [...row.children].filter((cell) => cell.tagName === 'TD');
}

function cell(row: Element, index: number): Element {
  return cellsOf(row)[index] ?? drift();
}

/** A card headed by a host heading with the early span beside it. */
export function cardsHeaded(
  doc: Document,
  heading: readonly string[],
): Element[] {
  return [...doc.querySelectorAll('.v-card h2')]
    .filter(
      (h2) =>
        isLabel(ownText(h2), heading) &&
        isLabel(
          text(h2.querySelector('span.deep-orange--text')),
          HOST_LABELS.early,
        ),
    )
    .map((h2) => h2.closest('.v-card') ?? drift());
}

function kindOf(scope: Element): 'lecture' | 'practice' | null {
  const chip = scope.querySelector('.v-chip');
  if (chip === null) return null;
  const label = text(chip);
  if (
    chip.classList.contains('light-blue') &&
    isLabel(label, HOST_LABELS.lectureChip)
  ) {
    return 'lecture';
  }
  if (
    chip.classList.contains('brown') &&
    isLabel(label, HOST_LABELS.practiceChip)
  ) {
    return 'practice';
  }
  return drift();
}

function sectionLabel(value: string): {
  section: string;
  curriculum: string | null;
} {
  const match = SECTION_LABEL.exec(value) ?? drift();
  return { section: match[1] ?? drift(), curriculum: match[2] ?? null };
}

function subjectIdOf(value: string): string {
  return /^\d{8}$/.test(value) ? value : drift();
}

/** The first table of a card, checked against the host's header classes. */
function tableOf(card: Element, checkHeader: boolean): Element[] {
  const table = card.querySelector('.v-data-table table') ?? drift();
  const heads = [...table.querySelectorAll('thead th')];
  if (heads.length !== LIST_HEADER_CLASSES.length) drift();
  if (checkHeader) {
    LIST_HEADER_CLASSES.forEach((name, index) => {
      if (name !== null && heads[index]?.classList.contains(name) !== true)
        drift();
    });
  }
  return [...table.querySelectorAll(':scope > tbody > tr')];
}

/** The section shown in a select or as the locked practice text, or null. */
function selection(
  scope: Element,
): { section: string; curriculum: string | null } | null {
  const select = scope.querySelector('.v-select');
  const shown =
    select === null
      ? ownText(scope.firstElementChild ?? scope)
      : text(select.querySelector('.v-select__selection'));
  return shown === '' ? null : sectionLabel(shown);
}

/** The newest toast's kind about a subject id, read before the text is dropped. */
type ToastKind = HostObservation['toasts'][number]['kind'];

function classifyToast(value: string): {
  kind: ToastKind;
  subjectId: string | null;
} {
  for (const prefix of HOST_LABELS.toastPrefix) {
    if (!value.startsWith(prefix)) continue;
    const match = /^(\d{8}): (.*)$/.exec(value.slice(prefix.length));
    const message = match?.[2] ?? '';
    const kind: ToastKind = isLabel(message, HOST_LABELS.alreadyListed)
      ? 'alreadyListed'
      : isLabel(message, HOST_LABELS.clash)
        ? 'clash'
        : 'refused';
    return { kind, subjectId: match?.[1] ?? null };
  }
  return {
    kind: isLabel(value, HOST_LABELS.submitted) ? 'submitted' : 'other',
    subjectId: null,
  };
}

function readToasts(doc: Document) {
  return [...doc.querySelectorAll('.toasted-container .toasted')].map((toast) =>
    classifyToast(text(toast)),
  );
}

/** The add card's table rows split at the space row, or null when it has none. */
export function addRowsOf(card: Element): {
  rows: Element[];
  space: number;
  add: Element | undefined;
  practice: Element | undefined;
} | null {
  const rows = tableOf(card, true);
  const space = rows.findIndex((row) =>
    row.classList.contains('table-space-tr'),
  );
  if (space < 0) return null;
  return { rows, space, add: rows[space + 1], practice: rows[space + 2] };
}

/** A seat cell: the host prints a dash for an unset limit. */
function seatValue(value: string, dash: boolean): number | null {
  if (dash && value === '-') return null;
  return /^\d{1,4}$/.test(value) ? Number(value) : drift();
}

function readCard(
  card: Element,
  toasts: readonly { kind: ToastKind; subjectId: string | null }[],
  planned: ReadonlySet<string>,
) {
  const { rows, space } = addRowsOf(card) ?? drift();
  const list = rows.slice(0, space).flatMap((row) => {
    const cells = cellsOf(row);
    if (cells.length === 1 && cells[0]?.getAttribute('colspan') === '8')
      return [];
    if (cells.length !== 8) drift();
    return [
      {
        subjectId: subjectIdOf(text(cell(row, 1))),
        kind: kindOf(cell(row, 3)),
        ...sectionLabel(text(cell(row, 4))),
      },
    ];
  });
  const add = rows[space + 1] ?? drift();
  const practiceRow = rows[space + 2];
  if (rows.length > space + 3 || cellsOf(add).length !== 8) drift();
  if (
    practiceRow !== undefined &&
    !isLabel(text(cell(practiceRow, 1)), HOST_LABELS.practiceRow)
  ) {
    drift();
  }
  const colour =
    add instanceof HTMLElement
      ? rowColour(add.style.backgroundColor)
      : undefined;
  const input = cell(add, 1).querySelector('.v-text-field input');
  if (!(input instanceof HTMLInputElement) || colour === undefined) drift();
  const value = input.value.trim();
  const loading =
    card.classList.contains('v-card--disabled') ||
    card.querySelector('.v-card__progress') !== null;
  const offered = cell(add, 4).querySelector('.v-select') !== null;
  const told = [...toasts]
    .reverse()
    .find((toast) => toast.subjectId === value)?.kind;
  const status = loading
    ? 'searching'
    : offered
      ? 'offered'
      : value === ''
        ? 'empty'
        : value.length < 8
          ? 'typing'
          : told === 'alreadyListed' || told === 'refused'
            ? told
            : 'entered';
  const primary = offered ? selection(cell(add, 4)) : null;
  return {
    list,
    card: {
      status,
      subjectId: planned.has(value) ? value : null,
      colour,
      primary,
      practice:
        practiceRow === undefined ? null : selection(cell(practiceRow, 4)),
      practiceSelect:
        practiceRow !== undefined &&
        cell(practiceRow, 4).querySelector('.v-select') !== null,
      seats:
        primary === null
          ? null
          : {
              limit: seatValue(text(cell(add, 6)), true),
              count: seatValue(text(cell(add, 7)), false) ?? 0,
            },
    },
    credits: readCredits(card),
  };
}

function creditValue(raw: string | undefined): number | null {
  return raw === undefined || !/^\d+$/.test(raw) ? null : Number(raw);
}

function readCredits(card: Element) {
  const lines = [...card.querySelectorAll('h3')].map(ownText);
  const line = (labels: readonly string[], grammar: RegExp) => {
    for (const label of labels) {
      const found = lines.find((value) => value.startsWith(label));
      if (found !== undefined) {
        return grammar.exec(found.slice(label.length).trim()) ?? drift();
      }
    }
    return drift();
  };
  const range = line(HOST_LABELS.creditRange, CREDIT_RANGE);
  const total = line(HOST_LABELS.creditTotal, CREDIT_TOTAL);
  return {
    total: creditValue(total[1]),
    min: creditValue(range[1]),
    max: creditValue(range[2]),
  };
}

function readResults(card: Element) {
  if (card.classList.contains('v-card--disabled')) return null;
  let subjectId: string | null = null;
  return tableOf(card, false).map((row) => {
    const own = text(cell(row, 0));
    subjectId = own === '' ? (subjectId ?? drift()) : subjectIdOf(own);
    const status = cell(row, 7).querySelector('span');
    const result =
      status === null
        ? drift()
        : status.classList.contains('green--text')
          ? 'granted'
          : status.classList.contains('red--text')
            ? isLabel(text(status), HOST_LABELS.violateCondition)
              ? 'notGrantedCondition'
              : 'notGranted'
            : 'waiting';
    return {
      subjectId,
      kind: kindOf(cell(row, 3)),
      ...sectionLabel(ownText(cell(row, 3))),
      result,
    };
  });
}

function readStep(doc: Document): 1 | 2 | 3 | null {
  const stepper = doc.querySelector('.v-stepper');
  if (stepper === null) return null;
  const steps = [...stepper.querySelectorAll('.v-stepper__step')];
  const labels = steps.map((step) =>
    text(step.querySelector('.v-stepper__label')),
  );
  if (
    !HOST_LABELS.steps.some((set) =>
      set.every((label, index) => labels[index] === label),
    )
  ) {
    drift();
  }
  if (steps.length !== 3) drift();
  const active = steps.findIndex((step) =>
    step.classList.contains('v-stepper__step--active'),
  );
  return active === 0 ? 1 : active === 1 ? 2 : active === 2 ? 3 : null;
}

/** The panel header row that carries the term in its third column. */
function headerRow(doc: Document): Element | null {
  return (
    [...doc.querySelectorAll('.row.grey.lighten-2')].find(
      (row) =>
        row.children.length === 3 &&
        HOST_LABELS.term.some((label) =>
          text(row.children.item(2)).startsWith(label),
        ),
    ) ?? null
  );
}

function readTerm(doc: Document) {
  // Only the third column: the first two hold the student id and name.
  const column = headerRow(doc)?.children.item(2);
  if (column === undefined || column === null) return null;
  const match = TERM_TEXT.exec(text(column)) ?? drift();
  const semester = match[1];
  if (semester !== '1' && semester !== '2' && semester !== '3') return drift();
  return { year: match[2] ?? drift(), semester };
}

function readDialog(doc: Document) {
  const open = [
    ...doc.querySelectorAll('.v-dialog__content--active .v-dialog--active'),
  ];
  const kinds = open.map((dialog) => {
    const title = text(dialog.querySelector('.v-card__title'));
    if (isLabel(title, HOST_LABELS.gradeDialog)) {
      return {
        kind: 'gradeNotAnnounced' as const,
        prerequisites: [...dialog.querySelectorAll('.v-card__text span.mr-3')]
          .map((span) => text(span))
          .filter((value) => /^\d{8}$/.test(value)),
      };
    }
    const kind = isLabel(title, HOST_LABELS.confirmDialog)
      ? ('confirmSubmit' as const)
      : HOST_LABELS.timeSlotDialog.some((label) => title.startsWith(label))
        ? ('timeSlot' as const)
        : ('other' as const);
    return { kind, prerequisites: [] };
  });
  return (
    kinds.find((dialog) => dialog.kind === 'confirmSubmit') ??
    kinds.find((dialog) => dialog.kind === 'gradeNotAnnounced') ??
    kinds[0] ??
    null
  );
}

function readPage(doc: Document, planned: ReadonlySet<string>): PageReading {
  const step = readStep(doc);
  const addCards = cardsHeaded(doc, HOST_LABELS.addHeading);
  const resultCards = cardsHeaded(doc, HOST_LABELS.resultHeading);
  if (step === null && addCards.length === 0 && resultCards.length === 0) {
    return { reading: 'absent' };
  }
  if (addCards.length > 1 || resultCards.length > 1) drift();
  const addCard = addCards[0];
  const resultCard = resultCards[0];
  if ((step === 2) !== (addCard !== undefined)) drift();
  if ((step === 3) !== (resultCard !== undefined)) drift();
  const allToasts = readToasts(doc);
  const added =
    addCard === undefined ? null : readCard(addCard, allToasts, planned);
  const parsed = hostObservationSchema.safeParse({
    step,
    term: readTerm(doc),
    card: added?.card ?? null,
    list: added?.list ?? null,
    credits: added?.credits ?? null,
    dialog: readDialog(doc),
    toasts: allToasts.map((toast) => ({
      kind: toast.kind,
      subjectId:
        toast.subjectId !== null && planned.has(toast.subjectId)
          ? toast.subjectId
          : null,
    })),
    results: resultCard === undefined ? null : readResults(resultCard),
  });
  return parsed.success
    ? { reading: 'ok', observation: parsed.data }
    : { reading: 'drift' };
}

/**
 * Read the page once. The planned subject ids bound which numbers may be kept. Any
 * failure is a drift, not only the ones the reader names: an error thrown out of here
 * would leave the observer's last healthy reading in place and end a fill run without a
 * stop, so a page KCP cannot read degrades instead.
 */
export function readHostPage(
  doc: Document,
  planned: ReadonlySet<string>,
): PageReading {
  try {
    return readPage(doc, planned);
  } catch {
    return { reading: 'drift' };
  }
}

/** The host script names of the two kinds the build gate compares, from their src. */
export function readScriptNames(doc: Document): string[] {
  return [...doc.scripts].flatMap((script) => {
    const name =
      (script.getAttribute('src') ?? '').split(/[?#]/)[0]?.split('/').pop() ??
      '';
    return SCRIPT_NAME.test(name) ? [name] : [];
  });
}

const SUBTREE: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'disabled'],
};

/**
 * The roots the observer watches: the registration panel, or the app root until the
 * panel shows; the app root's direct children, where the host attaches its dialogs; each
 * dialog's own class, which says whether it is open; and the toast container.
 */
export function observedRoots(doc: Document): [Node, MutationObserverInit][] {
  const app = doc.querySelector('[data-app]') ?? doc.body;
  const panel = headerRow(doc)?.parentElement ?? null;
  const roots: [Node, MutationObserverInit][] = [
    [panel ?? app, SUBTREE],
    [doc.body, { childList: true }],
  ];
  if (panel !== null) roots.push([app, { childList: true }]);
  for (const dialog of doc.querySelectorAll('.v-dialog__content')) {
    roots.push([dialog, { attributes: true, attributeFilter: ['class'] }]);
  }
  const toasts = doc.querySelector('.toasted-container');
  if (toasts !== null) roots.push([toasts, { childList: true }]);
  return roots;
}

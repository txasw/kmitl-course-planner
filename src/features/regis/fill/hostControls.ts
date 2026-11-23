// The allowlist of host controls a fill may act on (ADR-0078), and the only module that
// returns a host element for action. It resolves five kinds and nothing else: the subject
// id field, the section select's activator (the primary or the practice select), an
// option in the listbox that activator names, the local add button, and the single
// acknowledgement button of the grade not announced dialog. Each is found by structure
// from the one add card and by its own label, fresh at the step that uses it, and comes
// back as a handle only this module can make; anything that does not read as the tested
// build does resolves to null. There is no way here to find any other button.

import { HOST_LABELS, SECTION_LABEL, isLabel } from '@/lib/regis/hostContract';
import { addRowsOf, cardsHeaded, cellsOf, text } from '../host/hostDom';
import { insideForbidden, isDeniedLabel } from './denylist';

export type ControlKind =
  'field' | 'activator' | 'option' | 'add' | 'acknowledge';

class Control<K extends ControlKind> {
  readonly #brand = true;
  constructor(
    readonly kind: K,
    readonly element: HTMLElement,
    /** The add card the control was resolved from, for the actuator's card check. */
    readonly card: Element,
    /** The one menu or dialog this control may sit in. */
    readonly allowed: readonly Element[],
  ) {}
  get brand(): boolean {
    return this.#brand;
  }
}

/** A host control a fill may act on, of one kind. */
export type HostControl<K extends ControlKind = ControlKind> = Control<K>;

export interface SectionOption {
  control: HostControl<'option'>;
  section: string;
  curriculum: string | null;
}

function attempt<T>(read: () => T | null): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** The one add card on the page, or null when there is none or more than one. */
export function addCard(doc: Document): Element | null {
  const cards = cardsHeaded(doc, HOST_LABELS.addHeading);
  return cards.length === 1 ? (cards[0] ?? null) : null;
}

function make<K extends ControlKind>(
  kind: K,
  element: Element | null | undefined,
  card: Element,
  allowed: readonly Element[] = [],
): HostControl<K> | null {
  if (!(element instanceof HTMLElement)) return null;
  if (insideForbidden(element, allowed) || isDeniedLabel(text(element))) {
    return null;
  }
  return new Control(kind, element, card, allowed);
}

export function resolveField(doc: Document): HostControl<'field'> | null {
  return attempt(() => {
    const card = addCard(doc);
    const add = card === null ? undefined : addRowsOf(card)?.add;
    if (card === null || add === undefined) return null;
    const input = cellsOf(add)[1]?.querySelector('.v-text-field input');
    return input instanceof HTMLInputElement
      ? make('field', input, card)
      : null;
  });
}

export function resolveActivator(
  doc: Document,
  which: 'primary' | 'practice',
): HostControl<'activator'> | null {
  return attempt(() => {
    const card = addCard(doc);
    const rows = card === null ? null : addRowsOf(card);
    const row = which === 'primary' ? rows?.add : rows?.practice;
    if (card === null || row === undefined) return null;
    const slot = cellsOf(row)[4]?.querySelector(
      '.v-select .v-input__slot[role="button"][aria-owns]',
    );
    return make('activator', slot, card);
  });
}

/** The options of the listbox an activator names, or null when it is not open. */
export function resolveOptions(
  doc: Document,
  activator: HostControl<'activator'>,
): SectionOption[] | null {
  return attempt(() => {
    const owns = activator.element.getAttribute('aria-owns') ?? '';
    const listbox = doc.getElementById(owns);
    const menu = listbox?.parentElement;
    if (
      listbox?.matches('.v-select-list[role="listbox"]') !== true ||
      menu?.matches('.v-menu__content.menuable__content__active') !== true ||
      menu.parentElement?.hasAttribute('data-app') !== true
    ) {
      return null;
    }
    const options: SectionOption[] = [];
    for (const element of listbox.querySelectorAll(
      ':scope > [role="option"]',
    )) {
      const match = SECTION_LABEL.exec(text(element));
      const control = make('option', element, activator.card, [menu]);
      if (match?.[1] === undefined || control === null) return null;
      options.push({
        control,
        section: match[1],
        curriculum: match[2] ?? null,
      });
    }
    return options;
  });
}

/**
 * The local add button: the first button of the block right after the add table, green
 * and labelled Add, with the deep orange continue button after that block, so a swapped
 * or relabelled order resolves nothing.
 */
export function resolveAdd(doc: Document): HostControl<'add'> | null {
  return attempt(() => {
    const card = addCard(doc);
    const block = card?.querySelector('.v-data-table')?.nextElementSibling;
    const button = block?.firstElementChild;
    if (
      card === null ||
      block?.matches('div.mt-2') !== true ||
      block.nextElementSibling?.matches('button.v-btn.deep-orange') !== true ||
      button?.matches('button.v-btn.green') !== true ||
      !isLabel(text(button), HOST_LABELS.addButton)
    ) {
      return null;
    }
    return make('add', button, card);
  });
}

/**
 * The acknowledgement button of the grade not announced dialog: the only open dialog,
 * with the grade title, one button, primary coloured and labelled Acknowledged.
 */
export function resolveAcknowledge(
  doc: Document,
): HostControl<'acknowledge'> | null {
  return attempt(() => {
    const card = addCard(doc);
    const open = [
      ...doc.querySelectorAll('.v-dialog__content--active .v-dialog--active'),
    ];
    const dialog = open.length === 1 ? open[0] : undefined;
    const content = dialog?.parentElement;
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    const button = buttons.length === 1 ? buttons[0] : undefined;
    if (
      card === null ||
      dialog === undefined ||
      content?.matches('.v-dialog__content') !== true ||
      !isLabel(
        text(dialog.querySelector('.v-card__title')),
        HOST_LABELS.gradeDialog,
      ) ||
      button?.closest('.v-card__actions') === null ||
      button?.matches('.primary') !== true ||
      !isLabel(text(button), HOST_LABELS.acknowledge)
    ) {
      return null;
    }
    return make('acknowledge', button, card, [dialog, content]);
  });
}

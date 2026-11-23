// The one module in KCP that acts on a host control (ADR-0078). It takes only the handles
// the allowlist makes and does what a student's hands would: it writes the planned
// subject id into the field and dispatches one input event, or clicks an activator, an
// option, the add button, or the grade dialog's acknowledgement. It never sends a
// keyboard event and never moves focus. Immediately before each event, in the same task,
// it checks the card and the target again. A denied label or a forbidden container is a
// refusal, which ends the run and latches fill off for the build; a card that is busy, a
// control that went stale or disabled, focus inside the card, or an unexpected dialog is
// stale, which ends the run without a latch so the student can continue.

import { HOST_LABELS, SECTION_LABEL, isLabel } from '@/lib/regis/hostContract';
import type { PlannedSubjectId } from '@/lib/regis/plannedId';
import { text } from '../host/hostDom';
import { insideForbidden, isDeniedLabel } from './denylist';
import type { ControlKind, HostControl } from './hostControls';

export type Actuation = 'done' | 'refused' | 'stale';

function labelHolds(control: HostControl): boolean {
  const label = text(control.element);
  switch (control.kind) {
    case 'field':
      return control.element instanceof HTMLInputElement;
    case 'activator':
      return true;
    case 'option':
      return SECTION_LABEL.test(label);
    case 'add':
      return isLabel(label, HOST_LABELS.addButton);
    case 'acknowledge':
      return isLabel(label, HOST_LABELS.acknowledge);
  }
}

function refused(control: HostControl, kind: ControlKind): boolean {
  return (
    control.kind !== kind ||
    isDeniedLabel(text(control.element)) ||
    insideForbidden(control.element, control.allowed) ||
    !labelHolds(control)
  );
}

function stale(control: HostControl): boolean {
  const { element, card } = control;
  const doc = element.ownerDocument;
  const dialogs = [...doc.querySelectorAll('.v-dialog__content--active')];
  const dialogOk =
    control.kind === 'acknowledge'
      ? dialogs.length === 1 &&
        control.allowed.some((node) => node === dialogs[0])
      : dialogs.length === 0;
  const focus = doc.activeElement;
  return (
    !element.isConnected ||
    !card.isConnected ||
    control.allowed.some((node) => !node.contains(element)) ||
    card.classList.contains('v-card--disabled') ||
    card.querySelector('.v-card__progress') !== null ||
    element.closest('[disabled], [aria-disabled="true"]') !== null ||
    (focus !== null && card.contains(focus)) ||
    !dialogOk
  );
}

function act(
  control: HostControl,
  kind: ControlKind,
  event: () => Event,
): Actuation {
  if (refused(control, kind)) return 'refused';
  if (stale(control)) return 'stale';
  control.element.dispatchEvent(event());
  return 'done';
}

const click = () =>
  new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });

/** Write the planned id into the field and let the host search, as a paste would. */
export function enterSubjectId(
  control: HostControl<'field'>,
  id: PlannedSubjectId,
): Actuation {
  const { element } = control;
  if (!(element instanceof HTMLInputElement) || element.value !== '') {
    return 'stale';
  }
  return act(control, 'field', () => {
    element.value = id.value;
    return new Event('input', { bubbles: true });
  });
}

export function openMenu(control: HostControl<'activator'>): Actuation {
  return act(control, 'activator', click);
}

export function chooseOption(control: HostControl<'option'>): Actuation {
  return act(control, 'option', click);
}

export function pressAdd(control: HostControl<'add'>): Actuation {
  return act(control, 'add', click);
}

/** Close the grade not announced dialog, only after KCP showed its condition (5B). */
export function pressAcknowledge(
  control: HostControl<'acknowledge'>,
): Actuation {
  return act(control, 'acknowledge', click);
}

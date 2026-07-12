// A binary on and off switch for an instant effect toggle. It is a real button
// with role switch, so Space and Enter both fire it natively. The track fills with
// the brand strong when on and outlines with a dark border when off, and each state
// carries a distinct thumb position and thumb color, so the state never rests on
// color alone. The thumb slides with a reduced motion fallback.
//
// Use it only for a binary toggle. A set membership control, such as the catalog day
// filter, is not a switch and keeps its aria-pressed buttons.
//
// Contrast rests on already proven token pairs: white thumb on the primary-strong
// track and the primary-strong track on the surface for the on state, and the ink
// soft border and ink soft thumb on the surface for the off state, all asserted by
// the token contrast suite.

import { FOCUS_RING } from '@/lib/ui/focus';

interface SwitchProps {
  checked: boolean;
  /** The visible label and the control's accessible name. */
  label: string;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-kcp px-2 py-1 text-sm text-ink hover:bg-surface-alt ${FOCUS_RING}`}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border px-[3px] transition-colors motion-reduce:transition-none ${
          checked
            ? 'border-primary-strong bg-primary-strong'
            : 'border-ink-soft bg-surface'
        }`}
      >
        <span
          className={`size-3.5 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none ${
            checked ? 'translate-x-4 bg-surface' : 'translate-x-0 bg-ink-soft'
          }`}
        />
      </span>
    </button>
  );
}

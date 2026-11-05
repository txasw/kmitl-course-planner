// The form control boundary, recorded in ADR-0051. A text field, a combobox, and the
// catalog filter field draw their boundary with the border-strong token, which clears
// the 3:1 non text bar on both panel surfaces, and shift it to ink soft on hover. The
// quieter border token stays for dividers and cards. A disabled control is exempt from
// the boundary bar, so it reads as not applicable through the muted surface with the
// quiet border and ink soft text rather than through opacity, which would also fade its
// value text below AA.

export const CONTROL_BOUNDARY =
  'border-border-strong bg-surface hover:border-ink-soft';

export const CONTROL_DISABLED = 'border-border bg-surface-alt text-ink-soft';

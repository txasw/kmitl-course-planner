// How each helper status looks (owner answer 2C): a tone band, an icon, and a word. The
// icons differ in silhouette, so a chip that carries only its icon still reads in grey, and
// the band and the list cell pair the icon with its word, so no status rests on colour.

import {
  Ban,
  Circle,
  CircleCheck,
  ClipboardCheck,
  GitBranch,
  LoaderCircle,
  OctagonX,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/t';
import type { HelperStatus, StatusTone } from '@/lib/regis/helperStatus';

/** The icon of each status. */
export const STATUS_ICON: Readonly<Record<HelperStatus, LucideIcon>> = {
  todo: Circle,
  adding: LoaderCircle,
  added: CircleCheck,
  other: GitBranch,
  cond: ShieldAlert,
  full: Ban,
  refused: OctagonX,
  clash: TriangleAlert,
  sent: ClipboardCheck,
};

/** The band word of a status, which the card, the names, and the announcements use. */
export function bandKey(status: HelperStatus): TranslationKey {
  return `regis.status.${status}`;
}

/** The short word of a status, under its icon in a list row. */
export function shortKey(status: HelperStatus): TranslationKey {
  return `regis.short.${status}`;
}

/** The icon colour of a tone on a white or grey ground. */
export const TONE_ICON: Readonly<Record<StatusTone, string>> = {
  neutral: 'text-ink-soft',
  busy: 'text-ink-soft',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

/** The band and list cell ground, text, and top rule of a tone. */
export const TONE_FILL: Readonly<Record<StatusTone, string>> = {
  neutral: 'bg-surface-alt text-ink border-border',
  busy: 'bg-surface-alt text-ink border-border',
  success: 'bg-success-soft text-success border-current/20',
  warn: 'bg-warn-soft text-warn border-current/20',
  danger: 'bg-danger-soft text-danger border-current/20',
};

/** The fill of a status shown while the page cannot be read: the last word, quietly. */
export const STALE_FILL = 'bg-surface text-ink-soft border-border';

/** The spin of the loader icon, which stands still as an open arc under reduced motion. */
export const SPIN = 'motion-safe:animate-spin';

// The verification badge a placed block or a shelf row carries. A missing section or
// one a time change put into conflict reads danger with a hatched fill; a section whose
// data changed, or whose exam overlaps another entry, reads warn. A block can carry more
// than one state at once, so the tone folds to the strongest, danger over warn, while the
// labels list every state that applies so none is lost to a screen reader. A verified,
// unverified, or clean section carries no badge.

import type { VerifyStatus } from '@/lib/domain/plan';
import type { TranslationKey } from '@/lib/i18n/t';

export type BlockBadge = 'warn' | 'danger';

/** The badge tone that drives the block fill: danger for a missing or conflicting
 * section, warn for a changed or exam overlapping one, null when clean. */
export function blockBadge(
  verifyStatus: VerifyStatus,
  conflicted: boolean,
  examWarned = false,
): BlockBadge | null {
  if (verifyStatus === 'missing' || conflicted) {
    return 'danger';
  }
  if (verifyStatus === 'changed' || examWarned) {
    return 'warn';
  }
  return null;
}

/** The screen reader labels for a block's badges, in precedence order, so a block that
 * carries more than one state announces each and an exam overlap reads distinct from a
 * revalidation change. Empty when the section is clean. */
export function blockBadgeLabelKeys(
  verifyStatus: VerifyStatus,
  conflicted: boolean,
  examWarned = false,
): TranslationKey[] {
  const keys: TranslationKey[] = [];
  if (verifyStatus === 'missing') {
    keys.push('verify.missing');
  }
  if (conflicted) {
    keys.push('verify.conflict');
  }
  if (verifyStatus === 'changed') {
    keys.push('verify.changed');
  }
  if (examWarned) {
    keys.push('verify.examOverlap');
  }
  return keys;
}

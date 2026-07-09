// The verification badge a placed block or a shelf row carries. A missing section or
// one a time change put into conflict reads danger with a hatched fill; a section
// whose data changed reads warn until the change is acknowledged. A verified,
// unverified, or clean section carries no badge.

import type { VerifyStatus } from '@/lib/domain/plan';
import type { TranslationKey } from '@/lib/i18n/t';

export type BlockBadge = 'warn' | 'danger';

export function blockBadge(
  verifyStatus: VerifyStatus,
  conflicted: boolean,
): BlockBadge | null {
  if (verifyStatus === 'missing' || conflicted) {
    return 'danger';
  }
  if (verifyStatus === 'changed') {
    return 'warn';
  }
  return null;
}

/** The screen reader label for a block's badge, so its state is not colour only. */
export function blockBadgeLabelKey(
  verifyStatus: VerifyStatus,
  conflicted: boolean,
): TranslationKey | null {
  if (verifyStatus === 'missing') {
    return 'verify.missing';
  }
  if (conflicted) {
    return 'verify.conflict';
  }
  if (verifyStatus === 'changed') {
    return 'verify.changed';
  }
  return null;
}

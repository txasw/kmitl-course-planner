// Count labels with the English singular. Thai has no plural form, so both of its
// keys read the same, while English needs "1 course" rather than "1 courses".
import type { Translate } from './t';
import { fillTemplate } from './template';

export function courseCountLabel(t: Translate, n: number): string {
  return n === 1
    ? t('catalog.group.countOne')
    : fillTemplate(t('catalog.group.count'), { n });
}

export function sectionCountLabel(t: Translate, n: number): string {
  return n === 1
    ? t('catalog.card.sectionCountOne')
    : fillTemplate(t('catalog.card.sectionCount'), { n });
}

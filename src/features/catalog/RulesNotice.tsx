// The enrollment conditions of a section, such as a faculty, a curriculum, or a student
// id range it is limited to. They decide whether a student can register at all, so they
// read in the warn tone with a shield icon and the conditions label, one rule per line,
// resting as the first rule on one line with a control that shows them all. The rules
// are sanitized plain text whose angle bracket qualifiers, for example <สองปริญญา>, stay
// as written because they tell the eligible programs apart. The locale primary list falls
// back to the other language when it is empty, with lang set to the list shown.

import { ShieldAlert } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { conditionLines } from '@/lib/catalog/conditions';
import { CollapsibleLines } from './CollapsibleLines';

interface RulesNoticeProps {
  rulesTh: string;
  rulesEn: string;
  locale: Locale;
  t: Translate;
}

export function RulesNotice({ rulesTh, rulesEn, locale, t }: RulesNoticeProps) {
  const rules = conditionLines(rulesTh, rulesEn, locale);
  return (
    <CollapsibleLines
      icon={<ShieldAlert size={12} aria-hidden className="shrink-0" />}
      label={t('section.rules.label')}
      lines={rules.value}
      lang={rules.lang}
      toneClass="text-warn"
      expandLabel={fillTemplate(t('section.rules.showAll'), {
        count: rules.value.length,
      })}
      collapseLabel={t('section.rules.hide')}
    />
  );
}

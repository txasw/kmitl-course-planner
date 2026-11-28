// The shortcut help, opened by the question mark from anywhere in the panel. It lists the
// panel shortcuts with their keys and says that none of them fire while the student
// types in a field. It is a narrow centred dialog from 640 px and a bottom sheet below,
// like the welcome, so it reuses their focus trap, Escape layer and safe area padding:
// Escape closes the help only and focus returns to the control that held it before the
// question mark. A back gesture closes the help only too, through a history entry it holds
// above the overlay's, recorded in ADR-0067. The keys show as the labels printed on the
// keycaps, which read the same under either panel language, so they are data here rather
// than dictionary entries. The Escape row's words come from the panel chrome, since what
// Escape leaves depends on the root that mounts the panel.

import { BottomSheet } from '@/components/BottomSheet';
import { ModalDialog } from '@/components/ModalDialog';
import type { TranslationKey } from '@/lib/i18n/t';
import { useShellChrome } from './ShellChromeContext';
import { useBackToClose } from './useBackToClose';
import { useLayoutTier } from './useLayoutTier';
import { useTranslation } from './useTranslation';

/** One key chord as the keycaps pressed together. */
type Chord = readonly string[];

interface ShortcutRow {
  /** The chords that run the shortcut; more than one reads as alternatives. */
  chords: readonly Chord[];
  label: TranslationKey;
}

const ROWS: readonly ShortcutRow[] = [
  { chords: [['/']], label: 'shortcuts.filter' },
  {
    chords: [
      ['Ctrl', 'Z'],
      ['Cmd', 'Z'],
    ],
    label: 'shortcuts.undo',
  },
  { chords: [['?']], label: 'shortcuts.help' },
];

const ESCAPE_CHORDS: readonly Chord[] = [['Esc']];

const KEYCAP =
  'inline-flex min-w-6 items-center justify-center rounded-kcp border border-border bg-surface-alt px-1.5 py-0.5 font-sans text-xs text-ink';

interface ShortcutHelpProps {
  onClose: () => void;
}

export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const { escapeLine } = useShellChrome();
  useBackToClose(true, onClose);
  const rows: readonly ShortcutRow[] = [
    ...ROWS,
    { chords: ESCAPE_CHORDS, label: escapeLine },
  ];

  const body = (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4">
            <dt className="flex w-32 shrink-0 flex-wrap items-center gap-1">
              {row.chords.map((chord, index) => (
                <span key={chord.join(' ')} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span className="text-xs text-ink-soft">
                      {t('shortcuts.or')}
                    </span>
                  ) : null}
                  <kbd className="flex items-center gap-1">
                    {chord.map((key) => (
                      <kbd key={key} className={KEYCAP}>
                        {key}
                      </kbd>
                    ))}
                  </kbd>
                </span>
              ))}
            </dt>
            <dd className="min-w-0 flex-1">{t(row.label)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-soft">{t('shortcuts.note')}</p>
    </div>
  );

  const surface = {
    title: t('shortcuts.title'),
    closeLabel: t('shortcuts.close'),
    onClose,
  };

  return tier === 'compact' ? (
    <BottomSheet {...surface}>
      <div className="pt-2">{body}</div>
    </BottomSheet>
  ) : (
    <ModalDialog {...surface} width="narrow">
      {body}
    </ModalDialog>
  );
}

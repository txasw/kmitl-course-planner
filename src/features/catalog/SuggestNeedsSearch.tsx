// The short dialog the plan status row's suggest action opens while no suggestion can apply
// (ADR-0054 amendment of 2026-11-21): no search has run, or the result is not a curriculum
// search of the plan's term. It says in one sentence that suggestions come from a search by
// curriculum, in the plan's term once a plan exists, and offers that search as its one
// action, which takes focus on open, since it is the likely next step. The dialog takes the
// title and the sentence as its description, not the action, which focus already names. It
// is the bottom sheet on a phone and a narrow dialog wider up, as the suggestion dialog
// itself is.

import { useId, useRef } from 'react';
import { WandSparkles } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState, EmptyStateAction } from '@/components/EmptyState';
import { ModalDialog } from '@/components/ModalDialog';
import { useActivePlan } from '@/features/plans/planStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';

interface SuggestNeedsSearchProps {
  onClose: () => void;
  /** Close the dialog and open the search by curriculum. */
  onSearch: () => void;
}

export function SuggestNeedsSearch({
  onClose,
  onSearch,
}: SuggestNeedsSearchProps) {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const hasPlan = useActivePlan() !== null;
  const actionRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-body`;
  const describedBy = `${titleId} ${descriptionId}`;
  const body = (
    <div data-suggest-needs-search className="py-4">
      <EmptyState
        icon={WandSparkles}
        title={t('suggest.needsSearch.title')}
        description={t(
          hasPlan
            ? 'suggest.needsSearch.body'
            : 'suggest.needsSearch.bodyNoPlan',
        )}
        titleId={titleId}
        descriptionId={descriptionId}
        action={
          <EmptyStateAction
            label={t('suggest.needsSearch.action')}
            variant="primary"
            buttonRef={actionRef}
            onClick={onSearch}
          />
        }
      />
    </div>
  );
  return tier === 'compact' ? (
    <BottomSheet
      title={t('suggest.title')}
      closeLabel={t('suggest.close')}
      onClose={onClose}
      initialFocusRef={actionRef}
      describedBy={describedBy}
    >
      {body}
    </BottomSheet>
  ) : (
    <ModalDialog
      title={t('suggest.title')}
      closeLabel={t('suggest.close')}
      onClose={onClose}
      width="narrow"
      initialFocusRef={actionRef}
      describedBy={describedBy}
    >
      {body}
    </ModalDialog>
  );
}

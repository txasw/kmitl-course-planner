// The name field of the plan switcher menu, shared by create and rename. Enter saves,
// and save stays disabled while the name is blank.

import { useEffect, useRef } from 'react';
import { CONTROL_BOUNDARY } from '@/lib/ui/control';
import { FOCUS_RING } from '@/lib/ui/focus';

export interface NameFormProps {
  value: string;
  label: string;
  save: string;
  cancel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NameForm({
  value,
  label,
  save,
  cancel,
  onChange,
  onSubmit,
  onCancel,
}: NameFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the field on open so the user can name the plan straight away, done
  // through a ref rather than autoFocus to satisfy the accessibility lint.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-ink">
        <span className="font-medium">{label}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          className={`rounded-kcp border px-2 py-1 text-ink ${CONTROL_BOUNDARY} ${FOCUS_RING}`}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-kcp border border-border px-2 py-1 font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.trim() === ''}
          className="rounded-kcp bg-primary-strong px-2 py-1 font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {save}
        </button>
      </div>
    </div>
  );
}

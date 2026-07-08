// A reusable searchable combobox with the WAI ARIA combobox and listbox popup
// pattern. Curriculum and faculty lists are long, so type to filter is a
// usability need, not polish. It carries full keyboard support and its own design
// token styling, and it is the single select primitive the search rail uses.

import { useId, useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  label: string;
  value: string;
  options: ComboboxOption[];
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function Combobox({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: ComboboxProps) {
  const listboxId = useId();
  const optionIdBase = useId();
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? '',
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Until the field is edited it shows every option; typing switches to filtering.
  const [dirty, setDirty] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // While closed the input mirrors the current selection, derived rather than
  // synced, so an external change such as a cascade reset shows immediately and
  // no effect writes state. While open it shows what the user is filtering by.
  const displayValue = open ? query : selectedLabel;

  const visible = useMemo(() => {
    if (!dirty) {
      return options;
    }
    const needle = query.trim().toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query, dirty]);

  const optionId = (index: number) => `${optionIdBase}-${String(index)}`;

  const openList = () => {
    if (disabled) {
      return;
    }
    setOpen(true);
    setDirty(false);
    setQuery(selectedLabel);
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const close = () => {
    setOpen(false);
    setDirty(false);
  };

  const commit = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
    setDirty(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          openList();
        } else if (visible.length > 0) {
          setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open) {
          setActiveIndex((index) => Math.max(index - 1, 0));
        }
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(visible.length - 1);
        }
        break;
      case 'Enter': {
        const option = visible[activeIndex];
        if (open && option) {
          event.preventDefault();
          commit(option);
        }
        break;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  };

  const activeOption = open ? visible[activeIndex] : undefined;

  return (
    <div className="relative flex flex-col gap-1 text-sm">
      <span id={labelId} className="font-medium text-ink">
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setDirty(true);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className="rounded-kcp border border-border bg-surface px-2 py-1.5 text-ink focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
      />
      {open && visible.length > 0 ? (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={label}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-kcp border border-border bg-surface py-1 shadow-kcp"
        >
          {visible.map((option, index) => (
            <li
              key={option.value}
              role="option"
              id={optionId(index)}
              aria-selected={option.value === value}
              onMouseDown={(event) => {
                // Keep focus on the input so blur does not close before the click.
                event.preventDefault();
                commit(option);
              }}
              onMouseEnter={() => {
                setActiveIndex(index);
              }}
              className={`cursor-pointer px-2 py-1.5 ${
                index === activeIndex
                  ? 'bg-primary-soft text-ink'
                  : 'text-ink-soft'
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

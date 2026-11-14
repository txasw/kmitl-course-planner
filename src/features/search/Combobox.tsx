// A reusable searchable combobox with the WAI ARIA combobox and listbox popup
// pattern. Curriculum and faculty lists are long, so type to filter is a
// usability need, not polish. It carries full keyboard support and its own design
// token styling, and it is the single select primitive the search form uses. The
// popup is positioned with floating-ui: a fixed strategy escapes the scrolling
// catalog column's clip, flip drops it above when space below is short, and size
// caps its height to the viewport with internal scrolling.
//
// The fixed strategy resolves against the viewport only while no ancestor
// establishes a containing block for fixed elements. The catalog sheet's
// translate-x transform is such an ancestor, so the popup renders through a
// floating-ui portal into the panel node and stays clip free in every container.
//
// A field may carry a leading icon that names what it selects at a glance. The icon
// is decorative, since the visible label already names the field, so it is hidden
// from assistive tech and ignores the pointer so a click lands on the control.

import { useCallback, useId, useMemo, useState } from 'react';
import {
  useFloating,
  offset,
  flip,
  size,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react';
import type { LucideIcon } from 'lucide-react';
import { CONTROL_BOUNDARY, CONTROL_DISABLED } from '@/lib/ui/control';
import { FOCUS_RING } from '@/lib/ui/focus';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';

const MAX_LIST_HEIGHT = 224;

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
  /** When false the field is a select only combobox: no filter input, a trigger that
   * opens a listbox navigated by the keyboard. Defaults to true for the long searchable
   * lists such as faculty and curriculum. */
  searchable?: boolean;
  /** A decorative leading icon drawn inside the control, before its value. */
  icon?: LucideIcon;
  /** When true the label sits beside the field rather than above it, for a compact
   * control in a toolbar row such as the catalog sort. Defaults to false. */
  inline?: boolean;
}

export function Combobox({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
  searchable = true,
  icon: Icon,
  inline = false,
}: ComboboxProps) {
  const listboxId = useId();
  const optionIdBase = useId();
  const inputId = useId();
  const labelId = useId();
  const portalRoot = usePanelPortal();

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? '',
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Until the field is edited it shows every option; typing switches to filtering.
  const [dirty, setDirty] = useState(false);
  // Index of the highlighted option, or -1 when none is highlighted so Enter on a
  // freshly opened field with no prior selection commits nothing.
  const [activeIndex, setActiveIndex] = useState(-1);

  // While closed the input mirrors the current selection, derived rather than
  // synced, so an external change such as a cascade reset shows immediately and
  // no effect writes state. While open it shows what the user is filtering by.
  const displayValue = open ? query : selectedLabel;

  const visible = useMemo(() => {
    if (!searchable || !dirty) {
      return options;
    }
    const needle = query.trim().toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query, dirty, searchable]);

  // The popup is only present when the field is open and has matches.
  const listVisible = open && visible.length > 0;

  const { refs, floatingStyles } = useFloating({
    open: listVisible,
    strategy: 'fixed',
    // An inline field closes its row, so its list aligns to the field's end and
    // grows back across the row.
    placement: inline ? 'bottom-end' : 'bottom-start',
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          // Match the input width, or for a compact inline trigger at least that
          // width so no option wraps, and cap the height to the space available,
          // scrolling internally beyond that.
          const fieldWidth = `${String(rects.reference.width)}px`;
          Object.assign(elements.floating.style, {
            width: inline ? 'max-content' : fieldWidth,
            minWidth: fieldWidth,
            maxHeight: `${String(Math.min(availableHeight, MAX_LIST_HEIGHT))}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Wrap the floating-ui setters as stable callback refs. Calling them in a
  // callback keeps the ref access out of render and off the method itself.
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLUListElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  const optionId = (index: number) => `${optionIdBase}-${String(index)}`;

  const openList = () => {
    // Only seed on the transition to open, so a click to reposition the caret
    // while already open does not discard the current filter.
    if (disabled || open) {
      return;
    }
    setOpen(true);
    setDirty(false);
    setQuery(selectedLabel);
    setActiveIndex(options.findIndex((option) => option.value === value));
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
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
        if (!open) {
          openList();
        } else {
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
        } else if (!open && !searchable) {
          event.preventDefault();
          openList();
        }
        break;
      }
      case ' ':
        // The select only trigger has no text entry, so Space opens the list or commits
        // the highlighted option like Enter; the searchable input keeps Space literal.
        if (!searchable) {
          event.preventDefault();
          const option = visible[activeIndex];
          if (open && option) {
            commit(option);
          } else if (!open) {
            openList();
          }
        }
        break;
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
  // The leading icon takes the start padding, so the value text clears it.
  const inset = Icon ? 'pl-8 pr-2' : 'px-2';

  const listbox = listVisible ? (
    <ul
      ref={setFloating}
      role="listbox"
      id={listboxId}
      aria-label={label}
      style={floatingStyles}
      className="z-popover kcp-scroll overflow-y-auto rounded-kcp border border-border bg-surface py-1 shadow-kcp"
    >
      {visible.map((option, index) => (
        <li
          key={option.value}
          role="option"
          id={optionId(index)}
          aria-selected={option.value === value}
          onMouseDown={(event) => {
            // Keep focus on the trigger so blur does not close before the click.
            event.preventDefault();
            commit(option);
          }}
          onMouseEnter={() => {
            setActiveIndex(index);
          }}
          className={`cursor-pointer px-2 py-1.5 ${
            index === activeIndex ? 'bg-primary-soft text-ink' : 'text-ink-soft'
          }`}
        >
          {option.label}
        </li>
      ))}
    </ul>
  ) : null;

  const control = searchable ? (
    <input
      ref={setReference}
      id={inputId}
      type="text"
      role="combobox"
      aria-expanded={listVisible}
      aria-controls={listVisible ? listboxId : undefined}
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
      className={`rounded-kcp border ${inset} py-1.5 ${
        disabled ? CONTROL_DISABLED : `${CONTROL_BOUNDARY} text-ink`
      } ${FOCUS_RING}`}
    />
  ) : (
    <div
      ref={setReference}
      id={inputId}
      role="combobox"
      tabIndex={disabled ? -1 : 0}
      aria-haspopup="listbox"
      aria-expanded={listVisible}
      aria-controls={listVisible ? listboxId : undefined}
      aria-labelledby={labelId}
      aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        if (open) close();
        else openList();
      }}
      onKeyDown={handleKeyDown}
      onBlur={close}
      className={`flex items-center rounded-kcp border ${inset} py-1.5 ${
        disabled
          ? `cursor-not-allowed ${CONTROL_DISABLED}`
          : `cursor-pointer ${CONTROL_BOUNDARY} ${
              selectedLabel ? 'text-ink' : 'text-ink-soft'
            }`
      } ${FOCUS_RING}`}
    >
      {selectedLabel || placeholder}
    </div>
  );

  return (
    <div
      className={`relative flex text-sm ${
        inline ? 'items-center gap-2' : 'flex-col gap-1'
      }`}
    >
      <label
        id={labelId}
        htmlFor={searchable ? inputId : undefined}
        className={
          inline ? 'shrink-0 text-xs text-ink-soft' : 'font-semibold text-ink'
        }
      >
        {label}
      </label>
      {Icon ? (
        <div className="relative flex flex-col">
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-soft"
          />
          {control}
        </div>
      ) : (
        control
      )}
      {portalRoot ? (
        <FloatingPortal root={portalRoot}>{listbox}</FloatingPortal>
      ) : (
        listbox
      )}
    </div>
  );
}

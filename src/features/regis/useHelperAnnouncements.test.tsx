import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import type { FillRun } from './fill/fillRun';
import { helperStore, startVisit } from './helperStore';
import { GROUP_MS, useHelperAnnouncements } from './useHelperAnnouncements';
import type { HelperModel } from './useHelperModel';

// The helper's live region reads status changes within half a second as one sentence,
// and reads each run stop.

const t = createTranslator('en');

type Statuses = Readonly<Record<string, HelperStatus>>;

function Probe({
  statuses,
  stale = false,
  run = { status: 'idle' },
}: {
  statuses: Statuses;
  stale?: boolean;
  run?: FillRun;
}) {
  // Test only: the hook reads these three fields of the model and nothing else.
  const model = { statuses, stale, run } as unknown as HelperModel;
  useHelperAnnouncements(model, t);
  return null;
}

function said(): string {
  return helperStore.getState().announcement.text;
}

beforeEach(() => {
  vi.useFakeTimers();
  startVisit();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useHelperAnnouncements', () => {
  it('reads changes within half a second as one sentence', () => {
    const view = render(<Probe statuses={{ A: 'todo', B: 'todo' }} />);
    view.rerender(<Probe statuses={{ A: 'added', B: 'todo' }} />);
    act(() => {
      vi.advanceTimersByTime(GROUP_MS / 2);
    });
    view.rerender(<Probe statuses={{ A: 'added', B: 'cond' }} />);
    expect(said()).toBe('');
    act(() => {
      vi.advanceTimersByTime(GROUP_MS);
    });
    expect(said()).toBe('Status changed for 2 subjects');
  });

  it('reads one change with its subject and status', () => {
    const view = render(<Probe statuses={{ A: 'todo', B: 'todo' }} />);
    view.rerender(<Probe statuses={{ A: 'added', B: 'todo' }} />);
    act(() => {
      vi.advanceTimersByTime(GROUP_MS);
    });
    expect(said()).toBe('A Added as planned');
    view.rerender(<Probe statuses={{ A: 'added', B: 'full' }} />);
    act(() => {
      vi.advanceTimersByTime(GROUP_MS);
    });
    expect(said()).toBe('B Section full');
  });

  it('reads nothing for a status that changes back within the window', () => {
    const view = render(<Probe statuses={{ A: 'todo' }} />);
    view.rerender(<Probe statuses={{ A: 'adding' }} />);
    view.rerender(<Probe statuses={{ A: 'todo' }} />);
    act(() => {
      vi.advanceTimersByTime(GROUP_MS);
    });
    expect(said()).toBe('');
  });

  it('reads the page turning unreadable at once', () => {
    const view = render(<Probe statuses={{ A: 'todo' }} />);
    view.rerender(<Probe statuses={{ A: 'todo' }} stale />);
    expect(said()).toBe('Page not readable');
  });

  it('reads each stop, a repeat of the same reason too', () => {
    const view = render(<Probe statuses={{}} />);
    const stop = (): FillRun => ({
      status: 'stopped',
      subjectId: 'A',
      reason: 'stopped',
      scope: ['A'],
    });
    view.rerender(<Probe statuses={{}} run={stop()} />);
    expect(helperStore.getState().announcement).toMatchObject({
      text: 'Adding stopped.',
    });
    const { seq } = helperStore.getState().announcement;
    view.rerender(<Probe statuses={{}} run={stop()} />);
    expect(helperStore.getState().announcement.seq).toBe(seq + 1);
  });
});

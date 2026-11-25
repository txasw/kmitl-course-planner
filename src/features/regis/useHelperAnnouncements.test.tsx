import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import { toastStore } from '@/features/shell/toastStore';
import type { FillRun } from './fill/fillRun';
import { helperStore, startVisit } from './helperStore';
import { GROUP_MS, useHelperAnnouncements } from './useHelperAnnouncements';
import type { HelperModel } from './useHelperModel';

// The helper's live region reads status changes within half a second as one sentence,
// reads each run stop, and a failed run shows the error toast, which its own live region
// reads, in place of the stop sentence.

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
  toastStore.setState({ toast: null });
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

  it('shows the error toast for a failed run, read once, and not for a stop', () => {
    const view = render(<Probe statuses={{}} />);
    const stop = (reason: 'noAnswer' | 'stopped'): FillRun => ({
      status: 'stopped',
      subjectId: 'A',
      reason,
      scope: ['A'],
    });
    view.rerender(<Probe statuses={{}} run={stop('stopped')} />);
    expect(said()).toBe('Adding stopped.');
    expect(toastStore.getState().toast).toBeNull();
    const { seq } = helperStore.getState().announcement;
    view.rerender(<Probe statuses={{}} run={stop('noAnswer')} />);
    expect(toastStore.getState().toast).toMatchObject({
      kind: 'error',
      message: 'Could not add',
    });
    // The toast region reads the failure, so the helper's region says nothing more.
    expect(helperStore.getState().announcement.seq).toBe(seq);
  });

  it('shows no toast for a stop found on arrival', () => {
    render(
      <Probe
        statuses={{}}
        run={{
          status: 'stopped',
          subjectId: 'A',
          reason: 'pageChanged',
          scope: ['A'],
        }}
      />,
    );
    expect(toastStore.getState().toast).toBeNull();
  });
});

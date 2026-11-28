import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import { SimulationControls } from './views';
import type { RequestMessage } from '@/lib/messaging/extensionProtocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { DataQualityReport } from '@/lib/contract/report';
import { emptyByKind } from '@/lib/contract/report';
import { ok } from '@/lib/utils/result';
import { uiStore } from '@/features/shell/uiStore';
import { onboardingStore } from '@/features/onboarding/onboardingStore';
import { debugMenuStore } from '@/features/shell/debugMenuStore';
import { Diagnostics } from './Diagnostics';

function report(): DataQualityReport {
  const byKind = emptyByKind();
  byKind.missing_field = 1;
  return {
    reportVersion: 1,
    extensionVersion: '0.0.0',
    generatedAt: 'T',
    request: { endpoint: 'get-teach-table-show', params: {} },
    totals: {
      rows: 1,
      deduped: 1,
      issues: 1,
      unscheduled: 0,
      extraMeetings: 0,
      byKind,
    },
    aggregates: [
      {
        path: 'rows[0].teach_time2',
        kind: 'missing_field',
        count: 1,
        samples: ['absent'],
      },
    ],
    issues: [
      {
        kind: 'missing_field',
        severity: 'error',
        path: 'rows[0].teach_time2',
        expected: 'present',
        received: 'absent',
        rowRef: { index: 0 },
      },
    ],
  };
}

// A stateful fake worker: setFault and setMutation mutate the settings that
// getSimulation then returns, so the test binds against the same round trip the
// real worker drives, not a hardcoded response.
function fakeSend(mutationId: string | null): TypedSend {
  const sim = { fixtureId: null, faultId: null, mutationId } as {
    fixtureId: string | null;
    faultId: string | null;
    mutationId: string | null;
  };
  const handler = (message: RequestMessage) => {
    switch (message.type) {
      case 'debug/getRequestLog':
        return Promise.resolve(
          ok([
            {
              endpoint: 'get-teach-table-show',
              params: {},
              durationMs: 12,
              cacheHit: false,
              retryCount: 0,
              status: 200,
              issueCount: 1,
            },
          ]),
        );
      case 'debug/getReport':
        return Promise.resolve(ok(report()));
      case 'debug/getLatestRaw':
        return Promise.resolve(
          ok({
            raw: [{ probe: true }],
            request: { endpoint: 'get-teach-table-show', params: {} },
          }),
        );
      case 'debug/getSimulation':
        return Promise.resolve(ok({ ...sim }));
      case 'debug/setFault':
        sim.faultId = message.faultId;
        return Promise.resolve(ok(undefined));
      case 'debug/setMutation':
        sim.mutationId = message.mutationId;
        return Promise.resolve(ok(undefined));
      default:
        return Promise.resolve(ok(undefined));
    }
  };
  return handler as unknown as TypedSend;
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setDiagnosticsIssueCount(null);
  });
});

describe('Diagnostics drawer', () => {
  it('steps the trigger aside while the search page coach mark shows', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    act(() => {
      onboardingStore.getState().setCoachMarkOpen(true);
    });
    expect(screen.queryByRole('button', { name: 'Diagnostics' })).toBeNull();
    act(() => {
      onboardingStore.getState().setCoachMarkOpen(false);
    });
    expect(
      await screen.findByRole('button', { name: 'Diagnostics' }),
    ).toBeInTheDocument();
  });

  it('leaves the panel for the header menu slot while the panel is open', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    act(() => {
      uiStore.getState().open();
    });
    expect(screen.queryByRole('button', { name: 'Diagnostics' })).toBeNull();
    const slot = debugMenuStore.getState().item;
    expect(slot?.label).toBe('Diagnostics');
    act(() => {
      slot?.onSelect();
    });
    expect(
      await screen.findByRole('button', { name: 'Data quality' }),
    ).toBeInTheDocument();
    act(() => {
      uiStore.getState().close();
    });
  });

  it('empties the menu slot when it unmounts', () => {
    const { unmount } = render(<Diagnostics send={fakeSend(null)} />);
    expect(debugMenuStore.getState().item).not.toBeNull();
    unmount();
    expect(debugMenuStore.getState().item).toBeNull();
  });

  it('steps the trigger aside while the product tour shows', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    act(() => {
      onboardingStore.getState().startTour();
    });
    expect(screen.queryByRole('button', { name: 'Diagnostics' })).toBeNull();
    act(() => {
      onboardingStore.getState().endTour();
    });
    expect(
      await screen.findByRole('button', { name: 'Diagnostics' }),
    ).toBeInTheDocument();
  });

  it('surfaces a missing field in the report and sets the launcher badge', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Data quality' }));
    expect(await screen.findByText('missing_field')).toBeInTheDocument();
    expect(screen.getByText('rows[0].teach_time2')).toBeInTheDocument();
    expect(uiStore.getState().diagnosticsIssueCount).toBe(1);
  });

  it('shows the raw and normalized payloads side by side', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Raw vs normalized' }));
    expect(
      await screen.findByRole('heading', { name: 'Raw' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Normalized' }),
    ).toBeInTheDocument();
  });

  it('rehydrates the simulation controls from the worker', async () => {
    render(<Diagnostics send={fakeSend('drop_teach_time2')} />);
    // The trigger reflects the armed simulation once the worker state loads.
    const trigger = await screen.findByRole('button', {
      name: 'Diagnostics, simulation armed',
    });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }));
    expect(screen.getByRole('combobox', { name: 'Mutation' })).toHaveValue(
      'drop_teach_time2',
    );
  });

  it('keeps the armed mutation after switching tabs and returning', async () => {
    render(<Diagnostics send={fakeSend(null)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Mutation' }), {
      target: { value: 'drop_teach_time2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Requests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulation' }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Mutation' })).toHaveValue(
        'drop_teach_time2',
      );
    });
  });

  it('binds the rendered control to the simulation prop', () => {
    // A seed once control would ignore this prop change; the rendered value must
    // track the worker state the parent passes down.
    const { rerender } = render(
      <SimulationControls
        simulation={{ fixtureId: null, faultId: null, mutationId: null }}
        onSetFault={() => undefined}
        onSetMutation={() => undefined}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Mutation' })).toHaveValue('');
    rerender(
      <SimulationControls
        simulation={{
          fixtureId: null,
          faultId: null,
          mutationId: 'drop_teach_time2',
        }}
        onSetFault={() => undefined}
        onSetMutation={() => undefined}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Mutation' })).toHaveValue(
      'drop_teach_time2',
    );
  });
});

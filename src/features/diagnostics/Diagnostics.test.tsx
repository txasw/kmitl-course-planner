import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { RequestMessage } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { DataQualityReport } from '@/lib/contract/report';
import { emptyByKind } from '@/lib/contract/report';
import { ok } from '@/lib/utils/result';
import { uiStore } from '@/features/shell/uiStore';
import {
  SearchDepsProvider,
  type SearchDeps,
} from '@/features/search/SearchDepsContext';
import { Diagnostics } from './Diagnostics';

function report(): DataQualityReport {
  const byKind = emptyByKind();
  byKind.missing_field = 1;
  return {
    reportVersion: 1,
    extensionVersion: '0.0.0',
    generatedAt: 'T',
    request: { endpoint: 'get-teach-table-show', params: {} },
    totals: { rows: 1, deduped: 1, issues: 1, byKind },
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

function fakeSend(mutationId: string | null): TypedSend {
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
        return Promise.resolve(
          ok({ fixtureId: null, faultId: null, mutationId }),
        );
      default:
        return Promise.resolve(ok(undefined));
    }
  };
  return handler as unknown as TypedSend;
}

function deps(mutationId: string | null = null): SearchDeps {
  return {
    send: fakeSend(mutationId),
    repo: { load: () => Promise.resolve(null), save: () => Promise.resolve() },
  };
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setDiagnosticsIssueCount(null);
  });
});

describe('Diagnostics drawer', () => {
  it('surfaces a missing field in the report and sets the launcher badge', async () => {
    render(
      <SearchDepsProvider value={deps()}>
        <Diagnostics />
      </SearchDepsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Data quality' }));
    expect(await screen.findByText('missing_field')).toBeInTheDocument();
    expect(screen.getByText('rows[0].teach_time2')).toBeInTheDocument();
    expect(uiStore.getState().diagnosticsIssueCount).toBe(1);
  });

  it('shows the raw and normalized payloads side by side', async () => {
    render(
      <SearchDepsProvider value={deps()}>
        <Diagnostics />
      </SearchDepsProvider>,
    );
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
    render(
      <SearchDepsProvider value={deps('drop_teach_time2')}>
        <Diagnostics />
      </SearchDepsProvider>,
    );
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
});

// Asks the worker's host check about the page's host build (ADR-0079), once per document,
// when the student is on the pre registration page and its script names are not an exact
// tested pair beside a tested vendor script. The observer and fill that read its verdict
// run on that page alone, so on any other route, the planner's included, nothing is sent;
// the check holds to the route itself as well as through the hook. Only the two public
// script names are sent.
// A reply that is not a well formed verdict, or no reply, reads as a check that could not
// run, which keeps fill off with the untested build sentence.

import { useEffect } from 'react';
import { hostBuildReplySchema } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { buildKey, checkablePair } from '@/lib/regis/hostBuild';
import { companionRoute } from '@/lib/routing/registrationRoute';
import { readLocationHash } from '@/features/shell/hostLocation';
import { buildCheckStore } from './host/buildCheckStore';
import { readScriptNames } from './host/hostDom';
import { useCompanionRoute } from './useCompanion';

export async function checkHostBuild(
  send: TypedSend,
  names: readonly string[],
  hash: string,
): Promise<void> {
  if (companionRoute(hash) !== 'preRegistration') return;
  const pair = checkablePair(names);
  const key = buildKey(names);
  if (pair === null || key === null) return;
  if (buildCheckStore.getState().check?.key === key) return;
  buildCheckStore.setState({ check: { key, verdict: null } });
  const reply = hostBuildReplySchema.safeParse(
    await send({ type: 'regis/hostBuild', ...pair }),
  );
  buildCheckStore.setState({
    check: {
      key,
      verdict: reply.success ? reply.data.value : { status: 'failed' },
    },
  });
}

export function useHostBuildCheck(send: TypedSend): void {
  const onPage = useCompanionRoute() === 'preRegistration';
  useEffect(() => {
    if (onPage) {
      void checkHostBuild(send, readScriptNames(document), readLocationHash());
    }
  }, [onPage, send]);
}

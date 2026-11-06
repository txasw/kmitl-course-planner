// The worker side of the welcome claim (ADR-0062). A content script that finds the
// welcome still pending asks onboarding/claimWelcome before it shows anything, and the
// worker decides inside the intent queue, so two regis tabs that ask at once get one
// answer each in turn. The install tab wins while its welcome intent is live; once the
// intent expires, or when none was recorded, the first tab to ask wins. A grant is
// recorded in the worker's own session record, so the welcome shows at most once per
// browser session even before the content side has stored welcomeShownAt.
//
// Where storage.session is missing (Firefox before 115) there is no session record to
// arbitrate with, so the claim is granted and the content side's fresh read of
// welcomeShownAt is the only guard. A storage fault denies the claim, so a broken
// session area never shows the welcome twice; the next document asks again.

import type { HandlerContext } from '../messaging/router';
import type { WelcomeClaim } from '../messaging/protocol';
import type { TabIntentStore } from '../storage/tabIntents';

export interface WelcomeClaimDeps {
  /** The worker's tab intent store, or null where storage.session is missing. */
  intents: TabIntentStore | null;
}

export async function answerWelcomeClaim(
  context: HandlerContext,
  { intents }: WelcomeClaimDeps,
): Promise<WelcomeClaim> {
  const { tabId } = context;
  if (tabId === null) return { granted: false };
  if (intents === null) return { granted: true };
  const granted = await intents.claimWelcome(tabId).catch(() => false);
  return { granted };
}

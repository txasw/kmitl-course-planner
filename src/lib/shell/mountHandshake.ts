// The worker side of the mount handshake (ADR-0062). A content script sends
// shell/mounted once per document after its listener is registered, and the worker
// answers whether that tab was opened by a toolbar click and should open the panel,
// together with the open shortcut, since the commands API is not available to content
// scripts. An open intent is consumed through the intent queue, so it opens the panel
// once and only in the tab it names. Each half degrades on its own: a storage fault
// answers no open, and an unreadable command list answers no shortcut.

import type { HandlerContext } from '../messaging/router';
import type { MountHandshake } from '../messaging/protocol';
import type { TabIntentStore } from '../storage/tabIntents';

/** The reserved command that runs the toolbar action. */
export const ACTION_COMMAND = '_execute_action';

/** The part of a browser command the handshake reads. */
export interface BrowserCommand {
  name?: string | undefined;
  shortcut?: string | undefined;
}

export interface MountHandshakeDeps {
  /** The worker's tab intent store, or null where storage.session is missing. */
  intents: TabIntentStore | null;
  /** The commands the browser reports, with their current shortcuts. */
  getCommands: () => Promise<BrowserCommand[]>;
}

/** The shortcut assigned to the action command, or null when none is assigned. */
export function actionShortcut(commands: BrowserCommand[]): string | null {
  const shortcut = commands.find(
    (command) => command.name === ACTION_COMMAND,
  )?.shortcut;
  return shortcut === undefined || shortcut === '' ? null : shortcut;
}

export async function answerMountHandshake(
  context: HandlerContext,
  { intents, getCommands }: MountHandshakeDeps,
): Promise<MountHandshake> {
  const { tabId } = context;
  const [openPanel, shortcut] = await Promise.all([
    tabId === null || intents === null
      ? false
      : intents.consume(tabId).catch(() => false),
    getCommands().then(actionShortcut, () => null),
  ]);
  return { openPanel, shortcut };
}

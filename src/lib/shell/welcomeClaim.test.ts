import { describe, expect, it } from 'vitest';
import { answerWelcomeClaim } from './welcomeClaim';
import { createTabIntentStore } from '../storage/tabIntents';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';

const INSTALL_TAB = 7;
const OTHER_TAB = 8;

function setup(now: () => number = () => 1_000) {
  const intents = createTabIntentStore(createMemoryStorage(), { now });
  return { intents, deps: { intents } };
}

describe('answerWelcomeClaim', () => {
  it('grants the install tab while its welcome intent is live and denies others', async () => {
    const { intents, deps } = setup();
    await intents.add(INSTALL_TAB, 'welcome');
    expect(await answerWelcomeClaim({ tabId: OTHER_TAB }, deps)).toEqual({
      granted: false,
    });
    expect(await answerWelcomeClaim({ tabId: INSTALL_TAB }, deps)).toEqual({
      granted: true,
    });
  });

  it('grants the first tab to ask when no welcome intent exists', async () => {
    const { deps } = setup();
    const [first, second] = await Promise.all([
      answerWelcomeClaim({ tabId: OTHER_TAB }, deps),
      answerWelcomeClaim({ tabId: INSTALL_TAB }, deps),
    ]);
    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
  });

  it('grants any tab once the welcome intent has expired', async () => {
    let at = 1_000;
    const { intents, deps } = setup(() => at);
    await intents.add(INSTALL_TAB, 'welcome');
    at += 120_000;
    expect((await answerWelcomeClaim({ tabId: OTHER_TAB }, deps)).granted).toBe(
      true,
    );
  });

  it('grants once per session, the same tab included', async () => {
    const { deps } = setup();
    expect(
      (await answerWelcomeClaim({ tabId: INSTALL_TAB }, deps)).granted,
    ).toBe(true);
    expect(
      (await answerWelcomeClaim({ tabId: INSTALL_TAB }, deps)).granted,
    ).toBe(false);
    expect((await answerWelcomeClaim({ tabId: OTHER_TAB }, deps)).granted).toBe(
      false,
    );
  });

  it('denies a sender without a tab', async () => {
    const { deps } = setup();
    expect((await answerWelcomeClaim({ tabId: null }, deps)).granted).toBe(
      false,
    );
  });

  it('grants without a session area and denies on a storage fault', async () => {
    expect(
      (await answerWelcomeClaim({ tabId: OTHER_TAB }, { intents: null }))
        .granted,
    ).toBe(true);
    const failing = createTabIntentStore({
      ...createMemoryStorage(),
      get: () => Promise.reject(new Error('storage fault')),
    });
    expect(
      (await answerWelcomeClaim({ tabId: OTHER_TAB }, { intents: failing }))
        .granted,
    ).toBe(false);
  });
});

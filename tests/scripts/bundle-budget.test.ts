import { describe, expect, it } from 'vitest';
import {
  BUNDLE_BUDGETS,
  checkBundleSize,
  describeBundleSize,
  zipFileName,
} from '../../scripts/bundle-budget.mjs';

describe('bundle budget', () => {
  it('sets a budget for every production target', () => {
    expect(Object.keys(BUNDLE_BUDGETS).sort()).toEqual(['chrome', 'firefox']);
  });

  it('accepts a zip at or under its budget', () => {
    expect(checkBundleSize('chrome', BUNDLE_BUDGETS.chrome)).toBeNull();
    expect(checkBundleSize('firefox', BUNDLE_BUDGETS.firefox - 1)).toBeNull();
  });

  it('rejects a zip over its budget and says how far over', () => {
    const error = checkBundleSize('chrome', BUNDLE_BUDGETS.chrome + 10);
    expect(error).toContain('10 bytes over');
    expect(error).toContain('scripts/bundle-budget.mjs');
  });

  it('rejects a target that has no budget', () => {
    expect(checkBundleSize('safari', 1)).toContain(
      'no bundle budget is set for safari',
    );
  });

  it('reports the size in KiB and bytes', () => {
    expect(describeBundleSize('chrome', 2048)).toBe(
      'chrome zip is 2.0 KiB (2048 bytes) against a budget of 420.0 KiB (430080 bytes)',
    );
  });

  it('names the zip by version so an older release zip is not picked up', () => {
    expect(zipFileName('1.6.0', 'chrome')).toBe(
      'kmitl-course-planner-1.6.0-chrome.zip',
    );
  });
});

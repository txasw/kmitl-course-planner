export const BUNDLE_BUDGETS: Readonly<Record<'chrome' | 'firefox', number>>;
export function describeBundleSize(browser: string, bytes: number): string;
export function checkBundleSize(browser: string, bytes: number): string | null;

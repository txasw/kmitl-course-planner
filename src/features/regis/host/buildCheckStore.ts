// The host check's answer for this document's host build (ADR-0079), in memory only. The
// host is a single page application that never reloads, so its script names, and the
// answer for them, last the document. The answer names the build by its public script
// names and holds nothing read from the student's page.

import { createStore } from 'zustand/vanilla';
import type { BuildCheck } from '@/lib/regis/hostBuild';

export const buildCheckStore = createStore<{ check: BuildCheck | null }>()(
  () => ({ check: null }),
);

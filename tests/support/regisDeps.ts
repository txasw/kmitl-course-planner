// Registration helper repositories over an in memory store, for component tests that
// mount the app or the dock without the browser storage binding.

import type { RegisRepositories } from '@/features/regis/regisStore';
import {
  createChecklistRepository,
  createRegKitRepository,
} from '@/lib/storage/regis';
import { createMemoryStorage } from './memoryStorage';

export function fakeRegisDeps(): RegisRepositories {
  const storage = createMemoryStorage();
  return {
    kits: createRegKitRepository(storage),
    checklists: createChecklistRepository(storage),
  };
}

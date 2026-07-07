import { describe, it, expect } from 'vitest';
import { runMigrations, type Migration } from './migrations';

describe('runMigrations', () => {
  it('is a no-op when already at the target version', () => {
    const result = runMigrations({ value: 1 }, 1, 1, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ value: 1 });
    }
  });

  it('applies ordered migrations and threads data through each step', () => {
    const migrations: Migration[] = [
      { to: 2, migrate: (data) => Number(data) + 1 },
      { to: 3, migrate: (data) => Number(data) + 1 },
    ];
    const result = runMigrations(1, 1, 3, migrations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
  });

  it('refuses a stored version newer than the target', () => {
    const result = runMigrations({}, 2, 1, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('storage');
      expect(result.error.message).toMatch(/newer/);
    }
  });

  it('errors when an intermediate migration is missing', () => {
    const result = runMigrations(1, 0, 1, []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/no migration/);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { planExportBaseName } from './exportName';

const base = {
  id: 'plan-1',
  name: 'ตาราง 1/2569',
  year: '2569',
  semester: '1' as const,
};

describe('planExportBaseName', () => {
  it('embeds the term and the slugged plan name', () => {
    expect(planExportBaseName(base)).toBe('kmitl-plan-2569-1-ตาราง-1-2569');
  });

  it('falls back to the plan id when the name has no file safe characters', () => {
    expect(planExportBaseName({ ...base, name: '!!!' })).toBe(
      'kmitl-plan-2569-1-plan-1',
    );
  });
});

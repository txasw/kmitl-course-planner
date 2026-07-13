import { describe, it, expect } from 'vitest';
import {
  buildEligibility,
  fullLevel,
  sameLevel,
  nextDensityLevel,
  type DensityLevel,
} from './blockDensity';

const allEligible = buildEligibility({
  hasName: true,
  hasEnglish: true,
  hasSection: true,
  hasId: true,
  hasPlace: true,
});

describe('buildEligibility', () => {
  it('derives a stable mask that distinguishes field sets', () => {
    const a = buildEligibility({
      hasName: true,
      hasEnglish: false,
      hasSection: true,
      hasId: false,
      hasPlace: true,
    });
    const b = buildEligibility({
      hasName: true,
      hasEnglish: false,
      hasSection: true,
      hasId: false,
      hasPlace: true,
    });
    expect(a.mask).toBe(b.mask);
    expect(a.mask).not.toBe(allEligible.mask);
  });
});

describe('fullLevel', () => {
  it('shows every eligible field with the name at two lines', () => {
    expect(fullLevel(allEligible)).toEqual({
      nameLines: 2,
      showEnglish: true,
      showSection: true,
      showId: true,
      showPlace: true,
    });
  });

  it('drops a field the block never had', () => {
    const noEnglishNoPlace = buildEligibility({
      hasName: true,
      hasEnglish: false,
      hasSection: true,
      hasId: true,
      hasPlace: false,
    });
    expect(fullLevel(noEnglishNoPlace)).toEqual({
      nameLines: 2,
      showEnglish: false,
      showSection: true,
      showId: true,
      showPlace: false,
    });
  });

  it('drops the name entirely when there is no name', () => {
    const noName = buildEligibility({
      hasName: false,
      hasEnglish: false,
      hasSection: true,
      hasId: true,
      hasPlace: true,
    });
    expect(fullLevel(noName).nameLines).toBe(0);
  });
});

describe('nextDensityLevel', () => {
  it('walks the full drop order, id first and the name last', () => {
    const sequence: (DensityLevel | null)[] = [];
    let level: DensityLevel | null = fullLevel(allEligible);
    while (level !== null) {
      sequence.push(level);
      level = nextDensityLevel(level);
    }
    expect(sequence).toEqual([
      {
        nameLines: 2,
        showEnglish: true,
        showSection: true,
        showId: true,
        showPlace: true,
      },
      {
        nameLines: 2,
        showEnglish: true,
        showSection: true,
        showId: false,
        showPlace: true,
      },
      {
        nameLines: 2,
        showEnglish: true,
        showSection: true,
        showId: false,
        showPlace: false,
      },
      {
        nameLines: 2,
        showEnglish: true,
        showSection: false,
        showId: false,
        showPlace: false,
      },
      {
        nameLines: 2,
        showEnglish: false,
        showSection: false,
        showId: false,
        showPlace: false,
      },
      {
        nameLines: 1,
        showEnglish: false,
        showSection: false,
        showId: false,
        showPlace: false,
      },
      {
        nameLines: 0,
        showEnglish: false,
        showSection: false,
        showId: false,
        showPlace: false,
      },
    ]);
  });

  it('returns null once only the time remains', () => {
    const bare: DensityLevel = {
      nameLines: 0,
      showEnglish: false,
      showSection: false,
      showId: false,
      showPlace: false,
    };
    expect(nextDensityLevel(bare)).toBeNull();
  });

  it('skips a rung for a field the block never had', () => {
    // No id and no english: the first demotion drops the place, not a phantom id, and the
    // english rung is never visited.
    const noIdNoEnglish = fullLevel(
      buildEligibility({
        hasName: true,
        hasEnglish: false,
        hasSection: true,
        hasId: false,
        hasPlace: true,
      }),
    );
    const steps: DensityLevel[] = [];
    let level: DensityLevel | null = noIdNoEnglish;
    while (level !== null) {
      steps.push(level);
      level = nextDensityLevel(level);
    }
    expect(
      steps.map((s) => ({
        n: s.nameLines,
        sec: s.showSection,
        place: s.showPlace,
      })),
    ).toEqual([
      { n: 2, sec: true, place: true },
      { n: 2, sec: true, place: false },
      { n: 2, sec: false, place: false },
      { n: 1, sec: false, place: false },
      { n: 0, sec: false, place: false },
    ]);
    expect(steps.every((s) => !s.showId && !s.showEnglish)).toBe(true);
  });
});

describe('sameLevel', () => {
  it('is true only when every field matches', () => {
    const base = fullLevel(allEligible);
    expect(sameLevel(base, { ...base })).toBe(true);
    expect(sameLevel(base, { ...base, showId: false })).toBe(false);
    expect(sameLevel(base, { ...base, nameLines: 1 })).toBe(false);
  });
});

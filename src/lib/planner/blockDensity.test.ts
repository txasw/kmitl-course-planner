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

/** Walk the ladder from a starting level to the terminus, collecting every level. */
function walk(start: DensityLevel): DensityLevel[] {
  const steps: DensityLevel[] = [];
  let level: DensityLevel | null = start;
  while (level !== null) {
    steps.push(level);
    level = nextDensityLevel(level);
  }
  return steps;
}

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
  it('shows every eligible field with the name at two lines and the time on', () => {
    expect(fullLevel(allEligible)).toEqual({
      nameLines: 2,
      showEnglish: true,
      showPlace: true,
      showSection: true,
      showTime: true,
      showId: true,
    });
  });

  it('drops a field the block never had, keeping the name and the time', () => {
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
      showPlace: false,
      showSection: true,
      showTime: true,
      showId: true,
    });
  });
});

describe('nextDensityLevel', () => {
  it('walks the inverted drop order, id first and the name last', () => {
    expect(walk(fullLevel(allEligible))).toEqual([
      {
        nameLines: 2,
        showEnglish: true,
        showPlace: true,
        showSection: true,
        showTime: true,
        showId: true,
      },
      {
        nameLines: 2,
        showEnglish: true,
        showPlace: true,
        showSection: true,
        showTime: true,
        showId: false,
      },
      {
        nameLines: 2,
        showEnglish: false,
        showPlace: true,
        showSection: true,
        showTime: true,
        showId: false,
      },
      {
        nameLines: 2,
        showEnglish: false,
        showPlace: true,
        showSection: true,
        showTime: false,
        showId: false,
      },
      {
        nameLines: 2,
        showEnglish: false,
        showPlace: true,
        showSection: false,
        showTime: false,
        showId: false,
      },
      {
        nameLines: 1,
        showEnglish: false,
        showPlace: true,
        showSection: false,
        showTime: false,
        showId: false,
      },
      {
        nameLines: 1,
        showEnglish: false,
        showPlace: false,
        showSection: false,
        showTime: false,
        showId: false,
      },
    ]);
  });

  it('never drops the name below one line', () => {
    const bare: DensityLevel = {
      nameLines: 1,
      showEnglish: false,
      showPlace: false,
      showSection: false,
      showTime: false,
      showId: false,
    };
    expect(nextDensityLevel(bare)).toBeNull();
  });

  it('keeps the place alive past the name second line', () => {
    // Binding constraint: a one line ellipsized name still identifies the course while a lost
    // room is unrecoverable, so the name must reduce to one line before the place drops.
    const steps = walk(fullLevel(allEligible));
    const nameReduced = steps.findIndex((s) => s.nameLines === 1);
    const placeDropped = steps.findIndex((s) => !s.showPlace);
    expect(nameReduced).toBeGreaterThanOrEqual(0);
    expect(placeDropped).toBeGreaterThan(nameReduced);
    // At the step the name first drops to one line, the place is still shown.
    expect(steps[nameReduced]?.showPlace).toBe(true);
  });

  it('never keeps the time past the place', () => {
    // Binding constraint: the place is the field position cannot encode, the time is, so the
    // time must drop before the place.
    const steps = walk(fullLevel(allEligible));
    const timeDropped = steps.findIndex((s) => !s.showTime);
    const placeDropped = steps.findIndex((s) => !s.showPlace);
    expect(timeDropped).toBeGreaterThanOrEqual(0);
    expect(timeDropped).toBeLessThan(placeDropped);
  });

  it('skips a rung for a field the block never had', () => {
    const noIdNoEnglish = fullLevel(
      buildEligibility({
        hasName: true,
        hasEnglish: false,
        hasSection: true,
        hasId: false,
        hasPlace: true,
      }),
    );
    const steps = walk(noIdNoEnglish);
    // The first demotion drops the time, not a phantom id or english.
    expect(steps[0]?.showTime).toBe(true);
    expect(steps[1]?.showTime).toBe(false);
    expect(steps.every((s) => !s.showId && !s.showEnglish)).toBe(true);
  });
});

describe('sameLevel', () => {
  it('is true only when every field matches', () => {
    const base = fullLevel(allEligible);
    expect(sameLevel(base, { ...base })).toBe(true);
    expect(sameLevel(base, { ...base, showTime: false })).toBe(false);
    expect(sameLevel(base, { ...base, nameLines: 1 })).toBe(false);
  });
});

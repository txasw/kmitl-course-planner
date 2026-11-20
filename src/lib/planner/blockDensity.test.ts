import { describe, it, expect } from 'vitest';
import {
  buildEligibility,
  fullLevel,
  sameLevel,
  nextDensityLevel,
  dropWholeFields,
  nextReclaim,
  type DensityLevel,
  type NameFit,
} from './blockDensity';

const allEligible = buildEligibility({
  hasName: true,
  hasSecondary: true,
  hasSection: true,
  hasId: true,
  hasPlace: true,
});

/** Walk the ladder from a starting level to the terminus, collecting every level. */
function walk(start: DensityLevel, fit?: NameFit): DensityLevel[] {
  const steps: DensityLevel[] = [];
  let level: DensityLevel | null = start;
  while (level !== null) {
    steps.push(level);
    level = nextDensityLevel(level, fit);
  }
  return steps;
}

const bare: DensityLevel = {
  nameLines: 1,
  showSecondary: false,
  showPlace: false,
  showSection: false,
  showTime: false,
  showId: false,
};

describe('buildEligibility', () => {
  it('derives a stable mask that distinguishes field sets', () => {
    const a = buildEligibility({
      hasName: true,
      hasSecondary: false,
      hasSection: true,
      hasId: false,
      hasPlace: true,
    });
    const b = buildEligibility({
      hasName: true,
      hasSecondary: false,
      hasSection: true,
      hasId: false,
      hasPlace: true,
    });
    expect(a.mask).toBe(b.mask);
    expect(a.mask).not.toBe(allEligible.mask);
  });
});

describe('fullLevel', () => {
  it('shows every eligible field with the name in full and the time on', () => {
    expect(fullLevel(allEligible)).toEqual({
      nameLines: 'all',
      showSecondary: true,
      showPlace: true,
      showSection: true,
      showTime: true,
      showId: true,
    });
  });

  it('drops a field the block never had, keeping the name and the time', () => {
    const noSecondaryNoPlace = buildEligibility({
      hasName: true,
      hasSecondary: false,
      hasSection: true,
      hasId: true,
      hasPlace: false,
    });
    expect(fullLevel(noSecondaryNoPlace)).toEqual({
      nameLines: 'all',
      showSecondary: false,
      showPlace: false,
      showSection: true,
      showTime: true,
      showId: true,
    });
  });
});

describe('nextDensityLevel', () => {
  it('walks the inverted drop order, id first and the name last', () => {
    const full = fullLevel(allEligible);
    expect(walk(full)).toEqual([
      full,
      { ...full, showId: false },
      { ...full, showId: false, showSecondary: false },
      { ...full, showId: false, showSecondary: false, showTime: false },
      {
        ...full,
        showId: false,
        showSecondary: false,
        showTime: false,
        nameLines: 2,
      },
      {
        nameLines: 2,
        showSecondary: false,
        showPlace: true,
        showSection: false,
        showTime: false,
        showId: false,
      },
      {
        nameLines: 1,
        showSecondary: false,
        showPlace: true,
        showSection: false,
        showTime: false,
        showId: false,
      },
      bare,
    ]);
  });

  it('never drops the name below one line', () => {
    expect(nextDensityLevel(bare)).toBeNull();
    expect(nextDensityLevel(bare, { lines: 4, excessLines: 9 })).toBeNull();
  });

  it('clamps a full name to the lines that fit in one step', () => {
    // Six rendered lines with two lines of content past the box keep four.
    const level: DensityLevel = { ...bare, nameLines: 'all', showPlace: true };
    expect(nextDensityLevel(level, { lines: 6, excessLines: 2 })).toEqual({
      ...level,
      nameLines: 4,
    });
  });

  it('keeps shedding lines from a clamp still above two', () => {
    const level: DensityLevel = { ...bare, nameLines: 4, showSection: true };
    expect(nextDensityLevel(level, { lines: 4, excessLines: 1 })).toEqual({
      ...level,
      nameLines: 3,
    });
  });

  it('never clamps below two lines while the section chip shows', () => {
    const level: DensityLevel = {
      ...bare,
      nameLines: 'all',
      showSection: true,
    };
    expect(nextDensityLevel(level, { lines: 3, excessLines: 5 })).toEqual({
      ...level,
      nameLines: 2,
    });
  });

  it('sheds at least one line even when the measured excess rounds to none', () => {
    const level: DensityLevel = { ...bare, nameLines: 5 };
    expect(nextDensityLevel(level, { lines: 5, excessLines: 0 })).toEqual({
      ...level,
      nameLines: 4,
    });
  });

  it('falls to two lines when no measurement is passed', () => {
    const level: DensityLevel = { ...bare, nameLines: 'all' };
    expect(nextDensityLevel(level)).toEqual({ ...level, nameLines: 2 });
  });

  it('clamps the name only after the time drops', () => {
    // The time is redundant on a positioned block, so it goes before the name loses a line.
    const steps = walk(fullLevel(allEligible), { lines: 5, excessLines: 1 });
    const timeDropped = steps.findIndex((s) => !s.showTime);
    const nameClamped = steps.findIndex((s) => s.nameLines !== 'all');
    expect(timeDropped).toBeGreaterThanOrEqual(0);
    expect(nameClamped).toBeGreaterThan(timeDropped);
  });

  it('keeps the place alive past the name second line', () => {
    // Binding constraint: a one line ellipsized name still identifies the course while a lost
    // room is unrecoverable, so the name must reduce to one line before the place drops.
    const steps = walk(fullLevel(allEligible), { lines: 4, excessLines: 1 });
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

  it('drops the subject id first on an edit block', () => {
    // An edit block ignores the display options: it always carries the id, the section, and
    // the place, and never a secondary name, so its first rung is the id and its second the
    // time (ADR-0050).
    const edit = buildEligibility({
      hasName: true,
      hasSecondary: false,
      hasSection: true,
      hasId: true,
      hasPlace: true,
    });
    const steps = walk(fullLevel(edit));
    expect(steps.map((s) => s.showId)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(steps[1]).toEqual({ ...fullLevel(edit), showId: false });
    expect(steps[2]?.showTime).toBe(false);
    expect(steps.at(-1)).toEqual(bare);
  });

  it('skips a rung for a field the block never had', () => {
    const noIdNoSecondary = fullLevel(
      buildEligibility({
        hasName: true,
        hasSecondary: false,
        hasSection: true,
        hasId: false,
        hasPlace: true,
      }),
    );
    const steps = walk(noIdNoSecondary);
    // The first demotion drops the time, not a phantom id or secondary name.
    expect(steps[0]?.showTime).toBe(true);
    expect(steps[1]?.showTime).toBe(false);
    expect(steps.every((s) => !s.showId && !s.showSecondary)).toBe(true);
  });
});

describe('sameLevel', () => {
  it('is true only when every field matches', () => {
    const base = fullLevel(allEligible);
    expect(sameLevel(base, { ...base })).toBe(true);
    expect(sameLevel(base, { ...base, showTime: false })).toBe(false);
    expect(sameLevel(base, { ...base, nameLines: 1 })).toBe(false);
    expect(
      sameLevel({ ...base, nameLines: 3 }, { ...base, nameLines: 2 }),
    ).toBe(false);
  });
});

describe('dropWholeFields', () => {
  it('drops a subject id too wide for its line whole and keeps every other field', () => {
    const full = fullLevel(allEligible);
    expect(dropWholeFields(full, ['id'])).toEqual({ ...full, showId: false });
  });

  it('drops the time whole out of ladder order, ahead of the secondary name', () => {
    const full = fullLevel(allEligible);
    const dropped = dropWholeFields(full, ['time']);
    expect(dropped.showTime).toBe(false);
    expect(dropped.showSecondary).toBe(true);
    expect(dropped.showId).toBe(true);
  });

  it('never brings back a field that was already absent', () => {
    expect(dropWholeFields(bare, [])).toEqual(bare);
    expect(dropWholeFields(bare, ['id', 'time'])).toEqual(bare);
  });
});

describe('nextReclaim', () => {
  it('offers the dropped top rungs back in priority order, each once', () => {
    const level = { ...fullLevel(allEligible), nameLines: 2 as const };
    const dropped = {
      ...level,
      showTime: false,
      showSecondary: false,
      showId: false,
    };
    const first = nextReclaim(dropped, allEligible, []);
    expect(first?.field).toBe('time');
    expect(first?.level.showTime).toBe(true);
    expect(nextReclaim(dropped, allEligible, ['time'])?.field).toBe(
      'secondary',
    );
    expect(
      nextReclaim(dropped, allEligible, ['time', 'secondary'])?.field,
    ).toBe('id');
    expect(
      nextReclaim(dropped, allEligible, ['time', 'secondary', 'id']),
    ).toBeNull();
  });

  it('never offers a field the block is not eligible for or already shows', () => {
    const noSecondary = buildEligibility({
      hasName: true,
      hasSecondary: false,
      hasSection: true,
      hasId: true,
      hasPlace: true,
    });
    const level = { ...fullLevel(noSecondary), showId: false };
    expect(nextReclaim(level, noSecondary, [])?.field).toBe('id');
    expect(nextReclaim(fullLevel(noSecondary), noSecondary, [])).toBeNull();
  });

  it('offers only fields the ladder drops first while shown, so an overflow undoes it', () => {
    // Each offered level demotes straight back to the level it came from.
    const settled = {
      ...fullLevel(allEligible),
      showTime: false,
      showSecondary: false,
      showId: false,
      nameLines: 2 as const,
    };
    let tried: ('time' | 'secondary' | 'id')[] = [];
    for (
      let offer = nextReclaim(settled, allEligible, tried);
      offer !== null;
    ) {
      expect(nextDensityLevel(offer.level)).toEqual(settled);
      tried = [...tried, offer.field];
      offer = nextReclaim(settled, allEligible, tried);
    }
    expect(tried).toEqual(['time', 'secondary', 'id']);
  });

  it('never offers a field back once the walk dropped the place, so the time never outlives it', () => {
    // A short block whose place wrapped walked past every rung to the bare one line name.
    const placeDropped = { ...bare, showPlace: false };
    expect(allEligible.hasPlace).toBe(true);
    expect(nextReclaim(placeDropped, allEligible, [])).toBeNull();
    expect(nextReclaim(placeDropped, allEligible, ['time'])).toBeNull();
  });

  it('never offers a field back while the section chip ranked above it stays hidden', () => {
    const chipDropped = {
      ...fullLevel(allEligible),
      nameLines: 2 as const,
      showSection: false,
      showTime: false,
      showSecondary: false,
      showId: false,
    };
    expect(nextReclaim(chipDropped, allEligible, [])).toBeNull();
  });

  it('still offers fields back when the place and chip are absent only by eligibility', () => {
    const noPlaceOrChip = buildEligibility({
      hasName: true,
      hasSecondary: true,
      hasSection: false,
      hasId: true,
      hasPlace: false,
    });
    const level = { ...fullLevel(noPlaceOrChip), showTime: false };
    expect(nextReclaim(level, noPlaceOrChip, [])?.field).toBe('time');
  });
});

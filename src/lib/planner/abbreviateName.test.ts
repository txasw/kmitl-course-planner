import { describe, expect, it } from 'vitest';
import { abbreviationSteps } from './abbreviateName';

describe('abbreviationSteps', () => {
  const name = 'INTRODUCTION TO COMPUTER PROGRAMMING FOR ENGINEERS';

  it('shortens the longest words first, one letter at a time', () => {
    const steps = abbreviationSteps(name);
    // PROGRAMMING at a cap of ten would read as long as itself, so the first form cuts only
    // INTRODUCTION, back past the I it would end on, and the next reaches PROGRAMMING.
    expect(steps[0]).toBe('INTRODUCT. TO COMPUTER PROGRAMMING FOR ENGINEERS');
    expect(steps[1]).toBe('INTRODUCT. TO COMPUTER PROGRAMM. FOR ENGINEERS');
  });

  it('reaches a printed abbreviation at a cap of four', () => {
    expect(abbreviationSteps(name)).toContain('INTR. TO COMP. PROG. FOR ENG.');
  });

  it('ends at two letters a word', () => {
    expect(abbreviationSteps(name).at(-1)).toBe('IN. TO CO. PR. FOR EN.');
  });

  it('makes every form shorter than the one before it', () => {
    const steps = abbreviationSteps(name);
    expect(steps.length).toBeGreaterThan(3);
    let previous = name;
    for (const step of steps) {
      expect(step.length).toBeLessThan(previous.length);
      previous = step;
    }
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('keeps every word in its place', () => {
    for (const step of abbreviationSteps(name)) {
      expect(step.split(' ')).toHaveLength(name.split(' ').length);
    }
  });

  it('keeps words of three letters or fewer and the longer joiners whole', () => {
    const steps = abbreviationSteps('DESIGN WITH DATA AND THE WEB II');
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step).toMatch(/ WITH /);
      expect(step).toMatch(/ AND THE WEB II$/);
    }
  });

  it('cuts back past a vowel, as a printed abbreviation does', () => {
    expect(abbreviationSteps('COMPUTER')).toContain('COMP.');
    expect(abbreviationSteps('COMPUTER')).not.toContain('COMPU.');
  });

  it('keeps two letters where the cut would leave fewer', () => {
    expect(abbreviationSteps('AEROSPACE').at(-1)).toBe('AE.');
  });

  it('cuts a word only where the cut form is shorter', () => {
    // LOGIC at a cap of four would read LOGI., as long as LOGIC, so it needs a cap of three.
    expect(abbreviationSteps('LOGIC')).toEqual(['LOG.', 'LO.']);
    expect(abbreviationSteps('CODE OF LAW')).toEqual(['CO. OF LAW']);
  });

  it('cuts words inside punctuation and hyphens', () => {
    const steps = abbreviationSteps('PRE-ENGINEERING (ENGLISH), MATHEMATICS');
    expect(steps.at(-1)).toBe('PRE-EN. (EN.), MA.');
  });

  it('keeps an inner apostrophe with its word', () => {
    expect(abbreviationSteps("WOMEN'S STUDIES").at(-1)).toBe('WO. ST.');
  });

  it('reads mixed case names', () => {
    expect(abbreviationSteps('Calculus for Engineers')).toContain(
      'Calc. for Eng.',
    );
  });

  it('has no forms for a name with a Thai letter', () => {
    expect(abbreviationSteps('การเขียนโปรแกรมคอมพิวเตอร์')).toEqual([]);
    expect(abbreviationSteps('การประมวลผล EDGE COMPUTING')).toEqual([]);
  });

  it('has no forms for a name the rule cannot cut', () => {
    expect(abbreviationSteps('')).toEqual([]);
    expect(abbreviationSteps('ART OF WAR')).toEqual([]);
    expect(abbreviationSteps('90592033')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import shape from '../../../tests/fixtures/host/pre-regis.shape.json';
import {
  CREDIT_RANGE,
  CREDIT_TOTAL,
  HOST_LABELS,
  LIST_HEADER_CLASSES,
  SCRIPT_NAME,
  SECTION_LABEL,
  TERM_TEXT,
  hostPair,
  isLabel,
  isTestedBuild,
  isTestedVendor,
  rowColour,
} from './hostContract';

// The contract against the shape fixture: the keys, classes, and labels of the tested
// host build. A host change that renames a label or a class shows up as a diff here.

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

const LANGS = [shape.labels.th, shape.labels.en];

describe('the host contract', () => {
  it('gates on the tested build only', () => {
    expect(isTestedBuild([shape.build.app, shape.build.vendors])).toBe(true);
    expect(isTestedBuild([shape.build.app])).toBe(false);
    expect(isTestedBuild(['app.00000000.js', shape.build.vendors])).toBe(false);
  });

  it('gates on the 2026-11-25 redeploy, whose pre registration page is the same', () => {
    expect(
      isTestedBuild(['chunk-vendors.7ab4925e.js', 'app.020e81ed.js']),
    ).toBe(true);
    expect(isTestedBuild(['app.020e81ed.js'])).toBe(false);
    expect(
      isTestedBuild(['app.020e81ed.js', 'chunk-vendors.00000000.js']),
    ).toBe(false);
  });

  it('gates on the polling route of 2026-11-25 09:53 GMT', () => {
    expect(
      isTestedBuild(['chunk-vendors.7ab4925e.js', 'app.a1e43722.js']),
    ).toBe(true);
    expect(isTestedBuild(['app.a1e43722.js'])).toBe(false);
    expect(
      isTestedBuild(['app.a1e43722.js', 'chunk-vendors.00000000.js']),
    ).toBe(false);
  });

  it.each(LANGS)('carries the host labels of each language', (labels) => {
    const pairs: [readonly string[], string][] = [
      [
        HOST_LABELS.addHeading,
        labels['pre_regis_add_subject.list_subject_need_to_regis'],
      ],
      [HOST_LABELS.early, `(${labels['pre_regis_add_subject.early']})`],
      [HOST_LABELS.early, labels['pre_regis_complete.early']],
      [HOST_LABELS.practiceRow, labels['pre_regis_add_subject.practice']],
      [
        HOST_LABELS.gradeDialog,
        labels['pre_regis_add_subject.grade_not_release'],
      ],
      [
        HOST_LABELS.confirmDialog,
        labels['pre_regis_add_subject.one_time_registration'],
      ],
      [
        HOST_LABELS.toastPrefix,
        labels['pre_regis_add_subject.error_in_taking_this_course'],
      ],
      [
        HOST_LABELS.alreadyListed,
        labels['pre_regis_add_subject.already_in_list'],
      ],
      [
        HOST_LABELS.submitted,
        labels['pre_regis_add_subject.pre_registration_complete'],
      ],
      [
        HOST_LABELS.creditRange,
        labels['pre_regis_add_subject.credits_that_student_can_take'],
      ],
      [
        HOST_LABELS.creditTotal,
        labels['pre_regis_add_subject.all_registered_credits'],
      ],
      [
        HOST_LABELS.resultHeading,
        labels['pre_regis_complete.list_of_registered_subjects'],
      ],
      [
        HOST_LABELS.violateCondition,
        labels['pre_regis_complete.can_not_register_violate_condition'],
      ],
      [HOST_LABELS.term, labels['pre_regis_panel.semester']],
      [HOST_LABELS.lectureChip, labels['lect_or_prac_chip.lecture']],
      [HOST_LABELS.practiceChip, labels['lect_or_prac_chip.practice']],
    ];
    for (const [set, label] of pairs) expect(set).toContain(label);
    expect(HOST_LABELS.steps).toContainEqual(labels.pre_regis_stepper);
  });

  it('holds only the two button labels a fill presses, never Continue', () => {
    const { addButton, acknowledge, continueAnchor, ...read } = HOST_LABELS;
    const all: string[] = Object.values(read).flat(2);
    for (const labels of LANGS) {
      for (const button of [
        labels['pre_regis_add_subject.add'],
        labels['pre_regis_add_subject.continuous'],
        labels['pre_regis_add_subject.roger'],
      ]) {
        expect(all).not.toContain(button);
      }
      expect(continueAnchor).toContain(
        labels['pre_regis_add_subject.continuous'],
      );
      expect(addButton).toContain(labels['pre_regis_add_subject.add']);
      expect(acknowledge).toContain(labels['pre_regis_add_subject.roger']);
    }
    expect([...addButton, ...acknowledge]).not.toContain('ดำเนินการต่อ');
  });

  it('matches the list header classes and the row colours', () => {
    LIST_HEADER_CLASSES.forEach((name, index) => {
      const classes = shape.classes.listHeader[index]?.split(' ') ?? [];
      if (name !== null) expect(classes).toContain(name);
    });
    expect(rowColour(rgb(shape.rowColours.fits))).toBe('fits');
    expect(rowColour(rgb(shape.rowColours.clash))).toBe('clash');
    expect(rowColour(rgb(shape.rowColours.pending))).toBe('pending');
    expect(rowColour('rgb(0, 0, 0)')).toBeUndefined();
  });

  it('reads section labels and the term column by their grammar', () => {
    expect(SECTION_LABEL.exec('101 (CE)')?.slice(1)).toEqual(['101', 'CE']);
    expect(SECTION_LABEL.exec('1')?.slice(1)).toEqual(['1', undefined]);
    expect(SECTION_LABEL.test('1, 2')).toBe(false);
    expect(TERM_TEXT.exec('ภาคการศึกษาที่ : 2 / 2569')?.slice(1)).toEqual([
      '2',
      '2569',
    ]);
    expect(TERM_TEXT.test('รหัสนักศึกษา : 65010001')).toBe(false);
  });

  it('reads the credit lines, with the ends unset before the host loads them', () => {
    expect(CREDIT_RANGE.exec(': 9 - 22')?.slice(1)).toEqual(['9', '22']);
    expect(CREDIT_RANGE.exec(': -')?.slice(1)).toEqual([undefined, undefined]);
    expect(CREDIT_RANGE.exec(': NaN - NaN')?.slice(1)).toEqual(['NaN', 'NaN']);
    expect(CREDIT_TOTAL.exec(': 18')?.[1]).toBe('18');
    expect(CREDIT_TOTAL.test(': 18 (x)')).toBe(false);
  });

  it('names the host scripts and matches labels exactly after trimming', () => {
    expect(SCRIPT_NAME.test(shape.build.app)).toBe(true);
    expect(SCRIPT_NAME.test('app.454d9e95.js.map')).toBe(false);
    expect(isLabel('  ทฤษฎี ', HOST_LABELS.lectureChip)).toBe(true);
    expect(isLabel('ทฤษฎี 1', HOST_LABELS.lectureChip)).toBe(false);
    expect(isLabel(null, HOST_LABELS.lectureChip)).toBe(false);
  });
});

describe('the page build pair', () => {
  it('reads one app and one vendor script name', () => {
    expect(
      hostPair(['chunk-vendors.7ab4925e.js', 'app.c0ffee01.js', 'main.js']),
    ).toEqual({ app: 'app.c0ffee01.js', vendors: 'chunk-vendors.7ab4925e.js' });
    expect(
      hostPair([
        'app.c0ffee01.js',
        'app.c0ffee01.js',
        'chunk-vendors.7ab4925e.js',
      ]),
    ).toEqual({
      app: 'app.c0ffee01.js',
      vendors: 'chunk-vendors.7ab4925e.js',
    });
  });

  it('reads no pair from a page with two app scripts or none of either', () => {
    expect(
      hostPair([
        'app.c0ffee01.js',
        'app.c0ffee02.js',
        'chunk-vendors.7ab4925e.js',
      ]),
    ).toBeNull();
    expect(hostPair(['app.c0ffee01.js'])).toBeNull();
    expect(hostPair(['chunk-vendors.7ab4925e.js'])).toBeNull();
  });

  it('knows the vendor script KCP was tested with', () => {
    expect(isTestedVendor('chunk-vendors.7ab4925e.js')).toBe(true);
    expect(isTestedVendor('chunk-vendors.00000000.js')).toBe(false);
  });
});

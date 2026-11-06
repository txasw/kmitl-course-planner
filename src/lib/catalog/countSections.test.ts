import { describe, expect, it } from 'vitest';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { countSections } from './countSections';

describe('countSections', () => {
  it('sums the sections of every course', () => {
    const one = makeCourse({
      subjectId: '90000001',
      sections: [makeSection({ teachTableId: 'a' })],
    });
    const two = makeCourse({
      subjectId: '90000002',
      sections: [
        makeSection({ teachTableId: 'b' }),
        makeSection({ teachTableId: 'c' }),
      ],
    });
    expect(countSections([one, two])).toBe(3);
  });

  it('counts nothing for an empty result', () => {
    expect(countSections([])).toBe(0);
  });
});

import { describe, it, expectTypeOf } from 'vitest';
import type { Seats, Enrolled, Meeting, Section, Course } from './types';

// Type level checks that document the shape refinements. These have no runtime
// behaviour; they fail the build if the entity contracts drift.
describe('domain type contracts', () => {
  it('models an uncapped limit as number or null', () => {
    expectTypeOf<Seats['limit']>().toEqualTypeOf<number | null>();
  });

  it('models enrolled as a count or the full discriminant', () => {
    expectTypeOf<Enrolled>().toEqualTypeOf<number | 'full'>();
  });

  it('keeps meetings, sections, and courses structurally distinct', () => {
    expectTypeOf<Meeting>().toHaveProperty('startMin');
    expectTypeOf<Section>().toHaveProperty('pairedSection');
    expectTypeOf<Course>().toHaveProperty('sections');
  });
});

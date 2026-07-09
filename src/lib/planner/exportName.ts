// The shared base for a plan's export file names, without an extension. The plan
// name is slugged and falls back to the durable plan id when the name has no file
// safe characters, so an exported PNG or JSON always has a stable, non empty name.

import type { Plan } from '../domain/plan';
import { slug } from '../utils/slug';

/** `kmitl-plan-{year}-{semester}-{slug(name) or id}` for a plan's export files. */
export function planExportBaseName(
  plan: Pick<Plan, 'id' | 'name' | 'year' | 'semester'>,
): string {
  const named = slug(plan.name);
  return `kmitl-plan-${plan.year}-${plan.semester}-${named === '' ? plan.id : named}`;
}

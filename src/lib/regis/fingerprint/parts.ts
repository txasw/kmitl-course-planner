// The parts of the host bundle the registration companion depends on, and the canonical
// text of each (ADR-0079): the page components, the grade not announced dialog, the
// period check, the API client, every method that names a registration write endpoint,
// the store, the module setup, and the labels. The host's message catalogs, its store,
// and each other part are boundaries: a part that reaches one names it and does not
// follow it, so a change shows in the part it belongs to.

import {
  catalogNames,
  clientSpan,
  enclosingMethod,
  gradeDialogSpan,
  locateComponent,
  periodMixins,
  storeNames,
  text,
  type Component,
} from './locate.ts';
import {
  canonicalText,
  type Boundary,
  type Bundle,
  type ModuleScope,
} from './module.ts';
import { COMPONENT_PARTS, type ComponentPart, type PartId } from './partIds.ts';
import { setupBoundary, setupRoots, storeSpan } from './setup.ts';

export interface LocatedParts {
  module: ModuleScope;
  /** The canonical text of each part found; a part not found is left out. */
  texts: Partial<Record<Exclude<PartId, 'labels'>, string>>;
  /** The names of the host's two message catalogs, for the label part. */
  catalogs: string[];
}

/**
 * The canonical text of every part KCP can find in the bundle, or null when the page
 * components do not share one module scope or the message catalogs cannot be told apart.
 */
export function locateParts(
  bundle: Bundle,
  writes: readonly number[],
): LocatedParts | null {
  const components = new Map<ComponentPart, Component>();
  for (const [part, name] of Object.entries(COMPONENT_PARTS) as [
    ComponentPart,
    string,
  ][]) {
    const found = locateComponent(bundle, name);
    if (found !== null) components.set(part, found);
  }
  const route = components.get('route') ?? components.get('addSubject');
  if (route === undefined) return null;
  const { module } = route;
  for (const component of components.values()) {
    if (component.module.body !== module.body) return null;
  }
  const catalogs = catalogNames(bundle, module);
  if (catalogs === null) return null;
  const shared = new Map<string, string>();
  for (const name of catalogs) shared.set(name, 'catalog');
  const stores = storeNames(bundle, module);
  for (const name of stores) shared.set(name, 'store');
  const boundaryFor = (own: ComponentPart | null): Boundary => {
    const boundary = new Map(shared);
    for (const [part, component] of components) {
      if (part === own) continue;
      for (const name of component.names) boundary.set(name, part);
    }
    return boundary;
  };
  const texts: LocatedParts['texts'] = {};
  const write = (part: Exclude<PartId, 'labels'>, value: string | null) => {
    if (value !== null) texts[part] = value;
  };
  for (const [part, component] of components) {
    write(
      part,
      canonicalText(bundle, module, [component.call], boundaryFor(part)),
    );
  }
  const render = components.get('addSubject')?.render ?? null;
  const dialog = render === null ? null : gradeDialogSpan(bundle, render);
  if (dialog !== null && render !== null) {
    write(
      'gradeDialog',
      canonicalText(bundle, module, [dialog], boundaryFor(null), render),
    );
  }
  const mixins = periodMixins(bundle, components.get('route'));
  if (mixins.length > 0) {
    write(
      'periodCheck',
      canonicalText(bundle, module, mixins, boundaryFor(null)),
    );
  }
  const client = clientSpan(bundle, module);
  if (client !== null)
    write('client', canonicalText(bundle, module, [client], boundaryFor(null)));
  write('writes', writesText(bundle, module, writes, boundaryFor(null)));
  const store = storeSpan(module, stores);
  if (store !== null)
    write('store', canonicalText(bundle, module, [store], boundaryFor(null)));
  const pages = new Set<string>();
  for (const component of components.values()) {
    for (const name of component.names) pages.add(name);
  }
  const setup = setupRoots(bundle, module, pages);
  if (setup.roots.length > 0) {
    write(
      'setup',
      canonicalText(
        bundle,
        module,
        setup.roots,
        setupBoundary(boundaryFor(null), setup),
      ),
    );
  }
  return { module, texts, catalogs };
}

/** Each method that names a registration write endpoint, sorted, as one text. */
function writesText(
  bundle: Bundle,
  module: ModuleScope,
  writes: readonly number[],
  boundary: Boundary,
): string | null {
  const entries: string[] = [];
  for (const index of writes) {
    const method = enclosingMethod(bundle, index);
    const canonical =
      method === null
        ? null
        : canonicalText(bundle, module, [method], boundary);
    if (canonical === null) return null;
    entries.push(`${text(bundle, index)}\n${canonical}`);
  }
  return entries.sort().join('\n\n');
}

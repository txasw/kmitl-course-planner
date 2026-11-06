// Whether a catalog row or course header may start a pointer drag. Below 640 px the
// catalog and the timetable are separate panes (ADR-0048), so a drag that starts in the
// catalog has no visible grid to land on: the hidden timetable pane still holds its drop
// zone at the same place, and a drop there would commit an add the student never saw.
// The catalog column provides the value once for every source in it, so the hundreds of
// rows read one context instead of each subscribing to a media query. The grip and the
// add buttons stay, so an add is always one press away. Without a provider, as in a
// component test, drag stays on.

import { createContext, useContext } from 'react';

export const CatalogDragContext = createContext(true);

export function useCatalogDragEnabled(): boolean {
  return useContext(CatalogDragContext);
}

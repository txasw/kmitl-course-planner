// A slot for the toast region's bottom offset, which a layer outside the shared shell
// fills while it needs the region raised. The registration helper publishes here how far
// above the screen foot a toast must float to clear its card or launcher on a phone. The
// toast region never imports that layer: it reads the offset here, and where nothing
// publishes, as in the web app, the slot stays empty and the region keeps its own place.

import { createStore } from 'zustand/vanilla';

interface ToastFloorStore {
  /** The region's bottom offset in pixels, or null while no layer raises it. */
  floor: number | null;
  setFloor: (floor: number | null) => void;
}

export const toastFloorStore = createStore<ToastFloorStore>((set) => ({
  floor: null,
  setFloor: (floor) => {
    set({ floor });
  },
}));

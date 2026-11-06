// Locks scrolling of the host document while a modal layer is open: the overlay, or the
// welcome shown after install. This is the single intentional side effect the
// extension has on the host page. The locks are counted, so two layers that hold the
// lock at once, as when the welcome closes in the same commit the overlay opens, leave
// the host locked until the last one lets go, whichever order they release in. The
// first lock saves the host's own inline overflow value and the last release restores
// it, so closing every layer or unmounting leaves the host exactly as it was.

import { useEffect } from 'react';

let holders = 0;
let saved = '';

function acquire(): void {
  const root = document.documentElement;
  if (holders === 0) {
    saved = root.style.overflow;
    root.style.overflow = 'hidden';
  }
  holders += 1;
}

function release(): void {
  holders -= 1;
  if (holders === 0) {
    document.documentElement.style.overflow = saved;
  }
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active]);
}

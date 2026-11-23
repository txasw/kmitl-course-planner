// Mounts the read only observer and the banner it feeds on the pre registration page.

import { ConfirmBanner } from './ConfirmBanner';
import { useHostObserver } from './useHostObserver';

export function HostObserverLayer() {
  useHostObserver();
  return <ConfirmBanner />;
}

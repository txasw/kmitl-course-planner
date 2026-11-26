// Mounts, in debug builds only, the line that says which parts of the host's app script
// the host check found changed (ADR-0079). The guard reads __KCP_DEBUG__ directly, as
// DiagnosticsGate does, so production drops the dynamic import, the module, and its
// canary, and renders nothing here.

import { useEffect, useState, type ComponentType } from 'react';

export function HostCheckDetailGate() {
  const [Detail, setDetail] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (__KCP_DEBUG__) {
      let active = true;
      void import('@/features/diagnostics/HostCheckDetail').then((module) => {
        if (active) setDetail(() => module.HostCheckDetail);
      });
      return () => {
        active = false;
      };
    }
    return undefined;
  }, []);

  return Detail ? <Detail /> : null;
}

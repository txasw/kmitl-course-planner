// Mounts the diagnostics drawer only in debug builds. The dynamic import sits
// inside an IS_DEBUG guard that is a literal false in production, so the bundler
// eliminates the branch and the entire diagnostics chunk, with its canary, never
// ships. Production renders nothing here and answers no debug message. This is a
// production module: it imports no diagnostics code statically, only through the
// eliminated dynamic import.

import { useEffect, useState, type ComponentType } from 'react';
import { IS_DEBUG } from '@/lib/env';

export function DiagnosticsGate() {
  const [Diagnostics, setDiagnostics] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (IS_DEBUG) {
      let active = true;
      void import('@/features/diagnostics/Diagnostics').then((module) => {
        if (active) {
          setDiagnostics(() => module.Diagnostics);
        }
      });
      return () => {
        active = false;
      };
    }
    return undefined;
  }, []);

  return Diagnostics ? <Diagnostics /> : null;
}

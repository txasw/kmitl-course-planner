// Mounts the diagnostics drawer only in debug builds. The dynamic import sits
// inside a guard that is a literal false in production, so the bundler
// eliminates the branch and the entire diagnostics chunk, with its canary, never
// ships. Production renders nothing here and answers no debug message. This is a
// production module: it imports no diagnostics code statically, only through the
// eliminated dynamic import.
//
// The guard reads __KCP_DEBUG__ directly rather than IS_DEBUG. The define is
// replaced inside this module before the bundler scans its imports, so the
// dynamic import never enters the content script graph. Through the imported
// IS_DEBUG binding the edge was seen first and folded away only later, and the
// single file content script build then wrapped every module shared with the
// drawer in a lazy initializer that tree shaking could not remove.

import { useEffect, useState, type ComponentType } from 'react';
import type { TypedSend } from '@/lib/messaging/sendTyped';

interface DiagnosticsGateProps {
  /** The extension send, since the drawer's messages are outside the core protocol. */
  send: TypedSend;
}

export function DiagnosticsGate({ send }: DiagnosticsGateProps) {
  const [Diagnostics, setDiagnostics] = useState<ComponentType<{
    send: TypedSend;
  }> | null>(null);

  useEffect(() => {
    if (__KCP_DEBUG__) {
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

  return Diagnostics ? <Diagnostics send={send} /> : null;
}

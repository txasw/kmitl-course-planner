// Compile time build flavor flag, defined by Vite in wxt.config.ts. Reads of
// this value dead code eliminate from production output. Runtime code should
// import IS_DEBUG from src/lib/env.ts rather than reference this directly, except
// a guard around a content script dynamic import, which must read the define so
// the import leaves the module graph (see DiagnosticsGate.tsx).
declare const __KCP_DEBUG__: boolean;

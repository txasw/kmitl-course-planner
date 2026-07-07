// Compile time build flavor flag, defined by Vite in wxt.config.ts. Reads of
// this value dead code eliminate from production output. Runtime code should
// import IS_DEBUG from src/lib/env.ts rather than reference this directly.
declare const __KCP_DEBUG__: boolean;

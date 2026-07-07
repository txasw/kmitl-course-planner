// Runtime read of the compile time build flavor flag. The bundler inlines
// __KCP_DEBUG__ as a boolean literal, so debug only code paths guarded by
// IS_DEBUG dead code eliminate from production output.
export const IS_DEBUG = __KCP_DEBUG__;

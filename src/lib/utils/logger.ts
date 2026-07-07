// The gateway and router route all diagnostics through this logger. It is the
// single module permitted to call the console (enforced by an eslint override),
// and it no ops in production so no diagnostic output ships to users. The
// implementation is chosen by a top level ternary on the build mode, so the dev
// logger dead code eliminates from the production bundle.

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const PREFIX = '[KCP]';

const noop = (): void => undefined;

/** A logger that discards every call. This is the production implementation. */
export const NOOP_LOGGER: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

function createDevLogger(): Logger {
  return {
    debug: (...args) => {
      console.debug(PREFIX, ...args);
    },
    info: (...args) => {
      console.info(PREFIX, ...args);
    },
    warn: (...args) => {
      console.warn(PREFIX, ...args);
    },
    error: (...args) => {
      console.error(PREFIX, ...args);
    },
  };
}

export const logger: Logger =
  import.meta.env.MODE === 'production' ? NOOP_LOGGER : createDevLogger();

import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger, NOOP_LOGGER } from './logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discards every call through the no-op logger', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    NOOP_LOGGER.info('ignored', 1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards to the console with a stable prefix outside production', () => {
    // Vitest runs in a non production mode, so the exported logger is the dev
    // implementation.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('hello', 42);
    expect(spy).toHaveBeenCalledWith('[KCP]', 'hello', 42);
  });
});

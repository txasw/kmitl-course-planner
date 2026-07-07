import { afterEach, describe, expect, it } from 'vitest';
import {
  getAudit,
  getRecorder,
  getSimulation,
  resetInterceptors,
  setAudit,
  setRecorder,
  setSimulation,
} from './interceptors';

describe('interceptor registry', () => {
  afterEach(() => {
    resetInterceptors();
  });

  it('defaults every slot to null', () => {
    expect(getSimulation()).toBeNull();
    expect(getAudit()).toBeNull();
    expect(getRecorder()).toBeNull();
  });

  it('returns whatever was registered', () => {
    const simulation = { intercept: () => null };
    const audit = { observe: () => undefined };
    const recorder = { record: () => undefined };
    setSimulation(simulation);
    setAudit(audit);
    setRecorder(recorder);
    expect(getSimulation()).toBe(simulation);
    expect(getAudit()).toBe(audit);
    expect(getRecorder()).toBe(recorder);
  });

  it('clears every slot on reset', () => {
    setSimulation({ intercept: () => null });
    resetInterceptors();
    expect(getSimulation()).toBeNull();
  });
});

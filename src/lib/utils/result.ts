// The sealed error taxonomy and the Result type used across the domain layer.
//
// Errors are tagged plain objects rather than Error subclasses so they survive
// structured clone across the runtime messaging boundary without losing their
// prototype. Every fallible operation returns a Result instead of throwing, so
// no raw exception ever crosses a module or worker boundary.

/** One field level problem discovered while validating an untrusted shape. */
export interface ValidationIssue {
  /** Dotted path to the offending value, for example `rows[3].teach_time`. */
  readonly path: string;
  readonly message: string;
}

export interface NetworkError {
  readonly kind: 'network';
  readonly message: string;
}

export interface TimeoutError {
  readonly kind: 'timeout';
  readonly message: string;
}

export interface HttpError {
  readonly kind: 'http';
  readonly status: number;
  readonly message: string;
  /** Per field error lists parsed from a 4xx validation body, when the server
   * sent one, for example a subject id length rejection. Absent otherwise. */
  readonly fields?: Readonly<Record<string, readonly string[]>>;
}

export interface ValidationError {
  readonly kind: 'validation';
  readonly issues: readonly ValidationIssue[];
  readonly message: string;
}

export interface StorageError {
  readonly kind: 'storage';
  readonly message: string;
}

export interface UnknownError {
  readonly kind: 'unknown';
  readonly message: string;
}

/** The closed set of errors any gateway or repository operation can return. */
export type ApiError =
  | NetworkError
  | TimeoutError
  | HttpError
  | ValidationError
  | StorageError
  | UnknownError;

/** A success carrying a value, or a failure carrying a typed error. */
export type Result<T, E = ApiError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

export function networkError(message: string): NetworkError {
  return { kind: 'network', message };
}

export function timeoutError(message: string): TimeoutError {
  return { kind: 'timeout', message };
}

export function httpError(
  status: number,
  message: string,
  fields?: Readonly<Record<string, readonly string[]>>,
): HttpError {
  return fields === undefined
    ? { kind: 'http', status, message }
    : { kind: 'http', status, message, fields };
}

export function validationError(
  issues: readonly ValidationIssue[],
  message = 'Response failed schema validation',
): ValidationError {
  return { kind: 'validation', issues, message };
}

export function storageError(message: string): StorageError {
  return { kind: 'storage', message };
}

export function unknownError(message: string): UnknownError {
  return { kind: 'unknown', message };
}

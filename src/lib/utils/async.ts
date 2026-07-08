// The lifecycle of a value fetched through the gateway, used by every async
// surface so the UI renders exactly one of loading, error, ready, or the initial
// idle state. It is a type only module: the states are plain object literals at
// the call site, so there is no runtime to test.

import type { ApiError } from './result';

export type AsyncState<T, E = ApiError> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: E }
  | { readonly status: 'ready'; readonly data: T };

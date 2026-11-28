// The extension's whole message protocol: the core messages every program shares,
// composed with the host check and the debug namespace. The background router validates against this
// schema and the content side sends over this union, while a program that carries only
// the core messages imports the core protocol alone.

import { z } from 'zod';
import { coreRequestMessageSchema, type CoreResponseMap } from './protocol';
import {
  hostBuildRequestSchema,
  type RegisResponseMap,
} from '../regis/protocol';
import { debugRequestSchema, type DebugResponseMap } from './debugTypes';

export const requestMessageSchema = z.discriminatedUnion('type', [
  ...coreRequestMessageSchema.options,
  hostBuildRequestSchema,
  ...debugRequestSchema.options,
]);

export type RequestMessage = z.infer<typeof requestMessageSchema>;

/** The response payload each request type resolves to, keyed by discriminant. */
export interface ResponseMap
  extends CoreResponseMap, RegisResponseMap, DebugResponseMap {}

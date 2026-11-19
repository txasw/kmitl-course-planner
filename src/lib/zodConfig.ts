import { z } from 'zod';

// Zod can compile a faster object parser with the Function constructor, and the first
// object schema it builds checks whether that works by calling the constructor inside a
// try block. The extension content security policy forbids it, so the check always fails
// and the interpreted parser runs anyway, but the failed call can still be reported as a
// policy violation. Jitless mode skips the check and keeps the interpreted parser, so the
// shipped code never reaches the Function constructor. The check runs when the first
// object schema is built, which happens at module load, so this module is the first
// import of every entrypoint, ahead of any module that declares a schema.
z.config({ jitless: true });

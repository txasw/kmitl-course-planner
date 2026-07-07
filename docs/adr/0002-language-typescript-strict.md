# 2. Language: TypeScript strict

Status: Accepted
Date: 2026-07-07

## Context

The extension parses untrusted network data and stores user plans. Type errors
in that path would surface as broken schedules. The project requires a high bar
on correctness from the first commit.

## Decision

Use TypeScript in strict mode with additional safety flags, including
noUncheckedIndexedAccess, exactOptionalPropertyTypes, and verbatimModuleSyntax,
layered on top of the framework base configuration. External input crosses the
boundary as unknown and is narrowed by validation before use.

## Alternatives considered

Plain JavaScript with JSDoc would lose compile time guarantees. TypeScript with
only the default strict preset would still allow unchecked index access, which
matters when walking arrays of parsed rows.

## Consequences

Some third party packages ship weak or missing types and need care at the import
boundary. The stricter flags occasionally require explicit handling of optional
and indexed values, which is the intended trade for fewer runtime surprises.

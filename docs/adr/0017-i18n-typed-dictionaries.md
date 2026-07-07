# 17. Internationalization: typed dictionaries

Status: Accepted
Date: 2026-07-08

## Context

The interface ships Thai and English, with Thai as the default. Course names show
the locale primary name with the other as secondary text. The set of user facing
strings is small and grows with the product.

## Decision

Implement internationalization as two flat JSON dictionaries and a small typed
accessor. The Thai dictionary defines the key set; typing both dictionaries as the
same record forces the English dictionary to cover exactly those keys, so a missing
translation fails typechecking. A parity test rejects extra keys at runtime. A React
hook reads the active locale from the ui store and returns the translator, so
components resolve every string through it.

## Alternatives considered

A full internationalization framework such as i18next or react-intl was rejected.
The string set is small, the framework runtime and its message format add weight the
product does not need, and the compile time key checking here catches drift between
locales more strictly than a framework's runtime lookups.

## Consequences

Adding a string means adding one key to both dictionaries, checked at compile time
and at runtime. The domain layer stays free of React because the pure translator and
dictionaries live in lib while the hook lives in the shell.

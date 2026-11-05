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

## Amendment, named placeholders

The seat line reads ว่าง 12 จาก 45 in Thai and 12 of 45 open in English, so the two
locales place the same values in a different order and a value appended to a fixed
prefix cannot express it. A dictionary string may now carry named `{placeholder}`
tokens, filled by `fillTemplate` in `lib/i18n/template.ts`. A token with no value is
left as written so a missing value is visible rather than silently dropped, and a
runtime test asserts that every key uses the same placeholder names in both
dictionaries. No message format beyond plain named substitution is introduced.

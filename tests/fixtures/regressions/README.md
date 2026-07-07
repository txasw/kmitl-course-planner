# Regression fixtures

When the live site returns data that deviates from the documented contract, the
diagnostics drawer in a development build exports the offending response. Commit
that payload here, write a failing test that reproduces the deviation, fix the
schema or the normalizer, then update the contract documentation and the
expectation table.

This folder is empty until the first captured deviation.

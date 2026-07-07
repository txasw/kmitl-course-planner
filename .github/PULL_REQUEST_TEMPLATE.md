## Summary

Describe what this change does and why.

## Phase reference

Which implementation phase or task does this address.

## Security checklist

Confirm none of the following regressed (see docs and the security section of the
project brief):

- [ ] Manifest permissions unchanged from the least privilege set.
- [ ] No eval, Function constructor, innerHTML, or dangerouslySetInnerHTML.
- [ ] All network calls originate in the background worker.
- [ ] Validation on API responses, storage reads, imports, and inbound messages.
- [ ] No telemetry, remote assets, or runtime fetched fonts.
- [ ] Production bundles contain no diagnostic code.

## Screenshots

Include before and after screenshots for user interface changes.

## Test evidence

Describe the tests added or updated and paste the relevant run output.

## Self review findings

Summarize the written self review of the full diff: correctness, security, test
coverage for new logic, copy tone, and anything fixed as a result.

## Commit history

- [ ] Commits are small and atomic.
- [ ] Messages follow Conventional Commits with a 72 character subject.
- [ ] No attribution trailers and no emoji.

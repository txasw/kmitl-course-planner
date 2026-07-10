# 29. Accessible primary text shade

Status: Accepted
Date: 2026-07-10

## Context

ADR-0016 fixed the brand primary to the KMITL orange `#E35205`, verified against the
official color guideline. The Phase 8 contrast audit measured that orange as a text
color and found it at 3.84:1 against white, below the WCAG AA bar of 4.5:1 for normal
text. It is used pervasively at 12 to 14 pixels: the launcher, the mode and language
toggles, the submit and add buttons with white text, the active tab, and the text links.
The browser axe check does not catch this, because it cannot resolve the token
backgrounds through the shadow root, so the failure surfaced only in the numeric ratio
table. The brand orange itself cannot change, since it is externally mandated, but the
brief also holds WCAG AA as non negotiable, so the two constraints have to be reconciled
rather than one dropped.

## Decision

Keep `--kcp-primary` exactly at `#E35205` for accents that carry the 3:1 UI component
threshold rather than the 4.5:1 text threshold: borders, focus rings, and the active tab
underline. Add `--kcp-primary-strong` `#B8400A`, a darker shade of the same hue, for
every interactive fill that carries white text and for every primary text link. White on
`#B8400A` is 5.56:1 and `#B8400A` as link text clears 4.5:1 on every background it sits
on, including the darkest, the danger soft notice, at 4.78:1. The hover shade
`--kcp-primary-hover` moves to `#A3380A` so a strong fill still darkens on hover. The
token contrast unit test enforces each pair at its threshold so a future edit cannot
regress it.

## Alternatives considered

Darkening `--kcp-primary` itself was rejected because it would misrepresent the mandated
brand orange everywhere, including the accents that already meet their 3:1 bar. Leaving
the orange as text and recording the sub-threshold as a known exception was rejected
because the brief holds AA as non negotiable and the failure is on the most common
interactive text in the product, not an edge case. Enlarging or bolding every primary
label to reach the 3:1 large text bar was rejected because it would distort the type
scale and still leave the small links failing.

## Consequences

The brand orange stays exact where it reads as an accent, and a single darker shade of
the same hue carries the interactive text at AA, so the product is both brand faithful and
accessible. The buttons and links are a visibly deeper orange than the accent, which is
the intended trade and is verified by the ratio table. A future interactive color joins
the strong and hover shades rather than the accent, and the token contrast test keeps the
whole set honest.

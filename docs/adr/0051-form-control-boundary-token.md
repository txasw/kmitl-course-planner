# 51. Form control boundary token and new contrast pairs

Status: Accepted
Date: 2026-11-06

Amends ADR-0029 (the tested set of design token contrast pairs).

## Context

Every white form control in the panel draws its boundary with `--kcp-border` `#E4E4E7`: the
subject id field, the searchable and select only comboboxes, and the catalog filter field. That
token is 1.27:1 against white, well under the 3:1 bar WCAG 1.4.11 sets for the boundary that
identifies a control, so a student with low vision cannot find the fields on the search form. The
same token draws every divider and gridline, where a quiet line is correct, so raising it in place
would make the whole grid heavier.

Three related defects sit beside it. Placeholders take the Tailwind default of half the current
text color, about 3.3:1 for ink on white. The catalog filter field has no visible label and names
itself only through its placeholder, which disappears as soon as the student types. Duplicate
subject and different term section rows dim with `opacity-70`, which composites their reason text
down to about 3.1:1, although the different term row carries an active switch action.

The token contrast suite from ADR-0029 covers none of these pairs. Several pairs that the v1.4
design introduces are also untested: a warn soft notice row, the two fills of the danger remove
zone, white text on a filled danger button, and the brand orange accent drawn over the danger
soft fill.

## Decision

Add `--kcp-border-strong` `#838389` for form control boundaries only: text inputs, comboboxes,
select only comboboxes, the filter field, the switch off track, and any checkbox. It measures
3.77:1 on surface and 3.52:1 on surface alt. On hover a control boundary moves to
`--kcp-ink-soft`, so hover stays visible without a fill change. `--kcp-border` `#E4E4E7` is
unchanged and stays the divider, card, and gridline token.

Placeholders use `--kcp-ink-soft` at opacity 1, which is 6.69:1 on surface and 6.25:1 on surface
alt. The filter field gets a persistent visible label, กรองรายการ in Thai and Filter results in
English, which is also its accessible name; the placeholder copy stays until the instructor
search widens what the field matches. Duplicate subject and different term rows de-emphasize
with the surface alt background and ink and ink soft text, the treatment the collapsed added
course card already uses, instead of opacity.

The whole new pair set is decided once, here, with each pair at its bar:

| Foreground     | Background       | Ratio | Bar |
| -------------- | ---------------- | ----- | --- |
| border-strong  | surface          | 3.77  | 3.0 |
| border-strong  | surface-alt      | 3.52  | 3.0 |
| warn           | warn-soft        | 4.97  | 4.5 |
| danger         | danger-zone      | 5.12  | 4.5 |
| danger         | danger-zone-over | 4.64  | 4.5 |
| white          | danger           | 5.62  | 4.5 |
| primary accent | danger-soft      | 3.30  | 3.0 |

`--kcp-warn-soft` `#FDF3E1`, `--kcp-danger-zone` `#FCF2F2`, and `--kcp-danger-zone-over`
`#F8E5E5` are declared by their first consumers, the pre share notice and the docked remove zone,
and each of those changes adds its own assertion to the token contrast suite. This change declares
`--kcp-border-strong` and asserts the pairs whose tokens already exist: border strong on both
surfaces, white on danger for the delete confirm button, and the primary accent on danger soft for
the swap target outline and focus ring over a blocked footprint.

## Alternatives considered

Darkening `--kcp-border` to 3:1 was rejected because the same token draws every divider and every
quarter gridline, and a 3:1 grid would compete with the event blocks it frames. A value nearer
the review suggestion of about `#8A8A8F` was rejected because it clears white by a thin margin
and drops under 3:1 on surface alt, where disabled and dimmed controls sit. Keeping opacity on the
dimmed rows with a darker text color was rejected because opacity composites every child,
including the switch action, so no single text token can guarantee the ratio. Declaring the warn
soft and danger zone tokens now with no consumer was rejected because an unused token is dead
code under the project rules.

## Consequences

Form controls are findable at the 3:1 bar on both panel surfaces, while dividers and gridlines
stay as quiet as before. A future form control uses `border-border-strong`, not `border-border`,
and a future dimmed state uses a surface change rather than opacity. The contrast table in
`docs/CONTRAST.md` and the token contrast suite list every pair above as the tokens land, so a
token edit that drops a pair under its bar fails the build.

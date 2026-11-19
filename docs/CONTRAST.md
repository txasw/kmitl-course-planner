# Contrast

WCAG 2.1 contrast ratios for the colors the extension renders. Normal text needs 4.5:1,
large text and UI components need 3:1. The `hash-color.test.ts` and `token-contrast.test.ts`
suites enforce these thresholds so a color edit that drops below its bar fails the build.

## Event block palette

Each palette color clears 4.5:1 as white text, kept as a property of the set. Since
ADR-0035 the block no longer draws white on the solid color; it fills with a soft tint of
the color under ink text and carries the solid color as a left bar. See the tinted surface
table below for the shipped pairs.

| Color     | Ratio |
| --------- | ----- |
| `#1F5FA8` | 6.44  |
| `#0E7C7B` | 5.01  |
| `#2E7D32` | 5.13  |
| `#6A3FA0` | 7.42  |
| `#B0355F` | 5.97  |
| `#3949AB` | 7.73  |
| `#A21CAF` | 6.32  |
| `#00729F` | 5.37  |
| `#736B00` | 5.48  |
| `#A50060` | 7.58  |

## Event block tinted surface

Each block fills with the subject color composited over white at 15 percent (ADR-0035),
carries a solid subject color left bar, and uses ink text for the subject name, the place,
and the section chip. Ink on every tint clears 4.5:1 with wide margin, and the solid bar
clears the 3:1 UI bar against its own tint. Since the hierarchy inversion (ADR-0047) the
block sets the quieter meta, the time, the subject id, and an English secondary name, in
ink soft, which clears 4.5:1 on every tint (minimum 5.05), enforced alongside the ink pair
in `hash-color.test.ts`.

Contrast alone does not keep a tint reading as a color. A low chroma hue such as brown or
slate composites to a near grey tint that blends into the `--kcp-surface-alt` panel, so
the same suite also measures CIE76 delta E: every tint stands at least 7.5 off
surface-alt (lowest shipped, teal, 7.76) and every pair of tints differs by at least 2.5,
above the 2.3 just noticeable difference (closest shipped pair, blue and indigo, 2.96).

| Color     | Tint      | Ink on tint | Bar on tint |
| --------- | --------- | ----------- | ----------- |
| `#1F5FA8` | `#DDE7F2` | 13.91       | 5.15        |
| `#0E7C7B` | `#DBEBEB` | 14.17       | 4.08        |
| `#2E7D32` | `#E0ECE0` | 14.29       | 4.21        |
| `#6A3FA0` | `#E9E2F1` | 13.77       | 5.87        |
| `#B0355F` | `#F3E1E7` | 13.87       | 4.75        |
| `#3949AB` | `#E1E4F2` | 13.74       | 6.11        |
| `#A21CAF` | `#F1DDF3` | 13.57       | 4.93        |
| `#00729F` | `#D9EAF1` | 14.08       | 4.35        |
| `#736B00` | `#EAE9D9` | 14.22       | 4.48        |
| `#A50060` | `#F2D9E7` | 13.14       | 5.73        |

Since the soft depth amendment of ADR-0047 this flat tint fills the preview poster and its
export only; the edit grid and the plan suggestion cards take the soft depth block below.

## Soft depth event block

The edit grid and the plan suggestion cards fill a block with the soft depth card of ADR-0071
tinted by the subject color, fading from 17 percent at the top to 8 percent from 70 percent
down, with a 3 px stripe of the solid color down the left edge (the ADR-0047 amendment of
2026-11-20). Ink and ink soft sit anywhere on it, so the table proves them on the 17 percent
stop. The stripe is a UI element and clears 3:1 against both stops. A flagged block leads its
name with a danger or warn status dot, which clears 3:1 against both stops on every tint
(lowest 4.08 for danger and 3.97 for warn). A danger block lays a hatch of the danger color at
24 percent with an inset danger ring over the fill. Ink soft falls under 4.5:1 on a hatch
stripe, so a hatched block sets its quiet lines, the English name, the section chip, and the
foot, in ink, which clears 4.5:1 through the hatch on both stops. Enforced in
`hash-color.test.ts`.

| Color     | 17 percent | 8 percent | Ink   | Ink soft | Stripe | Ink through hatch |
| --------- | ---------- | --------- | ----- | -------- | ------ | ----------------- |
| `#1F5FA8` | `#D9E4F0`  | `#EDF2F8` | 13.51 | 5.19     | 5.00   | 9.39              |
| `#0E7C7B` | `#D6E9E9`  | `#ECF5F4` | 13.83 | 5.31     | 3.99   | 9.59              |
| `#2E7D32` | `#DBE9DC`  | `#EEF5EF` | 13.84 | 5.32     | 4.08   | 9.62              |
| `#6A3FA0` | `#E6DEEF`  | `#F3F0F7` | 13.31 | 5.11     | 5.67   | 9.30              |
| `#B0355F` | `#F2DDE4`  | `#F9EFF2` | 13.46 | 5.17     | 4.61   | 9.49              |
| `#3949AB` | `#DDE0F1`  | `#EFF0F8` | 13.27 | 5.10     | 5.90   | 9.27              |
| `#A21CAF` | `#EFD8F1`  | `#F8EDF9` | 13.06 | 5.02     | 4.75   | 9.25              |
| `#00729F` | `#D4E7EF`  | `#EBF4F7` | 13.66 | 5.25     | 4.22   | 9.45              |
| `#736B00` | `#E7E6D4`  | `#F4F3EB` | 13.81 | 5.31     | 4.35   | 9.60              |
| `#A50060` | `#F0D4E4`  | `#F8EBF2` | 12.63 | 4.85     | 5.51   | 9.01              |

## Export template day color accent

The export template day row labels tint with the traditional Thai day colors, each
composited over white at 16 percent to an opaque hex (ADR-0042). The accent is on only in
the preview template render, never in edit mode, and the label text is ink. Ink on every
day tint clears 4.5:1 with wide margin, enforced in `dayColors.test.ts`.

| Day        | Color     | Tint      | Ink on tint |
| ---------- | --------- | --------- | ----------- |
| Sun red    | `#D5322F` | `#F8DEDE` | 13.67       |
| Mon yellow | `#E8B923` | `#FBF4DC` | 15.81       |
| Tue pink   | `#E7669B` | `#FBE7EF` | 14.73       |
| Wed green  | `#2E9E5B` | `#DEEFE5` | 14.57       |
| Thu orange | `#E5852B` | `#FBEBDD` | 14.94       |
| Fri blue   | `#2F6FBF` | `#DEE8F5` | 14.06       |
| Sat purple | `#7A3FB0` | `#EAE0F2` | 13.63       |

## Design token text on background pairs

Each pair is a usage the UI renders. The brand orange `--kcp-primary` (`#E35205`) is an
accent only, on borders, focus rings, and the active tab, so it carries the 3:1 UI bar;
its text uses the darker `--kcp-primary-strong` (`#B8400A`), which clears 4.5:1 on every
background it appears on, including the danger soft notice. The launcher pill fills with
`--kcp-primary-strong` and turns to `--kcp-primary-hover` (`#A3380A`) on hover, and both
carry its white text above 4.5:1. Form controls draw their
boundary with `--kcp-border-strong` (`#838389`), which clears the 3:1 UI bar on both panel
surfaces, while dividers and gridlines keep the quieter `--kcp-border` (ADR-0051). The
quiet warn fill `--kcp-warn-soft` (`#FDF3E1`) carries the pre share notice, with ink text
and a warn icon and border on it (ADR-0055). The remove drop zone fills with
`--kcp-danger-zone` (`#FCF2F2`) at rest and `--kcp-danger-zone-over` (`#F8E5E5`) while a
block is over it, the danger tone mixed into the surface at 6 and 12 percent, and its
danger border and text clear 4.5:1 on both (ADR-0059).

| Foreground     | Background       | Ratio | Bar |
| -------------- | ---------------- | ----- | --- |
| ink            | surface          | 17.40 | 4.5 |
| ink            | surface-alt      | 16.26 | 4.5 |
| ink            | primary-soft     | 15.36 | 4.5 |
| ink-soft       | surface          | 6.69  | 4.5 |
| ink-soft       | surface-alt      | 6.25  | 4.5 |
| danger         | surface          | 5.62  | 4.5 |
| danger         | danger-soft      | 4.83  | 4.5 |
| danger         | danger-zone      | 5.12  | 4.5 |
| danger         | danger-zone-over | 4.64  | 4.5 |
| white          | danger           | 5.62  | 4.5 |
| warn           | surface          | 5.47  | 4.5 |
| warn           | surface-alt      | 5.11  | 4.5 |
| warn           | primary-soft     | 4.83  | 4.5 |
| warn           | warn-soft        | 4.97  | 4.5 |
| ink            | warn-soft        | 15.82 | 4.5 |
| success        | surface-alt      | 5.05  | 4.5 |
| success        | success-soft     | 4.74  | 4.5 |
| white          | primary-strong   | 5.56  | 4.5 |
| white          | primary-hover    | 6.71  | 4.5 |
| primary-strong | surface          | 5.56  | 4.5 |
| primary-strong | surface-alt      | 5.19  | 4.5 |
| primary-strong | primary-soft     | 4.91  | 4.5 |
| primary-strong | danger-soft      | 4.78  | 4.5 |
| primary accent | surface          | 3.84  | 3.0 |
| primary accent | surface-alt      | 3.58  | 3.0 |
| primary accent | danger-soft      | 3.30  | 3.0 |
| border-strong  | surface          | 3.77  | 3.0 |
| border-strong  | surface-alt      | 3.52  | 3.0 |
| ink            | surface-sunken   | 15.17 | 4.5 |
| ink-soft       | surface-sunken   | 5.83  | 4.5 |
| ink-muted      | surface          | 5.30  | 4.5 |
| ink-muted      | surface-alt      | 4.95  | 4.5 |
| ink-muted      | surface-sunken   | 4.62  | 4.5 |
| ink-muted      | primary-soft     | 4.68  | 4.5 |

## Soft depth card

The soft depth card of ADR-0071 mixes its tint into the surface, from 17 percent at the top
to 8 percent from 70 percent of its height down. The tint is a subject color from the event
palette, or the muted ink `--kcp-ink-muted` (`#6B6B70`) on a neutral card. Ink and ink soft
may sit anywhere on the card, so they are proven on the 17 percent stop. Ink muted is bounded
by position, not by role: it may sit only where the top edge of its glyphs is at or below 70
percent of the card height, on the flat 8 percent stop, and it is proven there. Above that
point the gradient darkens toward the 17 percent stop, where ink muted falls to between 3.85
and 4.25. A foot line pinned to the bottom of a short card, such as a one hour event block,
can rise above the bound, so a card that cannot keep its muted text at or below 70 percent uses
ink soft for it. Each row lists the lowest ratio across the eleven tints, enforced in
`token-contrast.test.ts`.

| Foreground | Stop       | Lowest ratio | Lowest tint | Bar |
| ---------- | ---------- | ------------ | ----------- | --- |
| ink        | 17 percent | 12.63        | `#A50060`   | 4.5 |
| ink-soft   | 17 percent | 4.85         | `#A50060`   | 4.5 |
| ink-muted  | 8 percent  | 4.58         | `#A50060`   | 4.5 |

The bound is the same 70 percent for every tint, but the gradient turns too dark for ink muted
at a different height on each. The table lists, per tint, the highest point from the top at
which ink muted still clears 4.5:1 all the way down, computed by the muted text bound check in
`token-contrast.test.ts`. The check asserts that every limit is at most 70 percent, so the
one documented bound holds for every tint.

| Tint            | Hex       | Muted text limit from the top |
| --------------- | --------- | ----------------------------- |
| neutral (muted) | `#6B6B70` | 35 percent                    |
| blue            | `#1F5FA8` | 48 percent                    |
| teal            | `#0E7C7B` | 41 percent                    |
| green           | `#2E7D32` | 38 percent                    |
| purple          | `#6A3FA0` | 50 percent                    |
| raspberry       | `#B0355F` | 49 percent                    |
| indigo          | `#3949AB` | 52 percent                    |
| magenta         | `#A21CAF` | 56 percent                    |
| deep cyan       | `#00729F` | 42 percent                    |
| olive           | `#736B00` | 40 percent                    |
| berry           | `#A50060` | 64 percent                    |

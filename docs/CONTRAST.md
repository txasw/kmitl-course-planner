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
| `#8D5A2B` | 5.79  |
| `#5D4037` | 9.32  |
| `#455A64` | 7.24  |

## Event block tinted surface

Each block fills with the subject color composited over white at 15 percent (ADR-0035),
carries a solid subject color left bar, and uses ink text. Ink on every tint clears 4.5:1
with wide margin, and the solid bar clears the 3:1 UI bar against its own tint.

| Color     | Tint      | Ink on tint | Bar on tint |
| --------- | --------- | ----------- | ----------- |
| `#1F5FA8` | `#DDE7F2` | 13.91       | 5.15        |
| `#0E7C7B` | `#DBEBEB` | 14.17       | 4.08        |
| `#2E7D32` | `#E0ECE0` | 14.29       | 4.21        |
| `#6A3FA0` | `#E9E2F1` | 13.77       | 5.87        |
| `#B0355F` | `#F3E1E7` | 13.87       | 4.75        |
| `#3949AB` | `#E1E4F2` | 13.74       | 6.11        |
| `#A21CAF` | `#F1DDF3` | 13.57       | 4.93        |
| `#8D5A2B` | `#EEE6DF` | 14.11       | 4.69        |
| `#5D4037` | `#E7E2E1` | 13.56       | 7.26        |
| `#455A64` | `#E3E6E8` | 13.88       | 5.78        |

## Design token text on background pairs

Each pair is a usage the UI renders. The brand orange `--kcp-primary` (`#E35205`) is an
accent only, on borders, focus rings, and the active tab, so it carries the 3:1 UI bar;
its text uses the darker `--kcp-primary-strong` (`#B8400A`), which clears 4.5:1 on every
background it appears on, including the danger soft notice.

| Foreground     | Background     | Ratio | Bar |
| -------------- | -------------- | ----- | --- |
| ink            | surface        | 17.40 | 4.5 |
| ink            | primary-soft   | 15.36 | 4.5 |
| ink-soft       | surface        | 6.69  | 4.5 |
| ink-soft       | surface-alt    | 6.25  | 4.5 |
| danger         | surface        | 5.62  | 4.5 |
| danger         | danger-soft    | 4.83  | 4.5 |
| warn           | surface        | 5.47  | 4.5 |
| warn           | surface-alt    | 5.11  | 4.5 |
| warn           | primary-soft   | 4.83  | 4.5 |
| success        | success-soft   | 4.74  | 4.5 |
| white          | primary-strong | 5.56  | 4.5 |
| primary-strong | surface        | 5.56  | 4.5 |
| primary-strong | danger-soft    | 4.78  | 4.5 |
| primary accent | surface        | 3.84  | 3.0 |

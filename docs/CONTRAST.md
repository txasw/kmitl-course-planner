# Contrast

WCAG 2.1 contrast ratios for the colors the extension renders. Normal text needs 4.5:1,
large text and UI components need 3:1. The `hash-color.test.ts` and `token-contrast.test.ts`
suites enforce these thresholds so a color edit that drops below its bar fails the build.

## Event block palette against white text

Every block draws white text on its subject color. All ten clear 4.5:1.

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

## Design token text on background pairs

Each pair is a usage the UI renders. The brand orange `--kcp-primary` (`#E35205`) is an
accent only, on borders, focus rings, and the active tab, so it carries the 3:1 UI bar;
its text uses the darker `--kcp-primary-strong` (`#B8400A`), which clears 4.5:1 on every
background it appears on, including the danger soft notice.

| Foreground     | Background     | Ratio | Bar |
| -------------- | -------------- | ----- | --- |
| ink            | surface        | 17.40 | 4.5 |
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

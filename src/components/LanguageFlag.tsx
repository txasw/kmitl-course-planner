// The flag that marks a UI language in the header menu: the Thai flag for Thai and the
// United States flag for English. Both are drawn inline from plain rects and circles, since
// the icon set has no flags and the panel loads no remote assets. The colours are the
// flags' own, not design tokens, because a flag has to read as itself in every theme. Each
// flag fills a 22 by 15 px box with a hairline ring so a white stripe still shows on a
// white menu. The flag is aria-hidden: the language name beside it carries the meaning.

import type { Locale } from '@/lib/i18n/t';

const BOX =
  'block h-[15px] w-[22px] shrink-0 rounded-[2px] ring-1 ring-border-strong';

function ThaiFlag() {
  return (
    <svg
      viewBox="0 0 9 6"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={BOX}
    >
      <rect width="9" height="6" fill="#A51931" />
      <rect y="1" width="9" height="4" fill="#F4F5F8" />
      <rect y="2" width="9" height="2" fill="#2D2A4A" />
    </svg>
  );
}

// Thirteen stripes of 10 units on a 247 by 130 field, the flag's 19 to 10 ratio. The box is
// narrower than the flag, so the field is anchored at its left edge and the fly end crops,
// which keeps the whole canton in view.
const STRIPE = 10;
const CANTON_WIDTH = 99;
const CANTON_HEIGHT = 7 * STRIPE;
const RED_STRIPES = [0, 2, 4, 6, 8, 10, 12];
// The 50 stars sit in nine rows that alternate six and five, drawn as dots, which is what
// a star reads as at this size.
const STARS = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, column) => ({
    x: (CANTON_WIDTH / 12) * (2 * column + (row % 2 === 0 ? 1 : 2)),
    y: (CANTON_HEIGHT / 10) * (row + 1),
  })),
).flat();

function UsFlag() {
  return (
    <svg
      viewBox="0 0 247 130"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden
      className={BOX}
    >
      <rect width="247" height="130" fill="#FFFFFF" />
      {RED_STRIPES.map((stripe) => (
        <rect
          key={stripe}
          y={stripe * STRIPE}
          width="247"
          height={STRIPE}
          fill="#B22234"
        />
      ))}
      <rect width={CANTON_WIDTH} height={CANTON_HEIGHT} fill="#3C3B6E" />
      {STARS.map((star) => (
        <circle
          key={`${String(star.x)}-${String(star.y)}`}
          cx={star.x}
          cy={star.y}
          r="2.6"
          fill="#FFFFFF"
        />
      ))}
    </svg>
  );
}

export function LanguageFlag({ locale }: { locale: Locale }) {
  return locale === 'th' ? <ThaiFlag /> : <UsFlag />;
}

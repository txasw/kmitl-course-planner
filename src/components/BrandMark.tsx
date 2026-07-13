// The extension's icon (assets/icon.svg) as a monochrome, single color mark, built from the
// same rect geometry, never a redrawn approximation. The mapping keeps the icon's figure and
// ground: the rounded tile fills with currentColor; the three light squares knock out to full
// transparency as negative space through a mask, so they read as light shapes inside a filled
// tile, not detached filled squares; and the accent square at the bottom right keeps its exact
// position, rendered in currentColor at 45 percent opacity, so its signature survives in one
// colour. currentColor ties the whole mark to the credit text beside it. The mask id is unique
// per instance so several marks on one poster do not collide. The mark is aria-hidden and a
// label carries the meaning; the caller sizes it in em.

import { useId } from 'react';

export function BrandMark({ className }: { className?: string }) {
  const maskId = `kcp-brand-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 128 128" aria-hidden className={className}>
      {/* White keeps the tile, black knocks a square out. All four icon squares knock out; the
          accent square is then painted back at reduced opacity below. */}
      <mask id={maskId} maskContentUnits="userSpaceOnUse">
        <rect width="128" height="128" fill="white" />
        <rect x="22" y="22" width="38" height="38" rx="6" fill="black" />
        <rect x="68" y="22" width="38" height="38" rx="6" fill="black" />
        <rect x="22" y="68" width="38" height="38" rx="6" fill="black" />
        <rect x="68" y="68" width="38" height="38" rx="6" fill="black" />
      </mask>
      <rect
        width="128"
        height="128"
        rx="28"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <rect
        x="68"
        y="68"
        width="38"
        height="38"
        rx="6"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}

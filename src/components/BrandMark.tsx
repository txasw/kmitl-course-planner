// The extension's icon as a monochrome, single color mark: the four square grid motif of
// assets/icon.svg in currentColor, dropping the brand orange field and the darker corner so it
// takes the colour of the text beside it. The caller sizes it in em so it tracks that text. It
// is aria-hidden; a label alongside carries the meaning. Used as the export watermark credit.

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <rect x="22" y="22" width="38" height="38" rx="6" />
      <rect x="68" y="22" width="38" height="38" rx="6" />
      <rect x="22" y="68" width="38" height="38" rx="6" />
      <rect x="68" y="68" width="38" height="38" rx="6" />
    </svg>
  );
}

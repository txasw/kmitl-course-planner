// The name only rule of a narrow block, as container query classes on the block wrapper in
// em of the grid type size, so it follows the block's own width at every grid scale. Only a
// grid whose block width is a day column or a suggestion slide track asks for it: the portrait
// edit grid and the suggestion slides. A landscape block is as wide as its meeting is long, so
// there a short meeting keeps its place and walks the density ladder, and the export poster
// never takes the rule (ADR-0047).

/** Hides an element while the block wrapper, the size container, is narrower than 7em. */
export const NARROW_HIDDEN = '@max-[7em]:hidden';

/** The tight padding and smaller type a block takes while narrower than 7em. */
export const NARROW_PADDING =
  '@max-[7em]:pr-0.5 @max-[7em]:pl-1.5 @max-[7em]:text-[0.9em]';

/** Keeps the name clear of the remove control: always under the plain rule, and only while
 * the block is wide enough to show the control under the name only rule. */
export function removeClearance(nameOnlyWhenNarrow: boolean): string {
  return nameOnlyWhenNarrow
    ? 'not-pointer-coarse:@min-[7em]:pr-5'
    : 'not-pointer-coarse:pr-5';
}

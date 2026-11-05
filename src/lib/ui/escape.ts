// Escape routing for nested surfaces, recorded in ADR-0056. A surface inside the panel
// closes on Escape from a React onKeyDown. Bubbling visits the innermost surface first,
// so the first surface that claims the press wins and every outer surface, and finally
// the overlay focus trap deciding at the body, sees it as already handled. The claim is
// the event's default prevented flag, which a native listener and a React handler share,
// so the overlay needs no registry of open layers.

/** The part of a keyboard event the claim reads and writes, native or React. */
export interface EscapeEvent {
  readonly key: string;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

/**
 * Claims an Escape press for the calling surface. It returns true, after marking the event
 * handled, only when the key is Escape and no inner surface has claimed it yet; the caller
 * then closes itself. Any other key, or an Escape already claimed, returns false untouched.
 */
export function claimEscape(event: EscapeEvent): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) {
    return false;
  }
  event.preventDefault();
  return true;
}

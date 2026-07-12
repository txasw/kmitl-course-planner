import { createContext, useContext } from 'react';

// A portal target for floating-ui popups that must escape a transformed ancestor. The
// slide over catalog drawer uses a translate-x transform, which establishes a containing
// block for fixed positioned elements, so a combobox or popover rendered inside it is
// mispositioned. Rendering the popup into this node, the overlay root inside the shadow
// root, keeps it clip free and correctly positioned while staying inside the shadow
// scoped Tailwind styles. Portaling to document.body would leave the shadow root and lose
// those styles, so this node is the correct target.
export const PanelPortalContext = createContext<HTMLElement | null>(null);

export function usePanelPortal(): HTMLElement | null {
  return useContext(PanelPortalContext);
}

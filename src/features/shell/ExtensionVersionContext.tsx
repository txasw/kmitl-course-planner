import { createContext, useContext } from 'react';

// The loaded extension's version, read once at the entrypoint from the manifest and
// provided here, so the header and its menu show it without calling the extension API.
// Null means the version could not be read, and nothing that shows it renders.
export const ExtensionVersionContext = createContext<string | null>(null);

export function useExtensionVersion(): string | null {
  return useContext(ExtensionVersionContext);
}

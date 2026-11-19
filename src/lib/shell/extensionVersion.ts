// Reads the version of the loaded extension from its manifest. The content script calls
// this once at mount with runtime.getManifest, which needs no permission, and passes the
// result down, so the components never touch the extension API. The version is shown as
// the manifest states it, which the browser holds to dot separated integers. A
// runtime that throws, as an invalidated extension context does after a reload under an
// open page, or a manifest without a version yields null, and the UI then shows no
// version rather than a broken one.

export interface ManifestWithVersion {
  version?: unknown;
}

export function readExtensionVersion(
  getManifest: () => ManifestWithVersion,
): string | null {
  try {
    const { version } = getManifest();
    return typeof version === 'string' && version !== '' ? version : null;
  } catch {
    return null;
  }
}

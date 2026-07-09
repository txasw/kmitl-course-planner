// Save a blob or a text payload as a file download from the content script UI.
// It creates a temporary object url, clicks a synthetic anchor, and revokes the
// url. Kept in one place so the PNG, plan JSON, and diagnostics report exports
// share a single, tested path rather than each open coding the anchor dance.

/** Trigger a browser download of a blob under the given file name. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of a text payload, defaulting to a JSON type. */
export function downloadText(
  filename: string,
  text: string,
  type = 'application/json',
): void {
  downloadBlob(filename, new Blob([text], { type }));
}

// The native share sheet support for the poster image. File sharing through the Web Share
// API exists on most phone browsers and some desktop ones, and not at all elsewhere, so the
// share action is feature detected the same way as the image copy: where the browser cannot
// share a PNG file, the action is absent rather than a dead button.

import { errorName } from '@/lib/utils/errorName';

/** The file type every poster export carries. */
const PNG = 'image/png';

/** Whether the browser can hand a PNG file to the native share sheet. The probe is an
 * empty file of the same type, since canShare judges the type and not the bytes. */
export function canShareImage(): boolean {
  if (
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    typeof File === 'undefined'
  ) {
    return false;
  }
  try {
    return navigator.canShare({
      files: [new File([], 'plan.png', { type: PNG })],
    });
  } catch {
    return false;
  }
}

/** The poster image as a PNG file under its export file name. */
export function pngFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: PNG });
}

/**
 * How a rejected share ended. The student closing the sheet is a cancel, not a failure.
 * A share that lost the press that started it, because the capture outlasted the browser's
 * user activation window, needs a fresh press. Anything else failed.
 */
export type ShareFailure = 'cancelled' | 'needsPress' | 'failed';

export function classifyShareError(error: unknown): ShareFailure {
  // Read by name, since a DOMException from the page realm fails instanceof in a
  // Firefox content script.
  const name = errorName(error);
  if (name === 'AbortError') return 'cancelled';
  if (name === 'NotAllowedError') return 'needsPress';
  return 'failed';
}

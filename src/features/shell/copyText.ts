// Copy plain text to the clipboard and confirm the outcome through the one toast channel,
// since a clipboard write leaves nothing else on screen. The host is a secure context, so
// the clipboard is present; a denied or failed write takes the error branch. The messages
// arrive already localized, as every toast message does. The returned promise settles with
// the toast and never rejects, so a control can hold its busy state until then.

import { toastStore } from './toastStore';

export function copyText(
  text: string,
  copied: string,
  failed: string,
): Promise<void> {
  return navigator.clipboard.writeText(text).then(
    () => {
      toastStore.getState().show('success', copied);
    },
    () => {
      toastStore.getState().show('error', failed);
    },
  );
}

// Copy plain text to the clipboard and confirm the outcome through the one toast channel,
// since a clipboard write leaves nothing else on screen. The host is a secure context, so
// the clipboard is present; a denied or failed write takes the error branch. The messages
// arrive already localized, as every toast message does.

import { toastStore } from './toastStore';

export function copyText(text: string, copied: string, failed: string): void {
  void navigator.clipboard.writeText(text).then(
    () => {
      toastStore.getState().show('success', copied);
    },
    () => {
      toastStore.getState().show('error', failed);
    },
  );
}

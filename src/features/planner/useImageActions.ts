// The poster image actions of the preview toolbar. Each one captures the poster node and
// hands the PNG to its destination: a file download, or the clipboard. Every action
// reports through the shared toast, since a copy or download has no other visible result on
// screen.
//
// An image capture takes a moment on a large template, so while one runs the actions are
// busy: the hook names the action whose capture runs, and a press on any image action is
// ignored until the outcome is known, so a second press cannot start a parallel capture.

import { useState, type RefObject } from 'react';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { downloadBlob } from '@/lib/utils/download';
import { capturePng } from './capture';

/** An image action of the preview toolbar. */
export type ImageAction = 'copyImage' | 'download';

export interface ImageActions {
  /** The image action whose capture is running, or null when the toolbar is idle. */
  capturing: ImageAction | null;
  download: () => void;
  copyImage: () => void;
}

/** Whether the browser can write an image to the clipboard. The host is a secure
 * context, so navigator.clipboard is present; ClipboardItem is the real gate. */
export function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard.write === 'function'
  );
}

export function useImageActions(
  posterRef: RefObject<HTMLDivElement | null>,
  pixelRatio: number,
  fileName: string,
): ImageActions {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState<ImageAction | null>(null);

  // Capture the poster, hand the image to its destination, and toast the outcome, holding
  // the actions busy from the press until the outcome is known.
  const runCapture = (
    action: ImageAction,
    deliver: (blob: Blob) => Promise<void> | void,
    successMessage: string,
  ) => {
    const node = posterRef.current;
    if (node === null || capturing !== null) {
      return;
    }
    setCapturing(action);
    void capturePng(node, pixelRatio)
      .then(deliver)
      .then(
        () => {
          toastStore.getState().show('success', successMessage);
        },
        () => {
          toastStore.getState().show('error', t('preview.exportFailed'));
        },
      )
      .finally(() => {
        setCapturing(null);
      });
  };

  return {
    capturing,
    download: () => {
      runCapture(
        'download',
        (blob) => {
          downloadBlob(fileName, blob);
        },
        t('preview.pngDownloaded'),
      );
    },
    copyImage: () => {
      runCapture(
        'copyImage',
        (blob) =>
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
        t('preview.imageCopied'),
      );
    },
  };
}

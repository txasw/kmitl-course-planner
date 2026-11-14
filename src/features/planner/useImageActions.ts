// The poster image actions of the preview toolbar. Each one captures the poster node and
// hands the PNG to its destination: a file download, the clipboard, or the native share
// sheet. A download or a copy reports through the shared toast, since it has no other
// visible result on screen; a share shows the sheet itself, so it toasts only a failure.
//
// An image capture takes a moment on a large template, so while one runs the actions are
// busy: the hook names the action whose capture runs, and a press on any image action is
// ignored until the outcome is known, so a second press cannot start a parallel capture.
//
// The share sheet opens only within the browser's user activation window after a press. A
// capture of a large template can outlast it, and the browser then refuses the share. The
// captured file is held instead and a toast offers to share it, so the next press, on the
// toast or on the share action, opens the sheet at once without capturing again. A mutation
// observer on the poster drops the held file at the first change to the poster, and a held
// file taken from another poster node is never used, so an edit made in between is never
// shared from a stale image.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { downloadBlob } from '@/lib/utils/download';
import { capturePng } from './capture';
import { classifyShareError, pngFile } from './imageShare';

/** An image action of the preview toolbar. */
export type ImageAction = 'copyImage' | 'download' | 'share';

/** The id of the share action, where focus returns from the share toast. */
export const SHARE_IMAGE_ID = 'kcp-preview-share';

export interface ImageActions {
  /** The image action whose capture is running, or null when the toolbar is idle. */
  capturing: ImageAction | null;
  download: () => void;
  copyImage: () => void;
  share: () => void;
}

/** Whether the browser can write an image to the clipboard. The host is a secure
 * context, so navigator.clipboard is present; ClipboardItem is the real gate. */
export function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard.write === 'function'
  );
}

/** A captured poster file waiting for a fresh press, with the node it was taken from and
 * the observer that drops it when that node changes. */
interface HeldShare {
  file: File;
  node: HTMLDivElement;
  observer: MutationObserver;
}

const POSTER_CHANGES: MutationObserverInit = {
  subtree: true,
  childList: true,
  attributes: true,
  characterData: true,
};

/** Stop watching the held poster and let its file go. */
function releaseHeld(heldRef: { current: HeldShare | null }): void {
  heldRef.current?.observer.disconnect();
  heldRef.current = null;
}

export function useImageActions(
  posterRef: RefObject<HTMLDivElement | null>,
  pixelRatio: number,
  fileName: string,
): ImageActions {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState<ImageAction | null>(null);
  // The guard reads a ref rather than the state, so the share toast action, which closes
  // over an older render, still sees a capture that started after it.
  const busyRef = useRef(false);
  const heldRef = useRef<HeldShare | null>(null);
  // The toast that offers the held file, which has nothing to share once the toolbar is gone.
  const readyToastRef = useRef<number | null>(null);

  const dropHeld = () => {
    releaseHeld(heldRef);
  };
  // Leaving preview unmounts the toolbar, which ends any hold and takes down its offer, so
  // the toast never leaves a share action behind that no longer reaches a poster.
  useEffect(
    () => () => {
      releaseHeld(heldRef);
      if (readyToastRef.current !== null) {
        toastStore.getState().dismiss(readyToastRef.current);
      }
    },
    [],
  );

  const hold = (file: File, node: HTMLDivElement) => {
    dropHeld();
    const observer = new MutationObserver(dropHeld);
    observer.observe(node, POSTER_CHANGES);
    heldRef.current = { file, node, observer };
  };

  // Capture the poster, hand the image to its destination, and toast the outcome, holding
  // the actions busy from the press until the outcome is known. A null success message
  // leaves the success toast to the destination.
  const runCapture = (
    action: ImageAction,
    deliver: (blob: Blob, node: HTMLDivElement) => Promise<void> | void,
    successMessage: string | null,
    failureMessage: string,
  ) => {
    const node = posterRef.current;
    if (node === null || busyRef.current) {
      return;
    }
    busyRef.current = true;
    setCapturing(action);
    void capturePng(node, pixelRatio)
      .then((blob) => deliver(blob, node))
      .then(
        () => {
          if (successMessage !== null) {
            toastStore.getState().show('success', successMessage);
          }
        },
        () => {
          toastStore.getState().show('error', failureMessage);
        },
      )
      .finally(() => {
        busyRef.current = false;
        setCapturing(null);
      });
  };

  // Open the share sheet with a file. A cancel is silent, a lost press holds the file for
  // the next one, and any other refusal rejects so the caller reports it.
  const shareFile = async (file: File, node: HTMLDivElement): Promise<void> => {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      const failure = classifyShareError(error);
      if (failure === 'cancelled') return;
      if (failure === 'failed') throw error;
      hold(file, node);
      toastStore.getState().show('success', t('preview.shareReady'), {
        label: t('preview.shareImage'),
        run: (control) => {
          commitAndFocus(control, SHARE_IMAGE_ID, share);
        },
      });
      readyToastRef.current = toastStore.getState().toast?.id ?? null;
    }
  };

  const share = () => {
    const node = posterRef.current;
    if (node === null || busyRef.current) {
      return;
    }
    const held = heldRef.current;
    // A change not yet delivered to the observer still waits in its record queue.
    const unchanged =
      held?.node === node && held.observer.takeRecords().length === 0;
    dropHeld();
    if (held !== null && unchanged) {
      shareFile(held.file, node).catch(() => {
        toastStore.getState().show('error', t('preview.shareFailed'));
      });
      return;
    }
    runCapture(
      'share',
      (blob, captured) => shareFile(pngFile(blob, fileName), captured),
      null,
      t('preview.shareFailed'),
    );
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
        t('preview.exportFailed'),
      );
    },
    copyImage: () => {
      runCapture(
        'copyImage',
        (blob) =>
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
        t('preview.imageCopied'),
        t('preview.exportFailed'),
      );
    },
    share,
  };
}

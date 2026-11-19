// The decorative half of the coach mark (ADR-0072): the spotlight around the launcher,
// the burst of three short strokes at its corner, and the hand drawn pointer from the end
// of the callout down to the launcher's top. All of it is hidden from assistive
// technology, since the callout and the polite region carry the words.
//
// The spacer takes the launcher's box and face, invisible, in the grid cell over the
// launcher, so the spotlight and the burst follow the launcher's real size. The pointer
// box spans the gap column and the launcher column above it and ends 12 px above the
// launcher, and the stroke is computed in its measured pixels, so the curve and the
// arrowhead keep their shape at every width instead of stretching with the box.

import { useRef } from 'react';
import { LAUNCHER_BOX, LauncherFace } from '@/features/shell/Launcher';
import { useElementSize } from '@/features/shell/useElementSize';
import { pointerGeometry } from '@/lib/onboarding/coachMarkPointer';

const STROKE = 'var(--kcp-primary)';

export function CoachMarkPointer() {
  const boxRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const box = useElementSize(boxRef);
  const spacer = useElementSize(spacerRef);
  const geometry = pointerGeometry(box, spacer.width);

  return (
    <>
      <div
        ref={boxRef}
        aria-hidden="true"
        className="col-start-2 col-end-4 row-start-1 row-end-3 mb-15"
      >
        {geometry === null ? null : (
          <svg
            width={box.width}
            height={box.height}
            viewBox={`0 0 ${String(box.width)} ${String(box.height)}`}
            className="overflow-visible"
          >
            <path
              d={geometry.curve}
              pathLength={1}
              fill="none"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinecap="round"
              className="kcp-coach-draw"
            />
            {/* The head scales about its own tip, given in the view box's pixels, so
                it pops in place rather than sliding from a corner of the box. */}
            <path
              d={geometry.head}
              fill="none"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="kcp-coach-pop transform-view"
              style={{
                transformOrigin: `${String(geometry.tip.x)}px ${String(geometry.tip.y)}px`,
              }}
            />
          </svg>
        )}
      </div>
      <div
        ref={spacerRef}
        aria-hidden="true"
        className={`kcp-coach-spot relative col-start-3 row-start-2 self-end ${LAUNCHER_BOX}`}
      >
        <span className="invisible contents">
          <LauncherFace />
        </span>
        {/* Three strokes fan out from a point just off the launcher's top right corner,
            from 10 to 20 px out, so they read on the scrim beyond the spotlight ring and
            stay inside the 20 px edge offset. */}
        <svg
          viewBox="0 0 24 24"
          className="kcp-coach-pop absolute -top-5.5 -right-3.75 size-6 origin-bottom-left overflow-visible"
        >
          <g fill="none" stroke={STROKE} strokeWidth={3} strokeLinecap="round">
            <path d="M3.3 12.2 L1.5 2.3" />
            <path d="M9.7 13.2 L14.4 4.3" />
            <path d="M14.1 17.8 L23.1 13.5" />
          </g>
        </svg>
      </div>
    </>
  );
}

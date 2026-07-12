// The preview stage scales the fixed-size template poster to fit the available area
// for display, while the poster keeps its exact template layout box. The scale is a
// display-only transform on a wrapper, which html-to-image ignores when it captures
// the poster node itself, so the export still lands the exact template pixels. A
// corner label states the output size.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';

interface PreviewStageProps {
  template: ExportTemplate;
  /** A short label of the output size, shown in the corner over the stage. */
  sizeLabel: string;
  /** The poster, fixed to the template layout box and holding the capture ref. */
  children: ReactNode;
}

const STAGE_PADDING = 16;

export function PreviewStage({
  template,
  sizeLabel,
  children,
}: PreviewStageProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1);

  useEffect(() => {
    const area = areaRef.current;
    if (area === null) {
      return undefined;
    }
    const measure = () => {
      const availWidth = area.clientWidth - STAGE_PADDING;
      const availHeight = area.clientHeight - STAGE_PADDING;
      const next = Math.min(
        availWidth / template.layoutWidth,
        availHeight / template.layoutHeight,
        1,
      );
      setScale(next > 0 ? next : 0.1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, [template]);

  return (
    <div
      ref={areaRef}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div
        style={{
          width: template.layoutWidth * scale,
          height: template.layoutHeight * scale,
          flex: 'none',
        }}
      >
        <div
          style={{
            width: template.layoutWidth,
            height: template.layoutHeight,
            transform: `scale(${String(scale)})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-medium text-surface">
        {sizeLabel}
      </span>
    </div>
  );
}

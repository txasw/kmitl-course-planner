// The preview stage geometry for the export template gallery (ADR-0045). The selected poster
// sits centered on the stage, full height and unclipped, scaled by a display only transform
// that never reaches the capture (ADR-0041). A large stage may scale the poster up, to at most
// twice its layout box, so a wide screen shows the poster at a readable size rather than as a
// small card in a wide empty frame; the cap keeps a small template from turning into an
// oversized blur. A neighbor template shows as a sliver at each edge, sitting a touch shorter
// than the selection. With no template chosen yet, a tall stage opens on the portrait phone
// wallpaper, so a phone shows a poster that fills its screen rather than a thin landscape band.

import {
  DEFAULT_TEMPLATE,
  templateBySlug,
  type ExportTemplate,
} from './exportTemplates';

export interface StageSize {
  width: number;
  height: number;
}

/** The largest display scale the stage applies to the selected poster. */
export const MAX_STAGE_SCALE = 2;
/** The width each edge keeps clear so the selection never touches a sliver. */
export const EDGE_RESERVE_PX = 60;
/** The share of the stage height the selected poster fills, leaving room for its frame. */
const POSTER_FIT = 0.94;
/** A neighbor sits a touch shorter than the selection. */
const NEIGHBOR_HEIGHT_SCALE = 0.9;
/** The scale an unmeasured or collapsed stage falls back to, so a poster never vanishes. */
const MIN_SCALE = 0.1;

/** The scale that centers the selected poster full height and unclipped, within the width
 * left after the edge reserve, capped at MAX_STAGE_SCALE. */
export function selectedScale(
  template: ExportTemplate,
  stage: StageSize,
): number {
  const usableWidth = stage.width - 2 * EDGE_RESERVE_PX;
  if (usableWidth <= 0 || stage.height <= 0) {
    return MIN_SCALE;
  }
  return Math.min(
    usableWidth / template.layoutWidth,
    (stage.height * POSTER_FIT) / template.layoutHeight,
    MAX_STAGE_SCALE,
  );
}

/** A neighbor is scaled to a slightly shorter height; only its sliver shows, so width is
 * free. It shares the selection's cap so the two never read at unrelated sizes. */
export function neighborScale(
  template: ExportTemplate,
  stage: StageSize,
): number {
  if (stage.height <= 0) {
    return MIN_SCALE;
  }
  return Math.min(
    (stage.height * POSTER_FIT * NEIGHBOR_HEIGHT_SCALE) / template.layoutHeight,
    MAX_STAGE_SCALE,
  );
}

/** The template a tall stage opens on when the student has not chosen one: the portrait
 * phone wallpaper, the canvas whose shape matches a stage taller than wide. */
export const TALL_STAGE_TEMPLATE_SLUG = 'phone-wallpaper-portrait';

/** A stage taller than wide, the shape a phone or a narrow window gives the preview. */
export function isTallStage(stage: StageSize): boolean {
  return stage.height > stage.width;
}

/** The template the preview shows and every export uses. A chosen slug always wins, so the
 * stage shape never overrides the student's pick; with no choice yet, a tall stage opens on
 * the portrait phone wallpaper and any other stage on the default template. */
export function resolveStageTemplate(
  chosen: string | null,
  tall: boolean,
): ExportTemplate {
  if (chosen !== null) {
    return templateBySlug(chosen);
  }
  return templateBySlug(
    tall ? TALL_STAGE_TEMPLATE_SLUG : DEFAULT_TEMPLATE.slug,
  );
}

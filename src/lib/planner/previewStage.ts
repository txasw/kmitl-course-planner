// The preview stage geometry for the export template gallery (ADR-0045). The selected poster
// sits centered on the stage, full height and unclipped, scaled by a display only transform
// that never reaches the capture (ADR-0041). A large stage may scale the poster up, to at most
// twice its layout box, so a wide screen shows the poster at a readable size rather than as a
// small card in a wide empty frame; the cap keeps a small template from turning into an
// oversized blur. The stage shows the selected poster alone at every width: the named template
// chips above it pick the template, so no neighbouring template peeks at its edges (ADR-0045
// amendment of 2026-11-21). With no template chosen yet, a tall stage opens on the portrait
// phone wallpaper, so a phone shows a poster that fills its screen rather than a thin landscape
// band.

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
/** The share of the stage the selected poster fills, leaving room for its frame. */
const POSTER_FIT = 0.94;
/** The scale an unmeasured or collapsed stage falls back to, so a poster never vanishes. */
const MIN_SCALE = 0.1;

/** The scale that centers the selected poster full height and unclipped, fitting the same
 * share of the stage width as of its height so the frame stays in view, capped at
 * MAX_STAGE_SCALE. */
export function selectedScale(
  template: ExportTemplate,
  stage: StageSize,
): number {
  if (stage.width <= 0 || stage.height <= 0) {
    return MIN_SCALE;
  }
  return Math.min(
    (stage.width * POSTER_FIT) / template.layoutWidth,
    (stage.height * POSTER_FIT) / template.layoutHeight,
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

import { test, expect, catalogAtRest, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import { tap, type Point } from './support/touch';
import type { Locator, Page } from '@playwright/test';

// The edge rail of ADR-0048 on the docked tiers: it takes the hidden column's place with
// its icon on the hide control's icon, it restores the column with the scroll offset the
// column kept, it takes no pointer events during a drag, and a tap opens it on a touch
// screen. Hovering it peeks a shadowed edge of the column once the pointer has moved off it
// after a hide, and the column slides in and out by transform unless motion is reduced.
// The feedback strip's reveal action brings the hidden column back too.

const COLUMN = '#kcp-catalog-column';
const HIDE = 'ซ่อนรายวิชา';
const RAIL = /^แสดงรายวิชา/;

// The show and hide funnel ignores a pointer toggle within 200 ms of the previous one, so
// the hide control and the rail sharing one point cannot undo each other on a quick
// second click. A scripted sequence clicks far faster than a person, so it waits past
// that window before the next pointer toggle.
const PAST_POINTER_GUARD_MS = 250;

async function iconCentre(control: Locator): Promise<Point> {
  const box = await control.locator('svg').first().boundingBox();
  if (box === null) throw new Error('the control icon has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function centre(control: Locator): Promise<Point> {
  const box = await control.boundingBox();
  if (box === null) throw new Error('the control has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const SCROLLER = '[data-catalog-scroller]';

/**
 * Open every collapsed course card, then scroll the results down and return the offset
 * they settled at. Collapsed cards are one line each, so the synthetic result only grows
 * taller than the column once its cards are open.
 */
async function scrollCatalog(page: Page): Promise<number> {
  const closed = page.locator('[data-course-toggle][aria-expanded="false"]');
  while ((await closed.count()) > 0) {
    await closed.first().click();
  }
  await catalogAtRest(page);
  return page.locator(SCROLLER).evaluate((node) => {
    node.scrollTop = 160;
    return node.scrollTop;
  });
}

/**
 * How far the panel body could scroll. Every region in it scrolls on its own, so this
 * stays 0; any overflow would let a scroll into view move the whole panel, the hide
 * control with it.
 */
async function panelBodyOverflow(page: Page): Promise<number> {
  return page
    .getByRole('main')
    .evaluate((node) => node.scrollHeight - node.clientHeight);
}

async function catalogOffset(page: Page): Promise<number> {
  return page.locator(SCROLLER).evaluate((node) => node.scrollTop);
}

const GHOST = '.kcp-rail-ghost';

// The hint waits the 80 ms intent delay, then fades in over the 150 ms fast duration.
const PEEK_SETTLED_MS = 80 + 150 + 70;

/** The slide effects running on the column, which the show and hide funnels start. */
async function slideEffects(page: Page): Promise<number> {
  return page
    .locator(COLUMN)
    .evaluate(
      (node) =>
        node
          .getAnimations()
          .filter((effect) => effect.id === 'kcp-catalog-slide').length,
    );
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`at ${String(viewport.width)} by ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('the rail sits where the hide control was and restores the column as it was', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await syntheticSearch(page);
      const offset = await scrollCatalog(page);
      expect(offset).toBeGreaterThan(0);
      expect(await panelBodyOverflow(page)).toBe(0);

      const hide = page.getByRole('button', { name: HIDE });
      const hideIcon = await iconCentre(hide);
      await hide.click();

      const rail = page.getByRole('button', { name: RAIL });
      await expect(rail).toBeFocused();
      await expect(page.locator(COLUMN)).toHaveAttribute('inert');
      const railIcon = await iconCentre(rail);
      expect(Math.abs(railIcon.x - hideIcon.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(railIcon.y - hideIcon.y)).toBeLessThanOrEqual(2);
      await expect(rail).not.toHaveAttribute('aria-expanded');
      await expect(rail).not.toHaveAttribute('title');

      await page.waitForTimeout(PAST_POINTER_GUARD_MS);
      await rail.click();
      await expect(page.locator(COLUMN)).not.toHaveAttribute('inert');
      await expect(page.getByRole('button', { name: HIDE })).toBeFocused();
      await expect(rail).toHaveCount(0);
      expect(await catalogOffset(page)).toBe(offset);
    });

    test('the rail takes no pointer events during a block drag', async ({
      context,
    }) => {
      const page = await openPlanner(context);
      await syntheticSearch(page);
      await addCourse(page, '90000001');
      const placed = page.locator(block('900001'));
      await expect(placed).toBeVisible();

      await page.getByRole('button', { name: HIDE }).click();
      const rail = page.getByRole('button', { name: RAIL });
      await expect(rail).toBeVisible();
      await expect(rail).toHaveCSS('pointer-events', 'auto');

      const from = await centre(placed);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 24, from.y + 12, { steps: 6 });
      await expect(rail).toHaveAttribute('data-dragging', 'true');
      await expect(rail).toHaveCSS('pointer-events', 'none');
      await page.mouse.up();

      await expect(rail).not.toHaveAttribute('data-dragging');
      await expect(rail).toHaveCSS('pointer-events', 'auto');
      await expect(page.locator(COLUMN)).toHaveAttribute('inert');
    });
  });
}

// Course B 90000002 overlaps Course A and has no other section, so its blocked add offers
// the reveal action alone. With the column hidden, the action slides it back and hands
// focus to the course's card, where the rail would otherwise have taken it.
test('the reveal action slides the hidden column back on the blocked course', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await addCourse(page, '90000002');
  const reveal = page.getByRole('button', { name: 'แสดงในรายการ' });
  await expect(reveal).toBeFocused();

  await page.getByRole('button', { name: HIDE }).click();
  await expect(page.locator(COLUMN)).toHaveAttribute('inert');
  await reveal.click();
  await expect(page.locator(COLUMN)).not.toHaveAttribute('inert');
  await expect(page.getByRole('button', { name: RAIL })).toHaveCount(0);
  await expect(page.locator('#kcp-course-toggle-90000002')).toBeFocused();
  await expect(reveal).toHaveCount(0);
});

test.describe('peek and slide at 1366 by 768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('the peek waits for the pointer to move off the rail after a hide', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await page.getByRole('button', { name: HIDE }).click();
    const rail = page.getByRole('button', { name: RAIL });
    await expect(rail).toHaveAttribute('data-peek-held');

    await page.waitForTimeout(PEEK_SETTLED_MS);
    await expect(page.locator(GHOST)).toHaveCSS('opacity', '0');

    // A point over the grid, well clear of the rail.
    await page.mouse.move(700, 400);
    await expect(rail).not.toHaveAttribute('data-peek-held');
    await rail.hover();
    await page.waitForTimeout(PEEK_SETTLED_MS);
    await expect(page.locator(GHOST)).toHaveCSS('opacity', '1');
    await expect(page.locator(GHOST)).toHaveCSS('transform', 'none');
  });

  test('the column slides by transform and rests with none', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await page.getByRole('button', { name: HIDE }).click();
    const rail = page.getByRole('button', { name: RAIL });
    await expect(rail).toBeVisible();
    await expect.poll(() => slideEffects(page)).toBe(0);

    await page.waitForTimeout(PAST_POINTER_GUARD_MS);
    await rail.click();
    expect(await slideEffects(page)).toBeGreaterThan(0);
    await expect.poll(() => slideEffects(page)).toBe(0);
    await expect(page.locator(COLUMN)).toHaveCSS('transform', 'none');
    await expect(page.locator(COLUMN)).toHaveCSS('visibility', 'visible');
  });

  test('with reduced motion the column shows on the next frame', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: HIDE }).click();
    const rail = page.getByRole('button', { name: RAIL });
    await expect(rail).toBeVisible();
    expect(await slideEffects(page)).toBe(0);

    await page.waitForTimeout(PAST_POINTER_GUARD_MS);
    await rail.click();
    const shown = await page.locator(COLUMN).evaluate(
      (node) =>
        new Promise<{ visibility: string; transform: string; effects: number }>(
          (resolve) => {
            requestAnimationFrame(() => {
              const style = getComputedStyle(node);
              resolve({
                visibility: style.visibility,
                transform: style.transform,
                effects: node.getAnimations().length,
              });
            });
          },
        ),
    );
    expect(shown).toEqual({
      visibility: 'visible',
      transform: 'none',
      effects: 0,
    });
  });
});

test.describe('on a touch screen at 1180 by 820', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('a tap on the rail opens the hidden column', async ({ context }) => {
    const page = await openPlanner(context);
    await tap(page, await centre(page.getByRole('button', { name: HIDE })));
    const rail = page.getByRole('button', { name: RAIL });
    await expect(rail).toBeVisible();

    await page.waitForTimeout(PAST_POINTER_GUARD_MS);
    await tap(page, await centre(rail));
    await expect(page.locator(COLUMN)).not.toHaveAttribute('inert');
    await expect(rail).toHaveCount(0);
  });
});

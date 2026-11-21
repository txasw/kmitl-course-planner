import { test, expect, gotoSelector } from './support/fixtures';
import { waitForInstallTab } from './support/onboarding';
import { isPhone } from './support/tiers';
import {
  TOUR,
  tourCard,
  walkTour,
  expectAddStepOnSearchFields,
  expectTourStepLaidOut,
  type TourStepName,
} from './support/tour';
import {
  chooseLanguage,
  openTourFromMenu,
  searchCurriculum,
} from './support/tourSetup';

// The product tour on a phone and a tablet with touch (ADR-0074). On the phone each step
// first shows the pane its control lives in, the catalog pane or the timetable pane, and
// on the tablet the catalog sheet opens for the catalog steps and closes for the plan
// steps, so the spotlight never lands on a hidden control. Every step passes the layout
// guard in both languages, and on the phone project at 360 px too, the narrowest width
// the panel must fit: the card covers neither its spotlight nor its own text, and its
// buttons are 44 px targets for a finger.

const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';
const MIN_TARGET_PX = 44;

const FULL_STEPS: readonly TourStepName[] = [
  'search',
  'add',
  'timetable',
  'suggest',
  'export',
];

const NAV_PANE = {
  search: 'catalog',
  add: 'catalog',
  timetable: 'plan',
  suggest: 'plan',
  export: null,
} as const;

test.describe('after install', () => {
  test.use({ onboarding: 'fresh' });

  test('starts once Start planning opens the panel and lays out the first step', async ({
    context,
  }) => {
    const tab = await waitForInstallTab(context);
    await tab
      .getByRole('dialog', { name: 'ขอบคุณที่ติดตั้ง KCP: Course Planner for KMITL' })
      .getByRole('button', { name: 'เริ่มวางแผน' })
      .tap();
    const card = tourCard(tab);
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toHaveText(TOUR.th.titles.search);
    await tab.waitForTimeout(300);
    await expectTourStepLaidOut(tab);
    for (const name of [TOUR.th.next, TOUR.th.skip]) {
      const box = await card.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
    // Before any search the add step lights the search fields, not the blocked submit.
    await card.getByRole('button', { name: TOUR.th.next, exact: true }).tap();
    await expectAddStepOnSearchFields(tab, 'th');
    await expectTourStepLaidOut(tab, 'th add before a search');
    await card.getByRole('button', { name: TOUR.th.skip }).tap();
    await expect(card).toHaveCount(0);
  });
});

const widths = [null, 360] as const;

for (const width of widths) {
  test(`walks every step on the real controls${width === null ? '' : ` at ${String(width)} px`} in both languages`, async ({
    context,
  }, testInfo) => {
    // The narrowest width is a phone concern; the tablet runs at its own size only.
    test.skip(
      width !== null && testInfo.project.name !== 'phone',
      'the 360 px pass runs on the phone project',
    );
    const page = await gotoSelector(context);
    if (width !== null) await page.setViewportSize({ width, height: 740 });
    await page.getByRole('button', { name: LAUNCHER }).tap();
    await searchCurriculum(page);

    const checkPane = async (step: TourStepName): Promise<void> => {
      if (!isPhone(page)) return;
      const pane = NAV_PANE[step];
      if (pane === null) return;
      const catalogHidden = await page
        .locator('#kcp-catalog-column')
        .evaluate((node) => node.closest('[inert]') !== null);
      expect(catalogHidden, step).toBe(pane === 'plan');
    };

    await openTourFromMenu(page, 'th');
    await walkTour(page, 'th', FULL_STEPS, checkPane);
    await tourCard(page).getByRole('button', { name: TOUR.th.finish }).tap();
    await expect(tourCard(page)).toHaveCount(0);

    await chooseLanguage(page, 'th', 'en');
    await openTourFromMenu(page, 'en');
    await walkTour(page, 'en', FULL_STEPS, checkPane);
    await tourCard(page).getByRole('button', { name: TOUR.en.finish }).tap();
    await expect(tourCard(page)).toHaveCount(0);
  });
}

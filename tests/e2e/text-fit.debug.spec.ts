import {
  test,
  expect,
  waitForResultsInput,
  waitForTermSettled,
} from './support/fixtures';
import { allowCoachMark, waitForInstallTab } from './support/onboarding';
import type { TextFitException } from './support/textFit';
import {
  HEIGHT,
  RESULTS_TIMEOUT,
  Sweep,
  WIDTHS,
  addCourse,
  blockDetail,
  dismissToasts,
  expandCourse,
  openAt,
  openSweep,
  pick,
  searchSubjectId,
  showCatalog,
  showTimetable,
  undoToast,
  type Language,
} from './support/textFitSweep';

// The clipped text sweep (ADR-0048 amendment). The owner rule is that no layout overlaps or
// clips text: every label shows whole, a Thai label wraps rather than ending in an ellipsis
// unless an explicit expand control reveals the rest, no chip sits over text, and no fixed
// height cuts a line. This spec walks every main surface of the panel at 360, 390, 768, and
// 1366 px, in Thai and in English, and fails on any text leaf a box cuts and any pair of text
// leaves that draw over each other, so a regression on any surface fails the suite.

// A walk this long fails at the step that stalls rather than at the test timeout.
test.use({ actionTimeout: 10_000 });

/**
 * The leaves the sweep excuses, each with the explicit affordance that shows the whole text.
 * Everything else must show whole.
 */
const EXCEPTIONS: readonly TextFitException[] = [
  {
    selector: '[data-collapsible-lines="collapsed"] li',
    reason:
      'a teacher, condition, or remark line rests as one line, and its expand control wraps every line in full',
  },
  {
    selector: '[data-plan-name]',
    reason:
      'a long plan name rests on one line in the header trigger, which opens the plan list that wraps every name whole',
  },
  {
    selector: '[data-gallery-sliver]',
    reason:
      'the neighbouring export templates show as dimmed slivers cropped at the stage edge, hidden from assistive technology, and the pager brings each one whole into view',
  },
];

/** A plan name longer than the header has room for at any width. */
const LONG_PLAN_NAME: Record<Language, string> = {
  th: 'ตารางเรียนภาคการศึกษาที่สองแบบเน้นเรียนช่วงเช้าและมีวันว่าง',
  en: 'Second semester plan with morning classes and a free day',
};

for (const language of ['th', 'en'] as const) {
  test.describe(`in ${language}`, () => {
    test('the launcher, coach mark, header, menus, and search form show whole', async ({
      context,
    }) => {
      test.setTimeout(300_000);
      await allowCoachMark(context);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await page.reload();
        const coach = page.getByRole('dialog', {
          name: sweep.t('coachMark.callout'),
        });
        await sweep.scan('coach mark', coach);
        await coach
          .getByRole('button', { name: sweep.t('coachMark.later') })
          .click();
        await sweep.scan(
          'launcher',
          page.getByRole('button', { name: sweep.t('launcher.open') }),
        );
      }
      for (const width of WIDTHS) {
        await openAt(sweep, width);
        if (!sweep.docked && !sweep.phone) await showTimetable(sweep);
        await sweep.scan('panel at rest', sweep.panel());
        await page
          .getByRole('button', { name: sweep.t('header.more') })
          .click();
        await sweep.scan('overflow menu', page.getByRole('menu'));
        await page.keyboard.press('Escape');

        await page
          .getByRole('button', { name: sweep.t('planSwitcher.label') })
          .click();
        const create = page.getByRole('button', {
          name: sweep.t('planSwitcher.create'),
        });
        const menu = sweep.phone
          ? page.getByRole('dialog', { name: sweep.t('planSwitcher.label') })
          : page.locator('.z-popover').filter({
              has: page.getByRole('textbox').or(create),
            });
        await sweep.scan('plan switcher', menu);
        await create.click();
        await sweep.scan('create plan form', menu);
        await page.keyboard.press('Escape');

        const catalog = await showCatalog(sweep);
        for (const tab of [
          'search.tab.byClass',
          'search.tab.bySubjectId',
          'search.tab.byCategory',
        ]) {
          await catalog
            .getByRole('tab', { name: sweep.t(tab), exact: true })
            .click();
          await sweep.scan(`search form ${tab}`, catalog);
        }
      }
      sweep.expectClean();
    });

    test('the catalog cards, rows, and filters show whole', async ({
      context,
    }) => {
      test.setTimeout(300_000);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      for (const width of WIDTHS) {
        await openAt(sweep, width);
        const catalog = await showCatalog(sweep);
        // The capture with exam windows holds the course with the longest teacher list.
        await searchSubjectId(sweep, catalog, '90000700', '90642036');
        await sweep.scan('catalog collapsed', catalog);
        await expandCourse(sweep, '90642036');
        await sweep.scan('catalog many teachers', catalog);
        // The long list rests on one line behind an expand control that wraps it whole.
        await catalog
          .getByRole('button', { name: sweep.t('section.teachers.showAll') })
          .first()
          .click();
        await sweep.scan('catalog teachers expanded', catalog);
        // The fit regression catalog holds the longest Thai names, with exam windows.
        await searchSubjectId(sweep, catalog, '90000600', '90000601');
        await expandCourse(sweep, '90000601');
        await sweep.scan('catalog long names', catalog);
        await catalog
          .getByRole('button', {
            name: new RegExp(`^${sweep.t('catalog.filter.label')}`),
          })
          .click();
        await sweep.scan(
          'filter popover',
          page.locator(`div[aria-label="${sweep.t('catalog.filter.label')}"]`),
        );
        await page.keyboard.press('Escape');
        await catalog
          .getByRole('combobox', { name: sweep.t('catalog.sort.label') })
          .click();
        await sweep.scan('sort list', page.getByRole('listbox'));
        await page.keyboard.press('Escape');
      }
      sweep.expectClean();
    });

    test('the timetable, block details, plan menus, and notices show whole', async ({
      context,
      mock,
    }) => {
      test.setTimeout(420_000);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      for (const width of WIDTHS) {
        mock.setFreshSynthetic(false);
        await openAt(sweep, width, context);
        const catalog = await showCatalog(sweep);
        // Three hour blocks with the longest Thai names, a pair, and exam windows.
        await searchSubjectId(sweep, catalog, '90000600', '90000601');
        for (const subject of [
          '90000601',
          '90000602',
          '90000603',
          '90000634',
        ]) {
          await addCourse(sweep, subject);
        }
        // The synthetic catalog: 90000005 on Tuesday afternoon fits, and 90000001 on
        // Monday morning clashes with 90000601, so its add routes to the feedback strip.
        await searchSubjectId(sweep, catalog, '90000000', '90000001');
        // The worker caches the moved variant the last width's check fetched, so the
        // result is reloaded to read the stable catalog again.
        await catalog
          .getByRole('button', { name: sweep.t('search.bar.refresh') })
          .click();
        await expect(
          catalog.locator('[data-course-card="90000005"]'),
        ).toBeVisible({ timeout: RESULTS_TIMEOUT });
        await waitForResultsInput(page);
        await addCourse(sweep, '90000005');
        await dismissToasts(sweep);
        const clash = await expandCourse(sweep, '90000001');
        await clash
          .getByRole('button', {
            name: new RegExp(`^${sweep.t('action.add')}`),
          })
          .first()
          .click();
        await sweep.scan(
          'feedback strip',
          sweep
            .panel()
            .locator('[aria-live="polite"]')
            .filter({ hasText: /\S/, visible: true })
            .filter({ has: page.getByRole('button') }),
        );
        if (!sweep.phone) {
          // The reason chip trails the grab card; at the window edge it slides back in.
          const row = clash.locator('[data-drag-surface="section"]').first();
          const from = await row.boundingBox();
          if (from === null) throw new Error('The section row is not laid out');
          // Grab the row by its section code, clear of the grip and the add rail.
          const grab = { x: from.x + from.width * 0.4, y: from.y + 14 };
          await page.mouse.move(grab.x, grab.y);
          await page.mouse.down();
          await page.mouse.move(grab.x + 30, grab.y + 30, { steps: 5 });
          await expect(page.locator('[data-drag-card]')).toBeVisible();
          await page.mouse.move(width - 4, HEIGHT - 4, { steps: 10 });
          await sweep.scan(
            'drag reason chip',
            page.locator('[data-drag-card]').locator('..'),
            { floating: true },
          );
          await page.mouse.up();
        }

        // The strip floats over the foot of the pane for its few seconds; it was read on
        // its own above, so it is dismissed to read the timetable as it rests. A drag since
        // has cleared it already on the wider tiers.
        const dismissStrip = sweep
          .panel()
          .getByRole('button', { name: sweep.t('feedback.dismiss') });
        if ((await dismissStrip.count()) > 0) await dismissStrip.click();
        await showTimetable(sweep);
        await dismissToasts(sweep);
        await sweep.scan('timetable', sweep.panel());
        if (sweep.phone) {
          await page
            .getByRole('radiogroup', { name: sweep.t('view.dayPicker') })
            .getByRole('radio', { name: sweep.t('view.weekChip') })
            .click();
          await sweep.scan('timetable week', sweep.panel());
        }

        await page
          .locator('[data-teach-table-id="960001"]')
          .filter({ visible: true })
          .first()
          .click();
        await sweep.scan('block detail', blockDetail(sweep));
        await page.keyboard.press('Escape');

        await page
          .getByRole('button', { name: sweep.t('planSwitcher.label') })
          .click();
        const menu = sweep.phone
          ? page.getByRole('dialog', { name: sweep.t('planSwitcher.label') })
          : page.locator('.z-popover').filter({
              has: page
                .getByRole('textbox')
                .or(page.getByText(sweep.t('planData.errorTitle')))
                .or(
                  page.getByRole('button', {
                    name: sweep.t('planSwitcher.create'),
                  }),
                ),
            });
        await sweep.scan('plan list', menu);
        await menu
          .getByRole('button', {
            name: new RegExp(`^${sweep.t('planSwitcher.rename')} `),
          })
          .first()
          .click();
        await sweep.scan('rename plan form', menu);
        // A long name rests on one line in the trigger, and the term under it stays whole.
        await menu
          .getByRole('textbox', { name: sweep.t('planSwitcher.nameLabel') })
          .fill(LONG_PLAN_NAME[language]);
        await menu
          .getByRole('button', {
            name: sweep.t('planSwitcher.save'),
            exact: true,
          })
          .click();
        await expect(menu).toHaveCount(0);
        await sweep.scan(
          'header with a long plan name',
          page.getByRole('banner'),
        );
        await page
          .getByRole('button', { name: sweep.t('planSwitcher.label') })
          .click();
        await sweep.scan('plan list with a long name', menu);
        await page.locator('input[type="file"]').setInputFiles({
          name: 'plan.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({ name: 1, year: '2569', entries: [{}] }),
          ),
        });
        await expect(
          menu.getByText(sweep.t('planData.errorTitle')),
        ).toBeVisible();
        await sweep.scan('import error', menu);
        await menu
          .getByRole('button', { name: sweep.t('action.back'), exact: true })
          .click();
        // The back press drops focus with the view it removes, so an Escape would reach
        // the panel and close it; the popover closes from its trigger instead.
        if (sweep.phone) {
          await page.keyboard.press('Escape');
        } else {
          await page
            .getByRole('button', { name: sweep.t('planSwitcher.label') })
            .click();
        }
        await expect(menu).toHaveCount(0);

        mock.setFreshSynthetic(true);
        await page
          .getByRole('group', { name: sweep.t('stats.region'), exact: true })
          .getByRole('button', { name: sweep.t('updates.recheck') })
          .click();
        const updates = page.getByRole('dialog', {
          name: sweep.t('updates.title'),
        });
        await expect(updates).toBeVisible({ timeout: RESULTS_TIMEOUT });
        await sweep.scan('updates dialog', updates);
        await page.keyboard.press('Escape');
        await expect(updates).toHaveCount(0);

        await page
          .locator('[data-teach-table-id="960002"]')
          .filter({ visible: true })
          .first()
          .click();
        await blockDetail(sweep)
          .getByRole('button', { name: sweep.t('block.removeFromPlan') })
          .click();
        await sweep.scan('undo toast', undoToast(sweep));
      }
      sweep.expectClean();
    });

    test('the suggest dialog and the export page show whole', async ({
      context,
    }) => {
      test.setTimeout(420_000);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      for (const width of WIDTHS) {
        await openAt(sweep, width, context);
        const catalog = await showCatalog(sweep);
        const edit = catalog.getByRole('button', {
          name: sweep.t('search.bar.edit'),
        });
        if ((await edit.count()) > 0) await edit.click();
        await catalog
          .getByRole('tab', {
            name: sweep.t('search.tab.byClass'),
            exact: true,
          })
          .click();
        await pick(catalog, sweep.t('search.faculty'), '01');
        await pick(catalog, sweep.t('search.department'), '05');
        await pick(
          catalog,
          sweep.t('search.curriculum'),
          language === 'th' ? 'ความปลอดภัยไซเบอร์' : 'Cyber Security',
        );
        await waitForTermSettled(catalog);
        await catalog
          .getByRole('button', { name: sweep.t('search.submit'), exact: true })
          .click();
        await expect(catalog.getByText('01006020').first()).toBeVisible({
          timeout: RESULTS_TIMEOUT,
        });
        await waitForResultsInput(page);
        await catalog
          .getByRole('button', { name: sweep.t('suggest.open') })
          .first()
          .click();
        const dialog = page.getByRole('dialog', {
          name: sweep.t('suggest.title'),
        });
        await expect(
          dialog
            .getByRole('button', { name: sweep.t('suggest.apply') })
            .first(),
        ).toBeVisible({ timeout: RESULTS_TIMEOUT });
        await sweep.scan('suggest choices', dialog);
        const expand = dialog.getByRole('button', {
          name: sweep.t('suggest.expand'),
        });
        if ((await expand.count()) > 0) {
          await expand.first().click();
          await sweep.scan('suggest option', dialog);
        }
        await dialog
          .getByRole('button', { name: sweep.t('suggest.apply') })
          .first()
          .click();
        await expect(dialog).toHaveCount(0);
        await showTimetable(sweep);
        await dismissToasts(sweep);
        await sweep.scan('timetable from a suggestion', sweep.panel());

        await page
          .getByRole('button', { name: sweep.t('mode.export'), exact: true })
          .click();
        for (const template of [
          'preview.template.share',
          'preview.template.phone',
          'preview.template.phonePortrait',
          'preview.template.tabletPortrait',
          'preview.template.tabletLandscape',
          'preview.template.printA4',
        ]) {
          await page
            .getByRole('radio', { name: new RegExp(sweep.t(template)) })
            .click();
          await sweep.scan(`export ${template}`, sweep.panel());
        }
        await page
          .getByRole('button', { name: sweep.t('preview.displayOptions') })
          .click();
        await sweep.scan(
          'display options',
          page
            .getByRole('dialog', { name: sweep.t('preview.displayOptions') })
            .or(
              page.locator(
                `div[aria-label="${sweep.t('preview.displayOptions')}"]`,
              ),
            ),
        );
        await page.keyboard.press('Escape');
      }
      sweep.expectClean();
    });
  });
}

test.describe('on a fresh install', () => {
  test.use({ onboarding: 'fresh' });

  // The welcome shows once, in the tab the worker opens on install, before any language
  // is chosen, so it is read in the default Thai at every width as the student meets it.
  test('the welcome shows whole', async ({ context }) => {
    const page = await waitForInstallTab(context);
    const sweep = new Sweep(page, 'th', EXCEPTIONS);
    const welcome = page.getByRole('dialog', {
      name: sweep.t('welcome.title'),
    });
    await expect(welcome).toBeVisible();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await sweep.scan('welcome', welcome);
    }
    sweep.expectClean();
  });
});

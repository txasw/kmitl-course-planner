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
  emptyStorage,
  expandCourse,
  fillStorage,
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
// 1366 px, in Thai and in English, and fails on any text leaf a box cuts, any pair of text
// leaves that draw over each other, and any text leaf another layer covers, so a regression
// on any surface fails the suite. The walk reads the timetable and the export page with a
// toast up and after a failed save, rests the pointer on the export template dots and the
// suggestion carousel chevrons past the tooltip delay, and walks the product tour. Behind the
// block details and the display options it reads the panel, where the opened layer may cover a
// line whole but its edge may cut none, and it checks the plan name field holds a long name.

// The block detail opens beside its block, with no room to avoid the blocks next to it, so
// its side edge may cut a line inside a timetable block and nowhere else.
const BESIDE_BLOCK = ['[data-teach-table-id]'] as const;

// A walk this long fails at the step that stalls rather than at the test timeout.
test.use({ actionTimeout: 10_000 });

/**
 * The leaves the sweep excuses, each naming the explicit control that shows the whole text,
 * which must be on show beside the leaf for the leaf to be excused. Everything else must
 * show whole.
 */
const EXCEPTIONS: readonly TextFitException[] = [
  {
    selector: '[data-collapsible-lines="collapsed"] li',
    scope: '[data-collapsible-lines="collapsed"]',
    control: ':scope > button[aria-expanded="false"]',
    reason:
      'a teacher, condition, or remark list longer than two lines rests at two, and its expand control wraps every line in full',
  },
  {
    // The owner approved exception to the no ellipsis rule (ADR-0048 amendment of
    // 2026-11-22): a change section choice keeps its instructors on one line.
    selector: '[data-teacher-scroll] li',
    scope: '[data-teacher-scroll]',
    control: '[data-teacher-scroll][role="region"][tabindex="0"]',
    reason:
      'the instructor line of a change section choice ends in an ellipsis past its edge, and the line itself is a named tab stop that scrolls sideways to every name',
  },
];

/** The layers of the product tour that dim the panel on purpose, read through. */
const TOUR_DIM = ['[data-product-tour]', '.kcp-tour-dim'];

/** A plan name longer than the header has room for at any width. */
const LONG_PLAN_NAME: Record<Language, string> = {
  th: 'ตารางเรียนภาคการศึกษาที่สองแบบเน้นเรียนช่วงเช้าและมีวันว่าง',
  en: 'Second semester plan with morning classes and a free day',
};

// The phone plan sheet is titled by the view it shows (list, create, rename, delete, or the
// import error), so the sweep finds it by any of those titles rather than the list title alone.
const PLAN_SHEET_TITLES = [
  'planSwitcher.label',
  'planSwitcher.create',
  'planSwitcher.renameTitle',
  'planSwitcher.deleteTitle',
  'planData.import',
] as const;

function planSheetName(sweep: Sweep): RegExp {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const titles = PLAN_SHEET_TITLES.map((key) => escape(sweep.t(key)));
  return new RegExp(`^(${titles.join('|')})$`);
}

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
          ? page.getByRole('dialog', { name: planSheetName(sweep) })
          : page.locator('.z-popover').filter({
              has: page.getByRole('textbox').or(create),
            });
        await sweep.scan('plan switcher', menu);
        await create.click();
        await sweep.scan('create plan form', menu);
        // A long name wraps in the field rather than scrolling it to its end.
        const createName = menu.getByRole('textbox', {
          name: sweep.t('planSwitcher.nameLabel'),
        });
        await createName.fill(LONG_PLAN_NAME[language]);
        await sweep.scan('create plan form with a long name', menu);
        await sweep.expectFieldWhole(
          'create plan form with a long name',
          createName,
        );
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
        // The long list rests at two lines behind an expand control that wraps it whole.
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

    test('the change section choices show whole', async ({ context }) => {
      test.setTimeout(300_000);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      for (const width of WIDTHS) {
        await openAt(sweep, width, context);
        const catalog = await showCatalog(sweep);
        // From the capture with exam windows: 01076311 section 2 leaves section 1, three
        // Sunday meetings with no room and 21 instructors, as its choice; 01006020 offers a
        // section with four instructors; and the 01076002 pair offers the other pair.
        await searchSubjectId(sweep, catalog, '90000700', '01076311');
        const longest = await expandCourse(sweep, '01076311');
        await longest
          .getByRole('button', {
            name: new RegExp(`^${sweep.t('action.add')}`),
          })
          .nth(1)
          .click();
        await addCourse(sweep, '01006020');
        await addCourse(sweep, '01076002');
        await showTimetable(sweep);
        await dismissToasts(sweep);
        await (
          sweep.phone
            ? page
                .getByRole('navigation', { name: sweep.t('nav.label') })
                .getByRole('button', {
                  name: new RegExp(`^${sweep.t('nav.selected')}`),
                })
            : page.getByRole('tab', {
                name: new RegExp(`^${sweep.t('planView.selected')}`),
              })
        ).click();
        const toggles = sweep.panel().getByRole('button', {
          name: new RegExp(`^${sweep.t('change.open')}`),
        });
        await expect(toggles).toHaveCount(3);
        for (const toggle of await toggles.all()) await toggle.click();
        // The instructor line that holds more than it shows is a tab stop.
        await expect(
          sweep
            .panel()
            .getByRole('region', { name: sweep.t('section.teachers.label') }),
        ).not.toHaveCount(0);
        // The browser reads each choice's instructor names as its description, whatever
        // the scroll; jsdom computes descriptions differently, so this is checked here.
        const choices = sweep
          .panel()
          .getByRole('list', { name: sweep.t('change.listLabel') })
          .locator('button[aria-describedby]');
        await expect(choices).not.toHaveCount(0);
        for (const choice of await choices.all()) {
          const id = await choice.getAttribute('aria-describedby');
          const names = await sweep
            .panel()
            .locator(`[id="${String(id)}"]`)
            .innerText();
          await expect(choice).toHaveAccessibleDescription(
            names.replace(/\s+/g, ' ').trim(),
          );
        }
        await sweep.scan('change section choices', sweep.panel());
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
        await sweep.checkBlockNames('timetable', sweep.panel());
        if (sweep.phone) {
          await page
            .getByRole('radiogroup', { name: sweep.t('view.dayPicker') })
            .getByRole('radio', { name: sweep.t('view.weekChip') })
            .click();
          await sweep.scan('timetable week', sweep.panel());
          await sweep.checkBlockNames('timetable week', sweep.panel());
        }

        await page
          .locator('[data-teach-table-id="960001"]')
          .filter({ visible: true })
          .first()
          .click();
        await sweep.scan('block detail', blockDetail(sweep));
        await sweep.scan('panel behind the block detail', sweep.panel(), {
          behind: true,
          besideAnchor: BESIDE_BLOCK,
        });
        await page.keyboard.press('Escape');

        await page
          .getByRole('button', { name: sweep.t('planSwitcher.label') })
          .click();
        const menu = sweep.phone
          ? page.getByRole('dialog', { name: planSheetName(sweep) })
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
        // A long name wraps whole in the field, then shows whole in the trigger with the term
        // under it.
        const renameName = menu.getByRole('textbox', {
          name: sweep.t('planSwitcher.nameLabel'),
        });
        await renameName.fill(LONG_PLAN_NAME[language]);
        await sweep.scan('rename plan form with a long name', menu);
        await sweep.expectFieldWhole(
          'rename plan form with a long name',
          renameName,
        );
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
        const statusRow = page.getByRole('group', {
          name: sweep.t('stats.region'),
          exact: true,
        });
        if (sweep.phone) {
          // The phone row folds the status into its glyph; a tap reveals the words and the
          // check action, which the sweep reads before it checks again.
          await statusRow.locator('[data-verification] button').click();
          await sweep.scan(
            'status reveal',
            statusRow.locator('[data-status-reveal]'),
            { floating: true },
          );
        }
        await statusRow
          .getByRole('button', { name: sweep.t('updates.recheck') })
          .click();
        const updates = page.getByRole('dialog', {
          name: sweep.t('updates.title'),
        });
        await expect(updates).toBeVisible({ timeout: RESULTS_TIMEOUT });
        await sweep.scan('updates dialog', updates);
        await page.keyboard.press('Escape');
        await expect(updates).toHaveCount(0);

        // The check against the moved variant left 90000005 missing, the tallest detail, with
        // its no longer listed line, its exams, and the term it was added from. It keeps to
        // the plan area, so its edge cuts no line of the status row under it.
        await page
          .locator('[data-teach-table-id="900005"]')
          .filter({ visible: true })
          .first()
          .click();
        await expect(
          blockDetail(sweep)
            .getByText(sweep.t('verify.missing'), { exact: true })
            .first(),
        ).toBeVisible();
        await sweep.scan('missing entry detail', blockDetail(sweep));
        await sweep.scan(
          'panel behind the missing entry detail',
          sweep.panel(),
          { behind: true, besideAnchor: BESIDE_BLOCK },
        );
        await page.keyboard.press('Escape');
        await expect(blockDetail(sweep)).toHaveCount(0);
        // The pointer leaves the block, whose hover card would otherwise open over the next.
        await page.mouse.move(0, 0);

        await page
          .locator('[data-teach-table-id="960002"]')
          .filter({ visible: true })
          .first()
          .click();
        await blockDetail(sweep)
          .getByRole('button', { name: sweep.t('block.removeFromPlan') })
          .click();
        await sweep.scan('undo toast', undoToast(sweep));
        // The plan region makes room for the toast, so the status row stays whole above it.
        await sweep.scan('timetable with the undo toast', sweep.panel());

        // A save that fails shows its strip under the header and no toast over the plan.
        // The plan is copied with storage full, a change the save then cannot store.
        await fillStorage(context);
        try {
          await page
            .getByRole('button', { name: sweep.t('planSwitcher.label') })
            .click();
          await menu
            .getByRole('button', {
              name: new RegExp(`^${sweep.t('planSwitcher.duplicate')} `),
            })
            .first()
            .click();
          await expect(menu).toHaveCount(0);
          await expect(
            sweep.panel().getByText(sweep.t('save.failed'), { exact: true }),
          ).toBeVisible();
          // The menu closed under the pointer, which may now rest on a block and hold its
          // hover card open; a touch device has no such card, so the pointer leaves first.
          await page.mouse.move(0, 0);
          await sweep.scan('timetable after a failed save', sweep.panel());
        } finally {
          await emptyStorage(context);
        }
      }
      sweep.expectClean();
    });

    test('the suggest dialog and the export page show whole', async ({
      context,
    }) => {
      test.setTimeout(420_000);
      const sweep = await openSweep(context, language, EXCEPTIONS);
      const { page } = sweep;
      // The status row keeps its suggest action before a curriculum search, and until one
      // runs it opens the note that offers that search: the bottom sheet on a phone and a
      // dialog wider up. No search has run in this context yet, so the note shows at
      // every width.
      for (const width of WIDTHS) {
        await openAt(sweep, width, context);
        await showTimetable(sweep);
        await sweep
          .panel()
          .getByRole('group', { name: sweep.t('stats.region'), exact: true })
          .getByRole('button', { name: sweep.t('suggest.openShort') })
          .click();
        const note = page.getByRole('dialog', {
          name: sweep.t('suggest.title'),
        });
        await expect(note.locator('[data-suggest-needs-search]')).toBeVisible();
        await sweep.scan('suggest before a curriculum search', note);
        await page.keyboard.press('Escape');
        await expect(note).toHaveCount(0);
      }
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
        // From the second width on the form reopens under the bar of the last search.
        await sweep.scan('curriculum search form filled', catalog);
        await sweep.expectSearchFormWhole('curriculum search form filled');
        await catalog
          .getByRole('button', { name: sweep.t('search.submit'), exact: true })
          .click();
        await expect(catalog.getByText('01006020').first()).toBeVisible({
          timeout: RESULTS_TIMEOUT,
        });
        await waitForResultsInput(page);
        // The phone form reopened under the bar of the search fills the pane over its
        // pinned action row, which carries the cancel and the clear search, so no control
        // rests half cut at the foot of the form behind the bottom nav.
        if (sweep.phone) {
          await catalog
            .getByRole('button', { name: sweep.t('search.bar.edit') })
            .first()
            .click();
          await sweep.scan('curriculum search form reopened', catalog);
          await sweep.expectPinnedRowLast('curriculum search form reopened');
          await catalog
            .getByRole('button', {
              name: sweep.t('search.cancelEdit'),
              exact: true,
            })
            .click();
        }
        // The docked column carries no entry of its own; the status row beside it does.
        await (
          sweep.docked
            ? sweep
                .panel()
                .getByRole('group', {
                  name: sweep.t('stats.region'),
                  exact: true,
                })
                .getByRole('button', { name: sweep.t('suggest.openShort') })
            : catalog.getByRole('button', { name: sweep.t('suggest.open') })
        ).click();
        const dialog = page.getByRole('dialog', {
          name: sweep.t('suggest.title'),
        });
        await expect(
          dialog
            .getByRole('button', { name: sweep.t('suggest.apply') })
            .first(),
        ).toBeVisible({ timeout: RESULTS_TIMEOUT });
        await sweep.scan('suggest first option', dialog);
        await sweep.checkBlockNames('suggest options', dialog);
        // The second slide of the carousel, then the subject tick list with every group open.
        await dialog
          .getByRole('button', { name: sweep.t('suggest.next') })
          .click();
        await sweep.scan('suggest second option', dialog);
        // The chevrons show at every width and carry no tooltip. The pointer rests on each
        // enabled one past the tooltip delay, so anything that opens over the position line
        // or the controls around it is read as covering them.
        for (const chevron of ['suggest.prev', 'suggest.next']) {
          const button = dialog.getByRole('button', { name: sweep.t(chevron) });
          if (!(await button.isEnabled())) continue;
          await button.hover();
          await page.waitForTimeout(500);
          await expect(page.getByRole('tooltip')).toHaveCount(0);
          await sweep.scan(`suggest ${chevron} with the pointer on it`, dialog);
        }
        await page.mouse.move(0, 0);
        // The lists of the slide on show, behind their chevron disclosures, read whole.
        const slideToggles = dialog
          .locator('[data-suggest-slide]:not([inert])')
          .locator('button[aria-expanded="false"]');
        while ((await slideToggles.count()) > 0) {
          await slideToggles.first().click();
        }
        await sweep.scan('suggest option lists', dialog);
        const subjects = dialog.getByRole('group', {
          name: sweep.t('suggest.subjects'),
        });
        // One group opens at a time, each behind its segment, and an open list shows its
        // first rows and a control for the rest, so each group is opened in full and read.
        const segments = subjects.locator('button[aria-expanded]');
        const morePrefix =
          sweep.t('suggest.subjects.more').split('{count}')[0] ?? '';
        const segmentCount = await segments.count();
        for (let index = 0; index < segmentCount; index += 1) {
          const segment = segments.nth(index);
          if ((await segment.getAttribute('aria-expanded')) === 'false') {
            await segment.click();
          }
          const more = subjects.getByRole('button', {
            name: new RegExp(`^${morePrefix}`),
          });
          if ((await more.count()) > 0) await more.click();
          await sweep.scan(`suggest subject list ${String(index + 1)}`, dialog);
        }
        // The slides off screen are inert, so the plan is applied from the slide on show.
        await dialog
          .locator('[data-suggest-slide]:not([inert])')
          .getByRole('button', { name: sweep.t('suggest.apply') })
          .click();
        await expect(dialog).toHaveCount(0);
        await showTimetable(sweep);
        await dismissToasts(sweep);
        await sweep.scan('timetable from a suggestion', sweep.panel());
        await sweep.checkBlockNames(
          'timetable from a suggestion',
          sweep.panel(),
        );
        // Opened again from the status row, the dialog lists the plan's own subjects.
        await sweep
          .panel()
          .getByRole('group', { name: sweep.t('stats.region'), exact: true })
          .getByRole('button', { name: sweep.t('suggest.openShort') })
          .click();
        await dialog
          .getByRole('button', {
            name: new RegExp(`^${sweep.t('suggest.segment.planned')}`),
          })
          .click();
        await expect(
          dialog.getByRole('region', {
            name: sweep.t('suggest.group.planned'),
          }),
        ).toBeVisible();
        await sweep.scan('suggest with the plan subjects', dialog);
        // The clear plan warning reads whole, then is cancelled.
        await dialog
          .getByRole('button', { name: sweep.t('suggest.clear') })
          .click();
        await sweep.scan('suggest clear plan warning', dialog);
        await dialog
          .getByRole('button', { name: sweep.t('action.cancel'), exact: true })
          .click();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

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
          await sweep.checkBlockNames(`export ${template}`, sweep.panel());
          // The pointer rests on the dot it just pressed, past the tooltip delay, so
          // anything that opens over the caption is read as covering it.
          await page.waitForTimeout(500);
          await sweep.scan(
            `export ${template} with the pointer on its dot`,
            sweep.panel(),
          );
        }
        await page
          .getByRole('button', { name: sweep.t('preview.copyText') })
          .click();
        await expect(
          page
            .locator('[aria-live="polite"][aria-atomic="true"]')
            .getByRole('button', {
              name: sweep.t('action.dismiss'),
              exact: true,
            }),
        ).toBeVisible();
        await sweep.scan('export page with a toast', sweep.panel());
        await dismissToasts(sweep);
        await page
          .getByRole('button', { name: sweep.t('preview.displayOptions') })
          .click();
        // Below 640 px the options are a modal sheet over the page; from 640 px up they are an
        // inline panel that pushes the chips and the stage down, so the page with it open is
        // read as a page, with nothing over it to excuse.
        const options = sweep.phone
          ? page.getByRole('dialog', {
              name: sweep.t('preview.displayOptions'),
            })
          : page.getByRole('region', {
              name: sweep.t('preview.displayOptions'),
            });
        await expect(options).toBeVisible();
        await sweep.scan('display options', options);
        if (sweep.phone) {
          await sweep.scan(
            'export page behind the display options',
            sweep.panel(),
            { behind: true },
          );
        } else {
          await sweep.scan(
            'export page with the display options open',
            sweep.panel(),
          );
        }
        await page.keyboard.press('Escape');
        await expect(options).toBeHidden();
      }
      sweep.expectClean();
    });
  });
}

for (const language of ['th', 'en'] as const) {
  test(`in ${language} the product tour shows whole at every step`, async ({
    context,
  }) => {
    test.setTimeout(300_000);
    const sweep = await openSweep(context, language, EXCEPTIONS);
    const { page } = sweep;
    for (const width of WIDTHS) {
      await openAt(sweep, width);
      await page.getByRole('button', { name: sweep.t('header.more') }).click();
      await page.getByRole('menuitem', { name: sweep.t('tour.menu') }).click();
      const card = page.locator('[data-tour-card]');
      const finish = card.getByRole('button', {
        name: sweep.t('tour.finish'),
        exact: true,
      });
      for (let step = 1; ; step += 1) {
        // The spotlight glides between targets; the scan reads where it rests.
        await page.waitForTimeout(300);
        await sweep.scan(`tour step ${String(step)}`, card);
        // The card rests clear of the phone bottom nav, whose labels show whole under the dim.
        if (sweep.phone) {
          await sweep.scan(
            `tour step ${String(step)} bottom nav`,
            page.getByRole('navigation', { name: sweep.t('nav.label') }),
            { seeThrough: TOUR_DIM },
          );
        }
        if ((await finish.count()) > 0) break;
        await card
          .getByRole('button', { name: sweep.t('tour.next'), exact: true })
          .click();
      }
      await finish.click();
      await expect(card).toHaveCount(0);
    }
    sweep.expectClean();
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

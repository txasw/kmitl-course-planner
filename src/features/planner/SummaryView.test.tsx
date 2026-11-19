import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
import { searchTabId } from '@/features/search/searchIds';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import { installViewport } from '../../../tests/support/viewport';
import { SummaryView } from './SummaryView';

// The empty summary's go to courses action brings the catalog into view at its search
// on every tier. Where the docked column already shows, the reveal changes nothing on
// screen and a focus moved by script after a click paints no ring, so the action asks
// the browser for the ring and lets the focus scroll the tab into view, or it reads as
// dead. jsdom matches no :focus-visible, so the focus options are recorded instead.
let tab: HTMLButtonElement;

function renderEmptySummary() {
  render(
    <SummaryView
      schedule={buildExamSchedule([])}
      hours={{ lecture: 0, practice: 0, selfStudy: 0, unstated: 0 }}
      meetings={[]}
      hasEntries={false}
      locale="th"
      t={createTranslator('th')}
    />,
  );
  return screen.getByRole('button', { name: 'ไปที่รายวิชา' });
}

beforeEach(() => {
  searchStore.getState().setActiveTab('by_class');
  tab = document.createElement('button');
  tab.id = searchTabId('by_class');
  document.body.append(tab);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  uiStore.getState().setSheetOpen(false);
  uiStore.getState().setCatalogVisible(true);
  uiStore.setState({ mobilePane: null });
});

describe('SummaryView go to courses', () => {
  it('marks the focus on the search in a docked column already shown at 1366 px', () => {
    installViewport(1366);
    const focus = vi.spyOn(tab, 'focus');
    fireEvent.click(renderEmptySummary());
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(tab).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ focusVisible: true });
  });

  it('slides a hidden docked column back and focuses the search at 1366 px', () => {
    installViewport(1366);
    uiStore.getState().setCatalogVisible(false);
    fireEvent.click(renderEmptySummary());
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(tab).toHaveFocus();
  });

  it('opens the sheet and focuses the search at 768 px', () => {
    installViewport(768);
    fireEvent.click(renderEmptySummary());
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(tab).toHaveFocus();
  });

  it('shows the catalog pane and focuses the search below 640 px', () => {
    uiStore.setState({ mobilePane: 'plan' });
    fireEvent.click(renderEmptySummary());
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(tab).toHaveFocus();
  });
});

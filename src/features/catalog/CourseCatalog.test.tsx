import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { loadFixture } from '../../../tests/support/fixtures';
import { makeCourse } from '../../../tests/support/domain-builders';
import {
  normalizeTeachTable,
  type NormalizedCatalog,
} from '@/lib/domain/normalize';
import { catalogStore } from './catalogStore';
import { CourseCatalog } from './CourseCatalog';

function ownerCatalog(): NormalizedCatalog {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_owner_id-32.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  return result.value;
}

const catalog = ownerCatalog();

beforeEach(() => {
  act(() => {
    catalogStore.getState().resetFilter();
  });
});

afterEach(cleanup);

describe('CourseCatalog', () => {
  it('reports the dedupe summary from the normalized totals', () => {
    const { container } = render(
      <CourseCatalog catalog={catalog} onRefresh={() => undefined} />,
    );
    // The owner 32 capture dedupes 13 raw rows to 4 sections across 3 courses.
    expect(container.textContent).toContain('3 รายวิชา');
    expect(container.textContent).toContain('4 กลุ่มเรียน');
    expect(container.textContent).toContain('9 รายการซ้ำที่รวมแล้ว');
  });

  it('invokes the refresh callback from the refresh control', () => {
    const onRefresh = vi.fn();
    render(<CourseCatalog catalog={catalog} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders the deduped courses under their subject type heading', () => {
    // After dedupe every owner 32 subject resolves to the GenEd heading.
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expect(
      screen.getByRole('heading', { name: /กลุ่ม 1/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });

  it('splits courses into separate heading groups', () => {
    const multiGroup: NormalizedCatalog = {
      duplicateCount: 0,
      warnings: [],
      courses: [
        makeCourse({
          subjectId: '90000001',
          groupNameTh: 'กลุ่มเอ',
          groupNameEn: 'Group A',
        }),
        makeCourse({
          subjectId: '90000002',
          groupNameTh: 'กลุ่มบี',
          groupNameEn: 'Group B',
        }),
      ],
    };
    render(<CourseCatalog catalog={multiGroup} onRefresh={() => undefined} />);
    expect(
      screen.getByRole('heading', { name: 'กลุ่มเอ' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'กลุ่มบี' }),
    ).toBeInTheDocument();
  });

  it('filters the courses by free text', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox', { name: 'ค้นหาในรายการ' }), {
      target: { value: '90592033' },
    });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });
});

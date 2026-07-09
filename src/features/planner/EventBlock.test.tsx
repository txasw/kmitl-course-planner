import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  within,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { Meeting } from '@/lib/domain/types';
import { EventBlock } from './EventBlock';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

const section: PlacedSection = {
  teachTableId: 't1',
  subjectId: '90592033',
  section: '901',
  nameTh: 'วิชาทดสอบ',
  nameEn: 'Test subject',
  credit: 3,
  kind: 'lecture',
  meetings: [],
  verifyStatus: 'unverified',
};

const meeting: Meeting = {
  day: 1,
  startMin: 540,
  endMin: 720,
  room: 'A101',
  building: 'A',
  kind: 'lecture',
};

afterEach(cleanup);

describe('EventBlock', () => {
  it('shows the subject id, section, name, and room', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(within(block).getByText('901')).toBeInTheDocument();
    expect(within(block).getByText('A101')).toBeInTheDocument();
  });

  it('badges a missing section as danger', () => {
    render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/ไม่พบในระบบแล้ว/)).toHaveAttribute(
      'data-verify',
      'danger',
    );
  });

  it('badges a changed section as warn', () => {
    render(
      <EventBlock
        section={{ ...section, verifyStatus: 'changed' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/ข้อมูลเปลี่ยน/)).toHaveAttribute(
      'data-verify',
      'warn',
    );
  });

  it('badges a conflicted section as danger', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        conflicted
      />,
    );
    expect(screen.getByLabelText(/เวลาชนกัน/)).toHaveAttribute(
      'data-verify',
      'danger',
    );
  });

  it('fills with the subject stable color', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block.style.backgroundColor).not.toBe('');
  });

  it('omits the room line when there is no room', () => {
    render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, room: '' }}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('A101')).not.toBeInTheDocument();
  });

  it('shows the English name in the English locale', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Test subject')).toBeInTheDocument();
  });

  it('hides the section code when showSection is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showSection={false}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).queryByText('901')).not.toBeInTheDocument();
  });

  it('hides the room when showRoom is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showRoom={false}
      />,
    );
    expect(screen.queryByText('A101')).not.toBeInTheDocument();
  });

  it('adds the English name under a Thai primary when showEnglishName is on', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showEnglishName
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(within(block).getByText('Test subject')).toBeInTheDocument();
  });

  it('does not duplicate the English name when it is already the primary', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
        showEnglishName
      />,
    );
    expect(screen.getAllByText('Test subject')).toHaveLength(1);
  });

  it('renders a remove control that fires onRemove in edit mode', () => {
    const onRemove = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onRemove={onRemove}
        removeLabel={t('action.remove')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('action.remove') }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders no remove control without onRemove', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the detail popover anchored to the block in edit mode', () => {
    const onOpenDetail = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onOpenDetail={onOpenDetail}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('block.details') }));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    const anchor = onOpenDetail.mock.calls[0]?.[0] as HTMLElement;
    expect(anchor.dataset.teachTableId).toBe('t1');
  });
});

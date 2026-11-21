import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TARGET_SIZE } from '@/lib/ui/target';
import { ImportErrorView } from './ImportErrorView';

afterEach(cleanup);

describe('ImportErrorView', () => {
  it('lists every issue and goes back from a touch sized control', () => {
    const onBack = vi.fn();
    render(
      <ImportErrorView issues={['ชื่อตาราง: ต้องเป็นข้อความ']} onBack={onBack} />,
    );
    expect(screen.getByText('ชื่อตาราง: ต้องเป็นข้อความ')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: 'ย้อนกลับ' });
    for (const token of TARGET_SIZE.split(' ')) {
      expect(back).toHaveClass(token);
    }
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });
});

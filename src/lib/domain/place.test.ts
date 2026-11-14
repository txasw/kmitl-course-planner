import { describe, it, expect } from 'vitest';
import { readableBuilding } from './place';

describe('readableBuilding', () => {
  it('prefers the readable classbuilding over the building code', () => {
    expect(readableBuilding('สำนักหอสมุดกลาง', 'ห้องประชุม', 'ชั้น 5')).toBe(
      'สำนักหอสมุดกลาง',
    );
    expect(readableBuilding('คณะบริหารธุรกิจ', 'ตึกบุนนาค', 'KBS - 205')).toBe(
      'คณะบริหารธุรกิจ',
    );
  });

  it('trims the classbuilding', () => {
    expect(readableBuilding('  HM  ', ' 7 ชั้น', 'ห้องสมุด')).toBe('HM');
  });

  it('falls back to the trimmed building code when the name is empty or null', () => {
    expect(readableBuilding(null, ' IT ', 'slope')).toBe('IT');
    expect(readableBuilding('   ', '223', 'slope')).toBe('223');
  });

  it('returns an empty building when both fields are empty', () => {
    expect(readableBuilding(null, null, '')).toBe('');
  });

  it('drops the building when the room opens with the code of the building number', () => {
    expect(readableBuilding('ปฏิบัติการ-2', 'ECC', 'ECC-CE804')).toBe('');
    expect(readableBuilding('อาคาร 12 ชั้น', 'E12', 'E12- 506')).toBe('');
    expect(readableBuilding('HM', ' 7 ชั้น', 'HM 603')).toBe('');
  });

  it('drops the building when the room opens with the trailing code of the name', () => {
    expect(readableBuilding('พระเทพฯ-D', null, 'D-510')).toBe('');
  });

  it('matches the code case insensitively', () => {
    expect(readableBuilding('me', null, 'ME-408')).toBe('');
  });

  it('keeps the building when the room code names a different building', () => {
    expect(readableBuilding('เจ้าคุณทหารฯ', 'AG-20', 'C 201/1')).toBe(
      'เจ้าคุณทหารฯ',
    );
    expect(readableBuilding('IT', '223', 'slope')).toBe('IT');
  });

  it('keeps the building when the room opens with Thai text or a digit', () => {
    expect(readableBuilding('อาคาร 12 ชั้น', 'E12', 'ประชุม-2')).toBe(
      'อาคาร 12 ชั้น',
    );
    expect(
      readableBuilding('อาคาร B เรียนรวม (ชุมพร)', '1000', '1000-17'),
    ).toBe('อาคาร B เรียนรวม (ชุมพร)');
  });
});

import { describe, expect, it } from 'vitest';
import { insideForbidden, isDeniedLabel } from './denylist';

// The denylist holds every clickable label of the tested host build in both languages and
// matches only the target's own text, exactly.

describe('isDeniedLabel', () => {
  it.each([
    'ดำเนินการต่อ',
    'Continue',
    'Continuous',
    'ยืนยัน',
    'Confirm',
    'กลับไปดูข้อมูล',
    'Back',
    'ย้อนกลับ',
    'ตกลง',
    'OK',
    'ยกเลิก',
    'Cancel',
    'ถอน',
    'Withdraw',
    'เปลี่ยน',
    'Change',
    'บันทึก',
    'Save',
    'ส่ง',
    'Submit',
    'ลงทะเบียน',
    'Register',
    'ยกเลิกคิว',
    'ปิด',
  ])('refuses %s, also with the host padding', (label) => {
    expect(isDeniedLabel(label)).toBe(true);
    expect(isDeniedLabel(`  ${label} `)).toBe(true);
  });

  it('leaves out the two labels a handle checks positively', () => {
    for (const label of ['เพิ่ม', 'Add', 'รับทราบ', 'Acknowledged']) {
      expect(isDeniedLabel(label)).toBe(false);
    }
  });

  it('never matches by substring, so course names and codes pass', () => {
    for (const text of [
      'Continuous Integration',
      'Back-end Development',
      'ยืนยันตัวตน 101',
      '901',
      '1 (วิศวกรรมคอมพิวเตอร์)',
    ]) {
      expect(isDeniedLabel(text)).toBe(false);
    }
  });
});

describe('insideForbidden', () => {
  function tree(html: string): Element {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.body.replaceChildren(...parsed.body.childNodes);
    const target = document.querySelector('[data-target]');
    if (target === null) throw new Error('no target');
    return target;
  }

  it('refuses a target in a dialog, a form, or a commit colour', () => {
    for (const html of [
      '<div class="v-dialog"><button data-target></button></div>',
      '<div role="dialog"><button data-target></button></div>',
      '<form><button data-target></button></form>',
      '<div class="deep-orange"><span data-target></span></div>',
      '<button class="warning" data-target></button>',
      '<button type="submit" data-target></button>',
      '<div class="v-menu__content"><div data-target></div></div>',
    ]) {
      expect(insideForbidden(tree(html), [])).toBe(true);
    }
  });

  it('exempts only the container a handle names, never one above it', () => {
    const option = tree(
      '<div class="v-dialog"><div class="v-menu__content"><div data-target></div></div></div>',
    );
    const menu = option.parentElement;
    if (menu === null) throw new Error('no menu');
    expect(insideForbidden(option, [menu])).toBe(true);
    const plain = tree(
      '<div class="v-menu__content"><div data-target></div></div>',
    );
    expect(
      insideForbidden(plain, plain.parentElement ? [plain.parentElement] : []),
    ).toBe(false);
  });

  it('lets a control in the add card through', () => {
    expect(
      insideForbidden(
        tree(
          '<div class="v-card"><div class="mt-2"><button class="green" data-target></button></div></div>',
        ),
        [],
      ),
    ).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { createTranslator } from '../i18n/t';
import { DEFAULT_DISPLAY_OPTIONS } from '../planner/displayOptions';
import {
  formatPlanText,
  type PlanTextExamLine,
  type PlanTextSection,
} from './planText';

// A three subject plan: two scheduled sections, one of them missing upstream, and
// one unscheduled online course, which is the shape the acceptance criteria pin.
const scheduled: PlanTextSection = {
  subjectId: '90592008',
  nameTh: 'สังคมไทยในวันนี้',
  nameEn: "TODAY'S THAI SOCIETY",
  section: '901',
  credit: 3,
  verifyStatus: 'verified',
  meetings: [
    {
      day: 1,
      startMin: 540,
      endMin: 660,
      room: 'A101',
      building: 'A',
      kind: 'lecture',
    },
  ],
};

const missing: PlanTextSection = {
  subjectId: '90592033',
  nameTh: 'ปรัชญาเบื้องต้น',
  nameEn: 'Introduction to Philosophy',
  section: '902',
  credit: 3,
  verifyStatus: 'missing',
  meetings: [
    {
      day: 3,
      startMin: 780,
      endMin: 900,
      room: 'B202',
      building: 'B',
      kind: 'lecture',
    },
  ],
};

const online: PlanTextSection = {
  subjectId: '01006029',
  nameTh: 'วิชาออนไลน์',
  nameEn: 'Online subject',
  section: '1',
  credit: 3,
  verifyStatus: 'verified',
  meetings: [],
};

const sections: PlanTextSection[] = [scheduled, missing, online];

describe('formatPlanText', () => {
  it('formats a Thai plan with the shelf and a missing marker', () => {
    // The subject id is turned on here to pin the full line format including the id.
    const text = formatPlanText({
      planName: 'ตาราง 1/2570',
      year: '2570',
      semester: '1',
      sections,
      exams: [],
      options: { ...DEFAULT_DISPLAY_OPTIONS, showSubjectId: true },
      locale: 'th',
      t: createTranslator('th'),
    });
    expect(text).toBe(
      [
        'ตาราง 1/2570  ภาคการศึกษา 1/2570  9 หน่วยกิต',
        '',
        "จ 09:00-11:00 90592008 สังคมไทยในวันนี้ TODAY'S THAI SOCIETY (901) A101",
        'พ 13:00-15:00 90592033 ปรัชญาเบื้องต้น Introduction to Philosophy (902) B202 (ไม่พบ)',
        '',
        'รายวิชาที่ไม่มีคาบเรียน',
        '01006029 วิชาออนไลน์ Online subject (1)',
        '',
        'ตัววางแผนตารางเรียน สจล.',
      ].join('\n'),
    );
  });

  it('honours the display options by dropping fields', () => {
    const text = formatPlanText({
      planName: 'Fall',
      year: '2570',
      semester: '1',
      sections: [scheduled],
      exams: [],
      options: {
        fitToContent: true,
        showRoom: false,
        showSection: false,
        showEnglishNames: false,
        showSubjectId: true,
        showExams: false,
      },
      locale: 'en',
      t: createTranslator('en'),
    });
    expect(text).toBe(
      [
        'Fall  Semester 1/2570  3 credits',
        '',
        "Mon 09:00-11:00 90592008 TODAY'S THAI SOCIETY",
        '',
        'Course Planner for KMITL',
      ].join('\n'),
    );
  });

  it('drops the subject id from every line when showSubjectId is off', () => {
    // The default has the id off, so the meeting lines and the shelf lines lead with the
    // name and carry no numeric id.
    const text = formatPlanText({
      planName: 'ตาราง 1/2570',
      year: '2570',
      semester: '1',
      sections,
      exams: [],
      options: DEFAULT_DISPLAY_OPTIONS,
      locale: 'th',
      t: createTranslator('th'),
    });
    expect(text).toBe(
      [
        'ตาราง 1/2570  ภาคการศึกษา 1/2570  9 หน่วยกิต',
        '',
        "จ 09:00-11:00 สังคมไทยในวันนี้ TODAY'S THAI SOCIETY (901) A101",
        'พ 13:00-15:00 ปรัชญาเบื้องต้น Introduction to Philosophy (902) B202 (ไม่พบ)',
        '',
        'รายวิชาที่ไม่มีคาบเรียน',
        'วิชาออนไลน์ Online subject (1)',
        '',
        'ตัววางแผนตารางเรียน สจล.',
      ].join('\n'),
    );
    expect(text).not.toContain('90592008');
    expect(text).not.toContain('01006029');
  });

  describe('the exam schedule block', () => {
    // The lines as the poster exam block lists them: midterms, then finals, then the
    // subjects arranged by the instructor, each already named through the display options.
    const exams: PlanTextExamLine[] = [
      {
        label: 'กลางภาค',
        when: '10 ธ.ค. 2569 09:00-12:00',
        subject: 'สังคมไทยในวันนี้ (901)',
      },
      {
        label: 'ปลายภาค',
        when: '20 ก.พ. 2570 13:30-16:30',
        subject: 'ปรัชญาเบื้องต้น (902)',
      },
      { label: 'จัดสอบเอง', when: null, subject: 'วิชาออนไลน์ (1)' },
    ];

    it('appends a labelled block after the shelf and before the app line when on', () => {
      const text = formatPlanText({
        planName: 'ตาราง 1/2570',
        year: '2570',
        semester: '1',
        sections,
        exams,
        options: {
          ...DEFAULT_DISPLAY_OPTIONS,
          showEnglishNames: false,
          showExams: true,
        },
        locale: 'th',
        t: createTranslator('th'),
      });
      expect(text).toBe(
        [
          'ตาราง 1/2570  ภาคการศึกษา 1/2570  9 หน่วยกิต',
          '',
          'จ 09:00-11:00 สังคมไทยในวันนี้ (901) A101',
          'พ 13:00-15:00 ปรัชญาเบื้องต้น (902) B202 (ไม่พบ)',
          '',
          'รายวิชาที่ไม่มีคาบเรียน',
          'วิชาออนไลน์ (1)',
          '',
          'ตารางสอบ',
          'กลางภาค 10 ธ.ค. 2569 09:00-12:00 สังคมไทยในวันนี้ (901)',
          'ปลายภาค 20 ก.พ. 2570 13:30-16:30 ปรัชญาเบื้องต้น (902)',
          'จัดสอบเอง วิชาออนไลน์ (1)',
          '',
          'ตัววางแผนตารางเรียน สจล.',
        ].join('\n'),
      );
    });

    it('leaves the exams out while the option is off', () => {
      const text = formatPlanText({
        planName: 'Fall',
        year: '2570',
        semester: '1',
        sections,
        exams,
        options: DEFAULT_DISPLAY_OPTIONS,
        locale: 'en',
        t: createTranslator('en'),
      });
      expect(text).not.toContain('Exam schedule');
      expect(text).not.toContain('10 ธ.ค. 2569');
    });

    it('has no block for a plan with no exam lines', () => {
      const text = formatPlanText({
        planName: 'Fall',
        year: '2570',
        semester: '1',
        sections: [],
        exams: [],
        options: { ...DEFAULT_DISPLAY_OPTIONS, showExams: true },
        locale: 'en',
        t: createTranslator('en'),
      });
      expect(text).not.toContain('Exam schedule');
    });
  });
});

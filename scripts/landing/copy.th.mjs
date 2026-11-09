// Thai copy for the landing page at https://kcp.cecs.sh/ (ADR-0066). Strings that hold
// markup carry only lang spans for English runs inside Thai text.

const EN = (text) => `<span lang="en">${text}</span>`;
const NAME = EN('KCP: Course Planner for KMITL');

export const th = {
  lang: 'th',
  path: '/',
  // The verb phrase students search with leads the Thai half of the title and the
  // description, after the brand.
  title: 'KCP: Course Planner for KMITL | จัดตารางเรียน สจล.',
  description:
    'จัดตารางเรียน สจล. (KMITL) ก่อนลงทะเบียนด้วย KCP ส่วนขยาย Chrome และ Firefox เปลี่ยนผลค้นหารายวิชาเป็นตารางเรียนรายสัปดาห์แบบลากวาง รวมรายการที่ซ้ำ แจ้งเวลาเรียนและเวลาสอบที่ชนกัน ใช้ฟรี',
  ogLocale: 'th_TH',
  ogLocaleAlt: 'en_US',
  ogImageAlt:
    'ตารางเรียนรายสัปดาห์ที่ส่งออกจาก KCP พร้อมชื่อ KCP: Course Planner for KMITL',
  skip: 'ข้ามไปยังเนื้อหา',
  // The quiet cue under a pinned scene that has stopped on a finished step.
  scrollOn: 'เลื่อนต่อ',
  nav: {
    label: 'เมนูหลัก',
    features: 'ความสามารถ',
    faq: 'คำถามที่พบบ่อย',
    // The narrow header has room for one short section link, so the FAQ keeps a place
    // there under a shorter name.
    faqShort: 'คำถาม',
    home: 'หน้าแรก',
  },
  other: { text: 'English', lang: 'en', href: '/en/' },
  install: 'ติดตั้ง',
  hero: {
    lockup: NAME,
    // The phrases stay whole where they fit, so a line never breaks inside ตารางเรียน.
    line1:
      '<span class="phrase">เห็นตารางเรียน</span><wbr><span class="phrase">ทั้งสัปดาห์</span>',
    line2: '<span class="phrase">ก่อนลงทะเบียนจริง</span>',
    lede: 'ส่วนขยายที่เปลี่ยนผลค้นหารายวิชาของ สจล. เป็นตารางเรียนแบบลากวาง',
    // The Chrome badge names one browser, so the line beside it names the others it serves.
    // Its last words stay together, so a narrow phone never leaves ด้วย alone on a line.
    fine: `ใช้ฟรี โอเพนซอร์ส รองรับ ${EN('Edge, Brave')} <span class="nw">และ ${EN('Opera')} ด้วย</span>`,
    alt: 'ตัววางแผน KCP บนเว็บไซต์ลงทะเบียน แสดงตารางเรียนรายสัปดาห์วันจันทร์ถึงวันศุกร์ ช่วงเช้ามีพื้นฐานการเขียนโปรแกรมคอมพิวเตอร์ ฟิสิกส์ทั่วไป 1 แคลคูลัส 1 และคณิตศาสตร์ไม่ต่อเนื่อง',
  },
  cta: {
    web: 'ใช้งานบนเว็บ',
    webBadge: 'เร็ว ๆ นี้',
    webNoteShort: 'เวอร์ชันเว็บอยู่ระหว่างพัฒนา ยังไม่มีกำหนดเปิด',
    coarse: 'ใช้บนคอมพิวเตอร์เท่านั้น',
  },
  problem: {
    h2: (c) =>
      `<span class="statement__line"><span class="phrase">ค้นหาหมวดวิชาเดียว</span><wbr><span class="phrase">ได้ ${c.rows} แถว</span></span><span class="statement__line"><span class="phrase">เป็นกลุ่มเรียนจริง</span><wbr><span class="phrase">เพียง ${c.sections} กลุ่ม</span></span>`,
    sub: 'KCP รวมแถวที่ซ้ำ ให้เหลือกลุ่มเรียนละหนึ่งรายการ',
    caption: (c) =>
      `${c.rows} แถวจาก ${c.groupings} หลักสูตร ตัวอย่างจริงจากหมวดวิชา 90592xxx ภาคการศึกษา 1/2569`,
    headers: [
      'หลักสูตรที่แสดงแถวนี้',
      'รหัสวิชา',
      'ชื่อวิชา',
      'กลุ่มเรียน',
      'วันและเวลา',
      'ที่นั่ง',
    ],
    merged: (c) => `รวมแล้วเหลือ ${c.sections} กลุ่มเรียน`,
    staticResult: () => 'แต่ละกลุ่มเรียนแสดงเพียงครั้งเดียว',
    countRows: (c) => `<span class="count__num">${c.rows}</span> แถว`,
    countJoin: 'เหลือ',
    countSections: (c) =>
      `<span class="count__num">${c.sections}</span> กลุ่มเรียน`,
  },
  story: {
    h2: 'จัดตารางแบบลากวาง',
    beats: [
      'ลากกลุ่มเรียนลงตาราง',
      'ชนกันก็เห็นก่อนวาง',
      'เสนอกลุ่มเรียนที่ลงได้ให้ทันที',
    ],
    chip: (b) => [
      `ชนกับ ${b.subjectId} กลุ่มเรียน ${b.section}`,
      `${b.dayLabel} ${b.time}`,
    ],
    readout: (s) => `${s.credits} หน่วยกิต ${s.subjects} วิชา ไม่มีรายการชนกัน`,
  },
  exam: {
    h2: '<span class="phrase">ตรวจวันสอบ</span><wbr><span class="phrase">ให้ด้วย</span>',
    sub: 'สองวิชาที่เรียนคนละวัน อาจสอบเวลาเดียวกัน KCP ไม่ให้ลงกลุ่มเรียนที่สอบชนกัน',
    alt1: 'การ์ดรายวิชา 01076112 กลุ่มเรียนมีป้ายสอบชนกัน และกล่องสีแดงอ่อนระบุว่าเวลาสอบชนกับ 01006020 กลุ่มเรียน 4 สอบกลางภาค 21 ส.ค. 2569',
  },
  export: {
    h2: '<span class="phrase">แชร์ตารางเป็นรูปภาพ</span><wbr><span class="phrase">พร้อมส่ง</span>',
    sub: 'ขนาดพอดีสำหรับแชร์ ภาพพื้นหลังโทรศัพท์ หรือพิมพ์ A4',
    alt1: 'ภาพตารางเรียนที่ส่งออกจาก KCP ขนาด 1920 x 1080 แสดงชื่อตาราง ภาคการศึกษา 1/2569 หน่วยกิตรวม และบล็อกวิชาวันจันทร์ถึงวันศุกร์',
    alt2: 'ภาพพื้นหลังโทรศัพท์แนวตั้งจากตารางเดียวกัน วันเรียงเป็นคอลัมน์ และมีตารางสอบอยู่ด้านล่าง',
  },
  plans: {
    h2: '<span class="phrase">ตารางอัปเดต</span><wbr><span class="phrase">ทุกครั้งที่เปิด</span>',
    sub: 'แสดงเวลาหรือห้องที่เปลี่ยนคู่กับค่าเดิม และไม่ลบรายการใดให้เอง',
    alt1: 'หน้าต่างข้อมูลในตารางมีการเปลี่ยนแปลง รายการแคลคูลัส 1 กลุ่มเรียน 33 แสดงเวลาเดิมและเวลาใหม่ พร้อมปุ่มรับทราบทั้งหมด',
  },
  more: {
    h2: 'และอีกหลายอย่าง',
    items: [
      ['ค้นหาได้สามแบบ', 'ตามหลักสูตร รหัสวิชา หรือหมวดวิชา'],
      ['แนะนำตาราง', 'เสนอตารางที่ไม่ชนกันจากวิชาในหลักสูตร'],
      ['เปรียบเทียบกลุ่มเรียน', 'เวลา ผู้สอน ที่นั่ง และวันสอบ เคียงกัน'],
      ['คัดลอกเป็นข้อความ', 'ส่งตารางทั้งสัปดาห์ในแชตเป็นข้อความได้ทันที'],
    ],
  },
  privacy: {
    h2: '<span class="phrase">ข้อมูลอยู่ใน</span><wbr><span class="phrase">เบราว์เซอร์ของคุณ</span>',
    sub: 'ไม่มีบัญชีผู้ใช้ ไม่มีเซิร์ฟเวอร์ ไม่เก็บสถิติ และอ่านเฉพาะข้อมูลรายวิชาสาธารณะ',
    heading: 'สิทธิ์ที่ขอ',
    perms: [
      ['storage', 'บันทึกตารางไว้บนเครื่องนี้'],
      ['regis.reg.kmitl.ac.th', 'แสดงตัววางแผนบนเว็บไซต์ลงทะเบียน'],
      ['api.reg.kmitl.ac.th', 'อ่านรายชื่อคณะ หลักสูตร และหมวดวิชา'],
    ],
    // The policy is in English only, so the link says so before a Thai reader follows it.
    link: 'อ่านนโยบายความเป็นส่วนตัว (ภาษาอังกฤษ)',
  },
  download: {
    h2: 'ติดตั้ง KCP ฟรี',
    meta: (version, source) => `เวอร์ชัน ${version} สัญญาอนุญาต MIT ${source}`,
    source: 'ดูซอร์สโค้ดบน GitHub',
  },
  faq: {
    h2: 'คำถามที่พบบ่อย',
    items: [
      [
        'KCP เป็นระบบของ สจล. หรือไม่',
        'ไม่ใช่ KCP เป็นเครื่องมืออิสระที่นักศึกษาพัฒนา และไม่ได้รับการรับรองจาก สจล.',
      ],
      [
        'KCP ลงทะเบียนเรียนให้ได้ไหม',
        'ไม่ได้ KCP ใช้วางแผนเท่านั้น การลงทะเบียนจริงยังทำบนเว็บไซต์ลงทะเบียนตามปกติ',
      ],
      [
        'ใช้บนโทรศัพท์ได้ไหม',
        `ยังไม่ได้ เพราะ ${EN('Chrome')} บนโทรศัพท์ไม่รองรับส่วนขยาย เวอร์ชันเว็บที่อยู่ระหว่างพัฒนามีแผนให้ใช้ได้โดยไม่ต้องติดตั้ง`,
      ],
      [
        'ใช้ได้กับทุกคณะไหม',
        'ได้ KCP อ่านข้อมูลเดียวกับเว็บไซต์ลงทะเบียน จึงค้นหาได้ทุกคณะและทุกหลักสูตร',
      ],
    ],
  },
  footer: {
    disclaimer: `${NAME} ไม่เกี่ยวข้องกับสถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (สจล.) และใช้ชื่อ สจล. และ ${EN('KMITL')} เพื่อระบุเว็บไซต์ที่ทำงานด้วยเท่านั้น`,
    sitePrivacy:
      'เว็บไซต์นี้ไม่ใช้คุกกี้ ไม่มีระบบวิเคราะห์การใช้งาน และไม่โหลดไฟล์จากภายนอก',
    linksLabel: 'ลิงก์',
    source: 'ซอร์สโค้ดบน GitHub',
    privacy: 'นโยบายความเป็นส่วนตัว (ภาษาอังกฤษ)',
    issues: 'แจ้งปัญหา',
    trademarks: `${EN('Chrome')} โลโก้ ${EN('Chrome')} และ ${EN('Chrome Web Store')} เป็นเครื่องหมายการค้าของ ${EN('Google LLC')} ส่วน ${EN('Firefox')} และโลโก้ ${EN('Firefox')} เป็นเครื่องหมายการค้าของ ${EN('Mozilla Foundation')} ในสหรัฐอเมริกาและประเทศอื่น`,
    license: 'สัญญาอนุญาต MIT',
  },
  frame: 'หน้าต่างเบราว์เซอร์',
  notFound: {
    title: 'ไม่พบหน้านี้',
    body: 'ไม่พบหน้าที่ต้องการ ลิงก์อาจเปลี่ยนหรือหน้านี้ถูกนำออกแล้ว',
    back: 'กลับไปหน้าแรก',
  },
};

// A replica of the host's regular registration page for the specs that prove KCP stays
// quiet there. It is plain DOM code written by hand from a written description of the
// page, not copied from the host, and it is modelled on the host build of 2026-11-23 only.
// It renders the route card titled ลงทะเบียนเรียน ระดับปริญญาตรี in one of three states:
// REGIS, the choose subjects step with the stepper and an add card whose heading has no
// (ล่วงหน้า) span; SUMMARY_REGIS, the registered list with the add, change, and withdraw
// area and the queue panel; and closed, the one heading the page shows outside the
// period. Every host control counts its clicks, and every untrusted event aimed at the
// page is counted too, so a spec can prove KCP pressed and dispatched nothing here. The
// orangeConfirm variant colours the area's confirm deep orange, as the continue button
// is, so a test can prove the local add resolver reads the label and not the colour.

const STEPS = ['เริ่มต้น', 'เลือกรายวิชา', 'เสร็จสิ้น'];
const HEAD = [
  'ลบ',
  'รหัสวิชา',
  'ชื่อวิชา',
  'หน่วยกิต',
  'กลุ่ม',
  'วันเวลาเรียนและสอบ',
  'จำนวนรับ',
  'จำนวนผู้ลง',
];
const STATES = ['REGIS', 'SUMMARY_REGIS', 'closed'];
const EVENTS = [
  'click',
  'mousedown',
  'pointerdown',
  'input',
  'change',
  'keydown',
  'keyup',
  'focusin',
  'submit',
];

export function mountRegistration(doc, options = {}) {
  const page = {
    state: STATES.includes(options.state) ? options.state : 'REGIS',
    term: options.term ?? { semester: '2', year: '2569' },
  };
  const confirmColour =
    options.variant === 'orangeConfirm' ? 'deep-orange' : 'green';
  const counters = { clicks: {}, untrusted: 0 };

  function h(tag, props, children) {
    const element = doc.createElement(tag);
    for (const [key, value] of Object.entries(props ?? {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') element.className = value;
      else if (key === 'count') element.setAttribute('data-count', value);
      else element.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of [children ?? []].flat(3)) {
      if (child === null || child === undefined || child === false) continue;
      element.append(
        typeof child === 'string' ? doc.createTextNode(child) : child,
      );
    }
    return element;
  }

  const app = h('div', {
    'data-app': 'true',
    class: 'v-application v-application--is-ltr theme--light',
    id: 'app',
  });
  const wrap = h('div', { class: 'v-application--wrap' });
  app.append(wrap);
  doc.body.append(app);

  // A click on a counted control is counted by its name, whoever made it, and any event
  // the browser did not make that is aimed at the page counts as untrusted. Events inside
  // the extension's own UI are retargeted to its host element under the body, outside the
  // app element, so they count as neither.
  for (const type of EVENTS) {
    doc.addEventListener(
      type,
      (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !app.contains(target)) return;
        if (!event.isTrusted) counters.untrusted += 1;
        if (type !== 'click') return;
        const name = target.closest('[data-count]')?.getAttribute('data-count');
        if (name) counters.clicks[name] = (counters.clicks[name] ?? 0) + 1;
      },
      true,
    );
  }

  const button = (classes, label, count) =>
    h(
      'button',
      {
        type: 'button',
        class: `v-btn v-btn--has-bg theme--light v-size--default ${classes}`,
        count,
      },
      [h('span', { class: 'v-btn__content' }, ` ${label} `)],
    );

  function table(head, rows) {
    return h(
      'div',
      { class: 'v-data-table mt-2 v-data-table--dense theme--light' },
      [
        h('div', { class: 'v-data-table__wrapper' }, [
          h('table', {}, [
            h('thead', {}, [
              h(
                'tr',
                {},
                head.map((text) =>
                  h('th', { class: 'text-center' }, ` ${text} `),
                ),
              ),
            ]),
            h('tbody', {}, rows),
          ]),
        ]),
      ],
    );
  }

  const cells = (values) => values.map((value) => h('td', {}, value));

  function select(which) {
    const uid = which === 'practice' ? 202 : 201;
    return h(
      'div',
      {
        class:
          'v-input ma-1 v-input--hide-details v-input--dense theme--light v-text-field v-text-field--enclosed v-text-field--outlined v-select',
      },
      [
        h('div', { class: 'v-input__control' }, [
          h(
            'div',
            {
              role: 'button',
              'aria-haspopup': 'listbox',
              'aria-expanded': 'false',
              'aria-owns': `list-${uid}`,
              class: 'v-input__slot',
              count: which === 'practice' ? 'practiceSelect' : 'sectionSelect',
            },
            [
              h('div', { class: 'v-select__slot' }, [
                h('input', {
                  id: `input-${uid}`,
                  readonly: true,
                  type: 'text',
                }),
              ]),
            ],
          ),
        ]),
      ],
    );
  }

  function stepper(step) {
    return h(
      'div',
      {
        class:
          'v-stepper v-stepper--alt-labels v-sheet theme--light elevation-0',
      },
      [
        h(
          'div',
          { class: 'v-stepper__header' },
          STEPS.map((text, index) =>
            h(
              'div',
              {
                class: `v-stepper__step ${index + 1 === step ? 'v-stepper__step--active' : 'v-stepper__step--inactive'}`,
              },
              [
                h(
                  'span',
                  { class: 'v-stepper__step__step deep-orange' },
                  String(index + 1),
                ),
                h('div', { class: 'v-stepper__label' }, ` ${text} `),
              ],
            ),
          ),
        ),
      ],
    );
  }

  function infoRow() {
    return h('div', { class: 'row text-center grey lighten-2 mb-4 mx-auto' }, [
      h('div', { class: 'col-md-4 col-12' }, ' รหัสนักศึกษา : 00000000 '),
      h('div', { class: 'col-md-4 col-12' }, ' ชื่อ-นามสกุล: นักศึกษา ทดสอบ '),
      h(
        'div',
        { class: 'col-md-4 col-12' },
        ` ภาคการศึกษาที่ : ${page.term.semester} / ${page.term.year} `,
      ),
    ]);
  }

  const card = (children) =>
    h(
      'div',
      { class: 'v-card v-card--flat v-sheet theme--light elevation-0' },
      [
        h('div', { class: 'v-card__text pa-0' }, [
          h('div', { class: 'text-center' }, children),
        ]),
      ],
    );

  // The choose subjects step: the add card, its heading with no (ล่วงหน้า) span, the 8
  // column list with the add row and the practice row, then the local add button and the
  // continue button, in the order the pre registration add card has them.
  function addCard() {
    const field = h('input', {
      id: 'input-60',
      type: 'text',
      count: 'subjectField',
    });
    return card([
      h('h2', {}, ' รายการวิชาที่ต้องการลงทะเบียน '),
      table(HEAD, [
        h('tr', {}, [
          h(
            'td',
            { class: 'last-cell text-center', colspan: '8' },
            ' ไม่มีรายการ ',
          ),
        ]),
        h('tr', { class: 'table-space-tr' }, [
          h('td', { class: 'table-space-td', colspan: '8' }, ' กรอกรหัสวิชา '),
        ]),
        h('tr', {}, [
          h('td'),
          h('td', {}, [
            h('div', { class: 'v-input v-text-field v-text-field--outlined' }, [
              h('div', { class: 'v-input__control' }, [
                h('div', { class: 'v-input__slot' }, [
                  h('div', { class: 'v-text-field__slot' }, [field]),
                ]),
              ]),
            ]),
          ]),
          h('td'),
          h('td'),
          h('td', {}, [h('div', {}, [select('primary')])]),
          h('td'),
          h('td'),
          h('td', { class: 'last-cell' }),
        ]),
        h('tr', {}, [
          h('td'),
          h('td', {}, '(ปฏิบัติ)'),
          h('td'),
          h('td'),
          h('td', {}, [h('div', {}, [select('practice')])]),
          h('td'),
          h('td'),
          h('td', { class: 'last-cell' }),
        ]),
      ]),
      h('div', { class: 'mt-2' }, [
        button('green white--text elevation-0', 'เพิ่ม', 'add'),
      ]),
      button('mt-5 deep-orange white--text', 'ดำเนินการต่อ', 'continue'),
    ]);
  }

  // The registered list, then the add, change, and withdraw area and the queue panel. Each
  // area has its own table followed by a block of buttons and one button after it, the
  // shape the local add button and the continue button have on the choose subjects step,
  // so a test can prove no resolver takes one of them for the local add.
  function summary() {
    const registered = [
      ['90000001', '1'],
      ['90000003', '2'],
    ].map(([id, section]) =>
      h(
        'tr',
        {},
        cells([
          '',
          id,
          'SUBJECT',
          '3(3-0-6)',
          section,
          ' จันทร์ 09:00 - 12:00 ',
          '40',
          '12',
        ]),
      ),
    );
    return card([
      h('h2', {}, ' รายการวิชาที่ลงทะเบียน '),
      table(HEAD, registered),
      h('div', { class: 'add-change-delete mt-4' }, [
        h('h3', {}, ' เพิ่ม / เปลี่ยน / ถอน '),
        table(HEAD.slice(1), [
          h('tr', {}, cells(['', '', '', '', '', '', ''])),
        ]),
        h('div', { class: 'mt-2' }, [
          button('green white--text elevation-0', 'เพิ่ม', 'acdAdd'),
          button('orange white--text elevation-0', 'เปลี่ยน', 'acdChange'),
          button('red white--text elevation-0', 'ถอน', 'acdWithdraw'),
        ]),
        button(`mt-5 ${confirmColour} white--text`, 'ยืนยัน', 'acdConfirm'),
      ]),
      h('div', { class: 'queue-panel mt-4' }, [
        h('h3', {}, ' รายการแถวคอย '),
        table(
          ['รหัสวิชา', 'กลุ่ม', 'ลำดับคิว'],
          [h('tr', {}, cells(['90000005', '1', '3']))],
        ),
        h('div', { class: 'mt-2' }, [
          button('red white--text elevation-0', 'ยกเลิกคิว', 'queueCancel'),
        ]),
        button('mt-5 deep-orange white--text', 'ยืนยัน', 'queueConfirm'),
      ]),
    ]);
  }

  function routeCard() {
    return h('div', { class: 'v-card v-sheet theme--light' }, [
      h('div', { class: 'registration-header' }, [
        h('div', { class: 'v-card__title' }, [
          h(
            'h1',
            { class: 'pt-4 deep-orange--text' },
            'ลงทะเบียนเรียน ระดับปริญญาตรี',
          ),
        ]),
        h('div', { class: 'v-card__subtitle' }, [
          h(
            'h2',
            { class: 'pt-2' },
            `${page.term.semester} / ${page.term.year}`,
          ),
        ]),
      ]),
      h(
        'div',
        { class: 'v-card__text px-0' },
        page.state === 'REGIS'
          ? [stepper(2), infoRow(), h('div', { class: 'px-1' }, [addCard()])]
          : [infoRow(), h('div', { class: 'px-1' }, [summary()])],
      ),
    ]);
  }

  function render() {
    wrap.replaceChildren(
      h('main', { class: 'v-main' }, [
        h('div', { class: 'v-main__wrap' }, [
          page.state === 'closed'
            ? h('h1', { class: 'mt-4' }, ' ไม่อยู่ในช่วงเวลาลงทะเบียนปกติ ')
            : routeCard(),
        ]),
      ]),
    );
  }

  render();
  return {
    page,
    counters,
    /** Show another state of the page, as the host's own state change would. */
    set(state) {
      if (STATES.includes(state)) page.state = state;
      render();
    },
    /** The total of every counted click and every untrusted event on the page. */
    interactions() {
      return (
        Object.values(counters.clicks).reduce((sum, count) => sum + count, 0) +
        counters.untrusted
      );
    },
  };
}

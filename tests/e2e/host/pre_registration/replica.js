// A replica of the host's pre registration panel for the observer and fill tests. It is
// plain DOM code, written from KCP's own reading of the host's render functions for the
// tested build, not copied from the host. It reproduces the Vuetify 2.7.2 markup KCP
// anchors on: the stepper, the header term column, the add card in its states (empty,
// searching, offered with a selected section, a locked or a free practice, the status
// colours, the seats), the list table, the credit box, the result card, the detached
// dialogs and select menus, and the toast container. The student's id and name are
// placeholders. Configured with a catalog it also behaves as the host does for a
// student's hands: an 8 digit input searches, the select opens its menu, an option
// chooses the section and colours the row, เพิ่ม adds to the list, รับทราบ closes the
// grade dialog, and ดำเนินการต่อ opens the confirm dialog, whose ยืนยัน counts as a write.
// Every host control counts its clicks, and every untrusted event on the page is counted
// by the control it was aimed at, so a spec can prove what KCP pressed and what it never
// touched. Hostile variants change the markup or the behaviour to test the fill guards.

const STEPS = ['เริ่มต้น', 'เลือกรายวิชา', 'เสร็จสิ้น'];
const COLOURS = { pending: '#fff1d9', fits: '#dbffb8', clash: '#ffcfcc' };
const PREFIX = 'มีข้อผิดพลาดสำหรับการลงวิชา: ';
const TOAST_TEXT = {
  alreadyListed: 'มีวิชานี้อยู่ในรายการที่จะลงอยู่แล้ว',
  clash: 'มีวันเวลาเรียนชนกับวิชาที่เลือกไว้แล้ว',
  refused: 'ไม่สามารถลงทะเบียนรายวิชานี้ได้',
};

/** The default page: the choose subjects step with an empty list. */
export function initialState() {
  return {
    step: 2,
    term: { semester: '1', year: '2569' },
    list: [],
    add: {
      value: '',
      loading: false,
      sections: null,
      selected: null,
      practice: null,
      colour: 'pending',
      seats: null,
    },
    menu: null,
    credits: { min: 9, max: 22 },
    dialog: null,
    toasts: [],
    results: null,
    resultsLoading: false,
  };
}

export function mountReplica(doc, overrides = {}) {
  const counters = {
    clicks: {},
    untrusted: 0,
    untrustedOn: {},
    writes: 0,
    reads: 0,
  };
  const config = { catalog: {}, delay: 200, variant: null, xhr: false };
  let current = null;
  const state = { ...initialState(), ...overrides };
  state.add = { ...initialState().add, ...overrides.add };

  // An event aimed at the host page, as opposed to one inside the extension's own UI,
  // which the browser retargets to the extension's host element under the body.
  function hostOwned(target) {
    let node = target;
    while (node?.parentNode && node.parentNode !== doc.body)
      node = node.parentNode;
    return (
      node?.parentNode !== doc.body ||
      node === app ||
      node.classList.contains('toasted-container')
    );
  }

  for (const type of [
    'click',
    'mousedown',
    'pointerdown',
    'input',
    'change',
    'keydown',
    'keyup',
    'focusin',
    'submit',
  ]) {
    doc.addEventListener(
      type,
      (event) => {
        if (event.isTrusted || !hostOwned(event.target)) return;
        counters.untrusted += 1;
        const name =
          event.target?.closest?.('[data-count]')?.getAttribute('data-count') ??
          'page';
        counters.untrustedOn[name] = (counters.untrustedOn[name] ?? 0) + 1;
      },
      true,
    );
  }

  function h(tag, props, children) {
    const element = doc.createElement(tag);
    for (const [key, value] of Object.entries(props ?? {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') element.className = value;
      else if (key === 'style') element.setAttribute('style', value);
      else if (key === 'count') {
        element.setAttribute('data-count', value);
        element.addEventListener('click', () => {
          counters.clicks[value] = (counters.clicks[value] ?? 0) + 1;
        });
      } else element.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of [children ?? []].flat(3)) {
      if (child === null || child === undefined || child === false) continue;
      element.append(
        typeof child === 'string' ? doc.createTextNode(child) : child,
      );
    }
    return element;
  }

  const button = (classes, label, count, disabled) =>
    h(
      'button',
      {
        type: 'button',
        class: `v-btn v-btn--has-bg theme--light v-size--default ${classes}${disabled ? ' v-btn--disabled' : ''}`,
        count,
        disabled,
      },
      [h('span', { class: 'v-btn__content' }, ` ${label} `)],
    );
  const trash = (count) =>
    h(
      'button',
      {
        type: 'button',
        class: 'v-btn v-btn--icon v-btn--round theme--light v-size--default',
        count,
      },
      [
        h('span', { class: 'v-btn__content' }, [
          h('i', {
            'aria-hidden': 'true',
            class:
              'v-icon notranslate mdi mdi-trash-can-outline theme--light red--text',
          }),
        ]),
      ],
    );
  const chip = (kind) =>
    kind === 'ป'
      ? h(
          'span',
          {
            class:
              'v-chip v-chip--no-color theme--light v-size--x-small brown darken-4 white--text ml-2',
          },
          [h('span', { class: 'v-chip__content' }, ' ปฏิบัติ ')],
        )
      : h(
          'span',
          {
            class:
              'v-chip v-chip--no-color theme--light v-size--x-small light-blue accent-4 white--text ml-2',
          },
          [h('span', { class: 'v-chip__content' }, ' ทฤษฎี ')],
        );
  const hours = (row) =>
    h('span', {}, [` ${row.credit ?? 3}(3-0-6) `, chip(row.kind)]);
  const label = (row) =>
    ` ${row.section} ${row.curriculum ? ` (${row.curriculum})` : ''} `;
  const time = () =>
    h('div', {}, [
      h('div', {}, [
        h('div', {}, [
          h('span', { class: 'teach-time' }, ' จันทร์ 09:00 - 12:00 '),
        ]),
      ]),
      h('div', {}, [
        h(
          'span',
          { class: 'indigo--text font-weight-bold' },
          'อาจารย์ผู้สอนกำหนด',
        ),
      ]),
    ]);
  const select = (selected, which) => {
    const uid = which === 'practice' ? 102 : 101;
    return h(
      'div',
      {
        class:
          'v-input ma-1 v-input--hide-details v-input--dense theme--light v-text-field v-text-field--enclosed v-text-field--outlined v-select',
        'data-select': which,
      },
      [
        h('div', { class: 'v-input__control' }, [
          h(
            'div',
            {
              role: 'button',
              'aria-haspopup': 'listbox',
              'aria-expanded': String(state.menu === which),
              'aria-owns': `list-${uid}`,
              class: 'v-input__slot',
              count: 'sectionSelect',
            },
            [
              h('fieldset', { 'aria-hidden': 'true' }, [
                h('legend', {}, [h('span', { class: 'notranslate' }, '​')]),
              ]),
              h('div', { class: 'v-select__slot' }, [
                h('div', { class: 'v-select__selections' }, [
                  selected
                    ? h(
                        'div',
                        {
                          class:
                            'v-select__selection v-select__selection--comma',
                        },
                        selected,
                      )
                    : null,
                  h('input', {
                    id: `input-${uid}`,
                    readonly: 'readonly',
                    type: 'text',
                    'aria-readonly': 'false',
                    autocomplete: 'off',
                  }),
                ]),
              ]),
            ],
          ),
        ]),
      ],
    );
  };

  function listRow(row) {
    return h('tr', {}, [
      h('td', {}, [trash('trash')]),
      h('td', {}, row.subjectId),
      h('td', {}, [
        h(
          'a',
          { class: 'subject-link', count: 'subjectLink' },
          ` ${row.name ?? 'SUBJECT'} `,
        ),
      ]),
      h('td', {}, [hours(row)]),
      h('td', {}, label(row)),
      h('td', { class: 'full-width' }, [time()]),
      h('td', {}, '-'),
      h('td', { class: 'last-cell' }, '0'),
    ]);
  }

  function addRows() {
    const add = state.add;
    const hasPrimary = add.sections !== null && add.sections.length > 0;
    const first = hasPrimary ? add.sections[0] : null;
    const input = h('input', {
      id: 'input-50',
      type: 'text',
      disabled: add.sections !== null,
      count: 'subjectField',
    });
    input.value = add.value;
    const rows = [
      h('tr', { style: `background-color: ${COLOURS[add.colour]}` }, [
        h('td', {}, add.value.length === 8 ? [trash('clearField')] : []),
        h('td', {}, [
          h(
            'div',
            {
              class: `v-input ma-1 v-input--hide-details v-input--dense theme--light v-text-field v-text-field--is-booted v-text-field--enclosed v-text-field--outlined${add.sections !== null ? ' v-input--is-disabled' : ''}`,
            },
            [
              h('div', { class: 'v-input__control' }, [
                h('div', { class: 'v-input__slot' }, [
                  h('div', { class: 'v-text-field__slot' }, [input]),
                ]),
              ]),
            ],
          ),
        ]),
        h(
          'td',
          {},
          hasPrimary
            ? [
                h('div', {}, [
                  h(
                    'a',
                    { class: 'subject-link', count: 'subjectLink' },
                    ' SUBJECT ',
                  ),
                ]),
              ]
            : [],
        ),
        h('td', {}, hasPrimary ? [h('div', {}, [hours(first)])] : []),
        h(
          'td',
          {},
          hasPrimary ? [h('div', {}, [select(add.selected, 'primary')])] : [],
        ),
        h(
          'td',
          {},
          add.selected ? [h('div', { class: 'full-width' }, [time()])] : [],
        ),
        h(
          'td',
          {},
          add.selected
            ? [h('div', {}, ` ${add.seats?.limit ? add.seats.limit : '-'} `)]
            : [],
        ),
        h(
          'td',
          { class: 'last-cell' },
          add.selected ? [h('div', {}, ` ${add.seats?.count ?? 0} `)] : [],
        ),
      ]),
    ];
    if (add.practice !== null) {
      const practice = add.practice;
      rows.push(
        h('tr', { style: `background-color: ${COLOURS[add.colour]}` }, [
          h('td'),
          h('td', {}, '(ปฏิบัติ)'),
          h('td'),
          h('td'),
          h(
            'td',
            {},
            practice.locked
              ? practice.section
                ? [h('div', {}, ` ${practice.section} `)]
                : []
              : [h('div', {}, [select(practice.section, 'practice')])],
          ),
          h('td'),
          h('td'),
          h('td', { class: 'last-cell' }),
        ]),
      );
    }
    return rows;
  }

  const total = () =>
    state.list.reduce(
      (sum, row) =>
        sum +
        (row.kind === 'ป' &&
        state.list.some(
          (other) => other.subjectId === row.subjectId && other.kind === 'ท',
        )
          ? 0
          : (row.credit ?? 3)),
      0,
    );

  function head(cells) {
    return h('thead', {}, [
      h(
        'tr',
        {},
        cells.map(([classes, text]) =>
          h('th', { class: `text-center ${classes}`.trim() }, ` ${text} `),
        ),
      ),
    ]);
  }

  function addCard() {
    return h(
      'div',
      {
        class: `v-card v-card--flat v-sheet theme--light elevation-0${state.add.loading ? ' v-card--disabled v-card--loading' : ''}`,
      },
      [
        state.add.loading
          ? h('div', { class: 'v-card__progress' }, [
              h('div', {
                role: 'progressbar',
                class:
                  'v-progress-linear v-progress-linear--absolute theme--light',
              }),
            ])
          : null,
        h('div', { class: 'v-card__text pa-0' }, [
          h('div', { class: 'text-center' }, [
            h('h2', {}, [
              ' รายการวิชาที่ต้องการลงทะเบียน ',
              h('span', { class: 'deep-orange--text' }, '(ล่วงหน้า)'),
            ]),
            h(
              'div',
              { class: 'v-data-table mt-2 v-data-table--dense theme--light' },
              [
                h('div', { class: 'v-data-table__wrapper' }, [
                  h('table', {}, [
                    head([
                      ['delete', 'ลบ'],
                      ['subject-id', 'รหัสวิชา'],
                      ['subject-name', 'ชื่อวิชา'],
                      ['', 'หน่วยกิต'],
                      ['section', 'กลุ่ม'],
                      ['', 'วันเวลาเรียนและสอบ'],
                      ['', 'จำนวนรับ'],
                      ['last-cell', 'จำนวนผู้ลง'],
                    ]),
                    h('tbody', {}, [
                      state.list.length === 0
                        ? h('tr', {}, [
                            h(
                              'td',
                              { class: 'last-cell text-center', colspan: '8' },
                              ' ไม่มีรายการ ',
                            ),
                          ])
                        : null,
                      state.list.map(listRow),
                      h('tr', { class: 'table-space-tr', height: '50px' }, [
                        h(
                          'td',
                          { class: 'table-space-td', colspan: '8' },
                          ' กรอกรหัสวิชา ',
                        ),
                      ]),
                      addRows(),
                    ]),
                  ]),
                ]),
              ],
            ),
            ...actionButtons(),
            h('div', { class: 'text-center mt-2' }, [
              h('h3', {}, [
                ` หน่วยกิตที่ลงได้ : ${state.credits.min ?? ''} - ${state.credits.max ?? ''} `,
              ]),
              h(
                'h3',
                { class: 'green--text mt-2' },
                ` หน่วยกิตรวมวิชาที่เลือกทั้งหมด : ${total()} `,
              ),
            ]),
            h('hr', {
              role: 'separator',
              class: 'v-divider theme--light mt-2',
            }),
            h('div', {}, [
              h(
                'div',
                { class: 'v-data-table mt-2 v-data-table--dense theme--light' },
                [
                  h('div', { class: 'v-data-table__wrapper' }, [
                    h('table', {}, [
                      h('thead', { class: 'pattern' }, [
                        h('tr', {}, [
                          h('th', { class: 'text-center' }, 'รหัสวิชา'),
                          h('th', { class: 'text-center last-cell' }, 'ชื่อวิชา'),
                        ]),
                      ]),
                      h('tbody', {}, [
                        h('tr', {}, [
                          h('td', { class: 'text-center' }, [
                            button('', '', 'pattern'),
                            ' 01006010 ',
                          ]),
                          h('td', { class: 'last-cell text-center' }, [
                            h(
                              'a',
                              { class: 'subject-link', count: 'subjectLink' },
                              ' SUBJECT ',
                            ),
                          ]),
                        ]),
                      ]),
                    ]),
                  ]),
                ],
              ),
            ]),
          ]),
        ]),
      ],
    );
  }

  // The local add button and the continue button, in the host's order unless a hostile
  // variant relabels or swaps them.
  function actionButtons() {
    const add =
      config.variant === 'continueAsAdd'
        ? button('green white--text elevation-0', 'ดำเนินการต่อ', 'continue')
        : button(
            'green white--text elevation-0',
            'เพิ่ม',
            'add',
            state.add.colour !== 'fits',
          );
    // A default type button that names a form elsewhere submits that form when clicked.
    if (config.variant === 'formAdd') {
      add.removeAttribute('type');
      add.setAttribute('form', 'regis-form');
    }
    const block = h('div', { class: 'mt-2' }, [add]);
    const next = button(
      'mt-5 deep-orange white--text',
      'ดำเนินการต่อ',
      'continue',
    );
    next.id = 'host-continue';
    return config.variant === 'swapped' ? [next, block] : [block, next];
  }

  function resultCard() {
    const loading = state.resultsLoading;
    return h(
      'div',
      {
        class: `v-card v-card--flat v-sheet theme--light elevation-0${loading ? ' v-card--disabled v-card--loading' : ''}`,
      },
      [
        h('div', { class: 'v-card__text pa-0' }, [
          h('div', { class: 'text-center' }, [
            h('h2', {}, [
              ' รายการวิชาที่ลงทะเบียน ',
              h('span', { class: 'deep-orange--text' }, ' (ล่วงหน้า) '),
            ]),
            h(
              'div',
              { class: 'v-data-table mt-2 v-data-table--dense theme--light' },
              [
                h('div', { class: 'v-data-table__wrapper' }, [
                  h('table', {}, [
                    head([
                      ['', 'รหัสวิชา'],
                      ['', 'ชื่อวิชา'],
                      ['', 'หน่วยกิต'],
                      ['', 'กลุ่ม'],
                      ['', 'วันเวลาเรียนและสอบ'],
                      ['', 'จำนวนรับ'],
                      ['last-cell', 'จำนวนผู้ลง'],
                      ['last-cell', 'ผลการลง'],
                    ]),
                    h(
                      'tbody',
                      {},
                      (state.results ?? []).map((row, index, all) => {
                        const pairPractice =
                          row.kind === 'ป' &&
                          all.some(
                            (other) =>
                              other.subjectId === row.subjectId &&
                              other.kind === 'ท',
                          );
                        const outcome =
                          row.grade === 'Y'
                            ? h('span', { class: 'green--text' }, ' ได้รับสิทธิ์ ')
                            : row.grade === 'N'
                              ? h(
                                  'span',
                                  { class: 'red--text' },
                                  row.condition
                                    ? ' ไม่ได้รับสิทธิ์เนื่องจากผิดเงื่อนไข '
                                    : ' ไม่ได้รับสิทธิ์ (อยู่ในแถวคอย) ',
                                )
                              : h('span', {}, 'รอผล');
                        return h('tr', {}, [
                          h(
                            'td',
                            {},
                            pairPractice ? [] : [h('span', {}, row.subjectId)],
                          ),
                          h(
                            'td',
                            {},
                            pairPractice
                              ? []
                              : [
                                  h(
                                    'a',
                                    {
                                      class: 'subject-link',
                                      count: 'subjectLink',
                                    },
                                    ' SUBJECT ',
                                  ),
                                ],
                          ),
                          h(
                            'td',
                            {},
                            pairPractice ? [] : [h('span', {}, [' 3(3-0-6) '])],
                          ),
                          h('td', { class: 'full-width text-right' }, [
                            ` ${row.section} `,
                            chip(row.kind),
                            ` ${row.curriculum ? ` (${row.curriculum})` : ''} `,
                          ]),
                          h('td', { class: 'full-width' }, [time()]),
                          h('td', {}, '-'),
                          h('td', {}, '0'),
                          h('td', { class: 'last-cell full-width' }, [outcome]),
                        ]);
                      }),
                    ),
                  ]),
                ]),
              ],
            ),
          ]),
        ]),
      ],
    );
  }

  function stepper() {
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
          STEPS.flatMap((text, index) => {
            const number = index + 1;
            const done = number < state.step;
            const step = h(
              'div',
              {
                class: `v-stepper__step ${number === state.step ? 'v-stepper__step--active' : 'v-stepper__step--inactive'}${done ? ' v-stepper__step--complete' : ''}`,
              },
              [
                h(
                  'span',
                  {
                    class: `v-stepper__step__step ${done ? 'green' : 'deep-orange'}`,
                  },
                  String(number),
                ),
                h('div', { class: 'v-stepper__label' }, ` ${text} `),
              ],
            );
            return index === 0
              ? [step]
              : [
                  h('hr', {
                    role: 'separator',
                    class: 'v-divider theme--light',
                  }),
                  step,
                ];
          }),
        ),
      ],
    );
  }

  function dialog(active, titleText, body, actions) {
    return h(
      'div',
      {
        role: 'document',
        class: `v-dialog__content${active ? ' v-dialog__content--active' : ''}`,
        style: active ? 'z-index: 202;' : 'z-index: 202; display: none;',
      },
      [
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            class: `v-dialog${active ? ' v-dialog--active' : ''} v-dialog--persistent`,
            style: 'width: 500px;',
          },
          [
            h('div', { class: 'v-card v-sheet theme--light' }, [
              h('div', { class: 'v-card__title' }, ` ${titleText} `),
              h('div', { class: 'v-card__text' }, body),
              h('div', { class: 'v-card__actions' }, actions),
            ]),
          ],
        ),
      ],
    );
  }

  function dialogs() {
    const open = state.dialog;
    const grade = open?.kind === 'grade';
    return [
      dialog(
        grade,
        'มีวิชาที่เกรดยังไม่ออก',
        [
          h('div', { style: 'font-size: 16px; line-height: 1.5em;' }, [
            ` รหัสวิชา ${open?.subjectId ?? ''} มีข้อกำหนดวิชาที่ต้องผ่านก่อน ซึ่งรายวิชาเหล่านี้ยังไม่มีผลการเรียน `,
            (grade ? open.prerequisites : []).map((id) =>
              h('span', { class: 'mr-3' }, ` ${id} `),
            ),
            h('br'),
            h('br'),
            ` หากเกรดที่ออกมาไม่เข้าเงื่อนไข ระบบจะยกเลิก ${open?.subjectId ?? ''} `,
          ]),
        ],
        config.variant === 'confirmAsGrade'
          ? [
              button('warning', 'กลับไปดูข้อมูล', 'back'),
              button('theme--dark deep-orange', 'ยืนยัน', 'confirm'),
            ]
          : config.variant === 'gradeConfirmButton'
            ? [button('primary', 'ยืนยัน', 'confirm')]
            : [button('primary', 'รับทราบ', 'acknowledge')],
      ),
      dialog(
        open?.kind === 'confirm',
        'การลงทะเบียนล่วงหน้าสามารถลงได้ครั้งเดียว',
        [
          h(
            'div',
            { style: 'font-size: 18px; line-height: 1.5em;' },
            ' ลงทะเบียนล่วงหน้าได้ครั้งเดียว ไม่สามารถแก้ไขภายหลังได้ ',
          ),
        ],
        [
          button('warning', 'กลับไปดูข้อมูล', 'back'),
          button('theme--dark deep-orange', 'ยืนยัน', 'confirm'),
        ],
      ),
      open?.kind === 'timeSlot'
        ? dialog(
            true,
            `รหัสวิชา: ${open.subjectId}`,
            [h('h2', {}, ' กลุ่ม : 1 ')],
            [button('blue darken-1 v-btn--text', 'ปิด', 'close')],
          )
        : null,
    ];
  }

  const app = h('div', {
    'data-app': 'true',
    class: 'v-application v-application--is-ltr theme--light',
    id: 'app',
  });
  const wrap = h('div', { class: 'v-application--wrap' });
  app.append(wrap);
  doc.body.append(app);

  function render() {
    wrap.replaceChildren(
      h('main', { class: 'v-main' }, [
        h('div', { class: 'v-main__wrap' }, [
          state.step === 0
            ? null
            : h('div', {}, [
                state.step >= 1 ? stepper() : null,
                h(
                  'div',
                  {
                    class: 'row text-center grey lighten-2 mb-4 mx-auto',
                    style: 'color: rgb(85, 85, 85);',
                  },
                  [
                    h(
                      'div',
                      { class: 'col-md-4 col-12' },
                      ' รหัสนักศึกษา : 00000000 ',
                    ),
                    h(
                      'div',
                      { class: 'col-md-4 col-12' },
                      ' ชื่อ-นามสกุล: นักศึกษา ทดสอบ ',
                    ),
                    h(
                      'div',
                      { class: 'col-md-4 col-12' },
                      ` ภาคการศึกษาที่ : ${state.term.semester} / ${state.term.year} `,
                    ),
                  ],
                ),
                h('div', { class: 'px-1 px-md-3 px-xl-6' }, [
                  state.step === 2 ? h('div', {}, [addCard()]) : null,
                  state.step === 3 ? h('div', {}, [resultCard()]) : null,
                ]),
              ]),
        ]),
      ]),
      config.variant === 'formAdd' ? farForm() : '',
    );
    for (const old of app.querySelectorAll(
      ':scope > .v-dialog__content, :scope > .v-menu__content',
    ))
      old.remove();
    app.append(...dialogs().filter(Boolean));
    if (state.menu) app.append(menu(state.menu));
    let container = doc.querySelector('.toasted-container');
    if (state.toasts.length > 0 && container === null) {
      container = h('div', { class: 'toasted-container top-right' });
      doc.body.append(container);
    }
    container?.replaceChildren(
      ...state.toasts.map((toast) =>
        h(
          'div',
          {
            class: `toasted toasted-primary ${toast.kind === 'submitted' ? 'success' : 'error'}`,
            style: 'opacity: 1;',
          },
          toast.text,
        ),
      ),
    );
  }

  // An option as the host renders it, or wrapped in a label that names Continue, whose
  // activation would turn a click on the option into a click on Continue.
  function optionWrapper(tag, props, children) {
    const option = h(tag, props, children);
    return config.variant === 'labelledOption'
      ? h('label', { for: 'host-continue' }, [option])
      : option;
  }

  // A form elsewhere on the page, whose submit counts as a write.
  function farForm() {
    const form = h('form', { id: 'regis-form' });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      counters.writes += 1;
    });
    return form;
  }

  // The detached menu of a select, under the app root, with the first 20 options the
  // way Vuetify renders them until the list is scrolled.
  function menu(which) {
    const uid = which === 'practice' ? 102 : 101;
    const items = menuItems(which).slice(0, 20);
    return h(
      'div',
      {
        class: 'v-menu__content theme--light menuable__content__active',
        style: 'max-height: 304px; z-index: 8;',
      },
      [
        h(
          'div',
          {
            role: 'listbox',
            tabindex: '-1',
            id: `list-${uid}`,
            class: 'v-list v-select-list v-sheet theme--light v-list--dense',
          },
          items.map((item, index) =>
            optionWrapper(
              'div',
              {
                role: 'option',
                'aria-selected': 'false',
                id: `list-item-${uid}-${index}`,
                tabindex: '0',
                class: 'v-list-item v-list-item--link theme--light',
                count: 'option',
                'data-index': index,
              },
              [
                h('div', { class: 'v-list-item__content' }, [
                  h('div', { class: 'v-list-item__title' }, label(item)),
                ]),
              ],
            ),
          ),
        ),
      ],
    );
  }

  const ofKind = (kind) =>
    current?.sections.filter((row) => row.kind === kind) ?? [];
  const paired = () => ofKind('ท').length > 0 && ofKind('ป').length > 0;
  // Without a searched subject the primary menu lists the patched sections.
  const menuItems = (which) =>
    current === null
      ? which === 'primary'
        ? (state.add.sections ?? [])
        : []
      : which === 'practice' || ofKind('ท').length === 0
        ? ofKind('ป')
        : ofKind('ท');
  const codeOf = (text) => text.trim().split(' ')[0];

  function resetAdd() {
    current = null;
    state.add = { ...initialState().add };
    state.menu = null;
  }

  function addToast(kind, id) {
    state.toasts = [
      ...state.toasts,
      { kind, text: `${PREFIX}${id}: ${TOAST_TEXT[kind]}` },
    ];
  }

  function search(id) {
    if (state.list.some((row) => row.subjectId === id)) {
      addToast('alreadyListed', id);
      render();
      return;
    }
    const subject = config.catalog[id];
    counters.reads += 1;
    if (config.xhr) {
      const request = new XMLHttpRequest();
      request.open('GET', '/replica/eligibility');
      request.send();
    }
    state.add.loading = true;
    render();
    if (subject?.hang) return;
    setTimeout(() => {
      state.add.loading = false;
      if (subject === undefined || subject.refused) {
        addToast('refused', id);
        render();
        return;
      }
      current = { id, ...subject };
      state.add.sections = menuItems('primary');
      state.add.practice = paired() ? { locked: false, section: null } : null;
      if (subject.prerequisites) {
        state.dialog = {
          kind: 'grade',
          subjectId: id,
          prerequisites: subject.prerequisites,
        };
      }
      render();
      if (config.variant === 'focusContinue') {
        doc.querySelector('[data-count="continue"]')?.focus();
      }
    }, config.delay);
  }

  function choose(which, index) {
    const item = menuItems(which)[index];
    state.menu = null;
    if (item !== undefined && which === 'practice') {
      state.add.practice = { locked: false, section: label(item).trim() };
    } else if (item !== undefined) {
      state.add.selected = label(item).trim();
      state.add.seats = { limit: item.limit ?? 0, count: item.count ?? 0 };
      if (paired()) {
        const pair = ofKind('ป').find((row) => row.section === item.pair);
        state.add.practice = item.pair
          ? { locked: true, section: pair?.section ?? null }
          : { locked: false, section: null };
      }
    }
    const done = state.add.selected && state.add.practice?.section !== null;
    state.add.colour = !done ? 'pending' : current?.clash ? 'clash' : 'fits';
    render();
  }

  function addToList() {
    if (state.add.colour !== 'fits' || current === null) return;
    const codes = [state.add.selected, state.add.practice?.section];
    const rows = [
      ...menuItems('primary').filter((row) => row.section === codeOf(codes[0])),
      ...(paired()
        ? ofKind('ป').filter((row) => row.section === codeOf(codes[1] ?? ''))
        : []),
    ];
    state.list = [
      ...state.list,
      ...rows.map((row) => ({
        subjectId: current.id,
        section: row.section,
        kind: row.kind,
        credit: current.credit ?? 3,
      })),
    ];
    resetAdd();
    render();
  }

  // What the host's own handlers do for an input or a press, by the control it reached.
  app.addEventListener('input', (event) => {
    if (event.target?.id !== 'input-50') return;
    state.add.value = event.target.value;
    if (state.add.value.length === 8) search(state.add.value);
  });
  app.addEventListener('keydown', (event) => {
    if (config.variant !== 'enterSubmits' || event.key !== 'Enter') return;
    counters.clicks.enter = (counters.clicks.enter ?? 0) + 1;
    state.dialog = { kind: 'confirm' };
    render();
  });
  app.addEventListener('click', (event) => {
    const control = event.target?.closest?.('[data-count]');
    const name = control?.getAttribute('data-count');
    if (control?.disabled) return;
    if (name === 'sectionSelect') {
      state.menu = control.closest('[data-select]').getAttribute('data-select');
    } else if (name === 'option') {
      choose(state.menu, Number(control.getAttribute('data-index')));
      return;
    } else if (name === 'add') {
      addToList();
      return;
    } else if (['acknowledge', 'back', 'close'].includes(name)) {
      state.dialog = null;
    } else if (name === 'continue') {
      state.dialog = { kind: 'confirm' };
    } else if (name === 'confirm') {
      counters.writes += 1;
      state.dialog = null;
    } else if (name === 'clearField') {
      resetAdd();
    } else return;
    render();
  });

  render();
  return {
    state,
    counters,
    /** Make the page behave as the host for a catalog of subjects, or a hostile variant. */
    configure(options) {
      Object.assign(config, options);
      render();
    },
    /** Presses and untrusted events aimed at any control fill may never touch, and writes. */
    forbidden() {
      const allowed = [
        'subjectField',
        'sectionSelect',
        'option',
        'add',
        'acknowledge',
      ];
      const count = (record) =>
        Object.entries(record)
          .filter(([name]) => !allowed.includes(name))
          .reduce((sum, [, value]) => sum + value, 0);
      return (
        count(counters.clicks) + count(counters.untrustedOn) + counters.writes
      );
    },
    /** A student's own pick in an open menu. */
    pick(which, index) {
      choose(which, index);
    },
    /** Merge a change into the page state and render it, as a host update would. */
    set(patch) {
      Object.assign(state, patch);
      if (patch.add) state.add = { ...initialState().add, ...patch.add };
      render();
    },
    /** Raise a host toast of a kind about a subject, with the host's own wording. */
    toast(kind, subjectId) {
      const text =
        kind === 'submitted'
          ? 'ลงทะเบียนล่วงหน้าสำเร็จ'
          : `${PREFIX}${subjectId}: ${TOAST_TEXT[kind]}`;
      state.toasts = [...state.toasts, { kind, text }];
      render();
    },
    /** The total of every counted press and every untrusted event. */
    interactions() {
      return (
        Object.values(counters.clicks).reduce((sum, count) => sum + count, 0) +
        counters.untrusted
      );
    },
  };
}

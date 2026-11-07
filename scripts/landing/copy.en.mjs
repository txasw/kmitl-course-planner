// English copy for the landing page at https://kcp.cecs.sh/en/ (ADR-0066). Strings
// that hold markup carry only lang spans for Thai runs inside English text.

const TH = (text) => `<span lang="th">${text}</span>`;

export const en = {
  lang: 'en',
  path: '/en/',
  title: 'KCP: Course Planner for KMITL, a weekly timetable extension',
  description:
    'KCP is a free Chrome and Firefox extension for KMITL students. It turns the registration course search into a drag and drop weekly timetable that flags clashing class and exam times.',
  ogLocale: 'en_US',
  ogLocaleAlt: 'th_TH',
  ogImageAlt:
    'A weekly timetable exported from KCP, with the name KCP: Course Planner for KMITL.',
  skip: 'Skip to content',
  nav: {
    label: 'Main',
    features: 'Features',
    start: 'Get started',
    faq: 'FAQ',
    home: 'home',
  },
  other: { text: 'ภาษาไทย', lang: 'th', href: '/' },
  install: 'Install',
  hero: {
    lockup: 'KCP: Course Planner for KMITL',
    line1: 'See your whole week',
    line2: 'before you register.',
    lede: 'A browser extension for KMITL students. It turns the course search on the registration site into a drag and drop weekly timetable, merges the repeated rows, flags clashing class and exam times, and keeps your plans in your browser only.',
    trust: 'Free and open source. No account, no tracking.',
    independence:
      'An independent tool built by a student. Not an official KMITL system.',
    alt: 'The KCP planner open on the course search page. On the left, the courses of the Computer Engineering and Cyber Security curriculum, year 1; on the right, a weekly timetable with 7 subjects from Monday to Friday and 19 credits and no conflicts.',
  },
  cta: {
    chrome: 'Add to Chrome',
    chromeSub: 'Also for Edge, Brave and Opera',
    firefox: 'Add to Firefox',
    firefoxSub: 'From Firefox Add-ons',
    web: 'Use on the web',
    webBadge: 'Coming soon',
    webNote:
      'The web version is in development and has no release date yet. Until then, use the extension on Chrome or Firefox.',
    coarse:
      'Extensions install on a computer. Open this page on a computer to install.',
  },
  problem: {
    h2: 'The registration site lists the same section again and again.',
    body: 'One section is open to many curricula, so the result page repeats it under every curriculum it is open to. A search for subject 90641007, Digital Citizen, in semester 1/2569 returns 499 rows that hold only 44 real sections. KCP reads the same public data the registration site uses and merges the repeats into one entry per section.',
    caption: (c) =>
      `Real data from a search of category 90592xxx in semester 1/2569: ${c.rows} rows across ${c.groupings} curricula.`,
    headers: [
      'Listed under',
      'Subject id',
      'Subject',
      'Section',
      'Day and time',
      'Seats',
    ],
    toggle: 'Merge repeated rows',
    merged: (c) => `Merged into ${c.sections} sections from ${c.rows} rows.`,
    unmerged: (c) => `Showing all ${c.rows} rows.`,
    staticResult: (c) =>
      `In KCP these ${c.rows} rows merge into ${c.sections} sections, each listed once.`,
    shotCaption:
      'The same search in KCP: 3 courses and 4 sections, each with its day, time, place and seats on one row.',
    shotAlt:
      'The KCP course list for a search of category 90592xxx, summarised as 3 courses, 4 sections and 9 merged repeats. The cards for 90592008 and 90592033 are open, showing each section with its day, time, room and seats.',
  },
  featuresH2: 'Everything you need to plan a term, in one panel.',
  search: {
    h3: 'Search the three ways the registration site does',
    body: 'Search by curriculum and class year, by subject id, or by subject category. Results arrive as one line course cards that open to show sections, open seats, enrollment conditions and exam dates, with filters for day, credits and full sections.',
    alt: 'The search panel on the curriculum tab, with the engineering faculty, the Computer Engineering department, the Computer Engineering and Cyber Security curriculum and year 1 selected. Below it, the course cards already added to the plan.',
  },
  conflict: {
    h3: 'Drag a section in and see a clash before you drop',
    body: 'As soon as you pick up a section, the timetable shows where each of its meetings will land. A green outline means it fits; red hatching marks a clash with a subject already in your plan, named with the time it overlaps. If it cannot be placed, KCP offers other sections of the same subject that fit. Lecture and practice pairs are always added and removed together.',
    fig1: 'Dragging General Physics Laboratory 1, section 3, onto Tuesday, where it clashes with General Physics 1, section 4.',
    fig2: 'The drop is refused, and KCP offers section 5 on Wednesday, 13:00-16:00, which fits.',
    alt1: 'The timetable during a drag of section 3. The Tuesday 09:00 to 12:00 slot over General Physics 1 is marked, with a chip naming the clash with 01006020 section 4.',
    alt2: 'A message under the timetable header says the section cannot be placed because of a time clash, with a button to add section 5 on Wednesday 13:00 to 16:00.',
  },
  exam: {
    h3: 'Exam dates are checked too, not only class times',
    body: 'Two subjects that meet on different days can still share a midterm slot. KCP compares the midterm and final windows of every subject in your plan and will not add a section whose exam clashes. The Summary view lists the term’s exams by date, with your weekly hours and free days.',
    fig1: 'Digital System Fundamentals meets on Monday, but its midterm on 21 Aug 2569 falls at the same time as General Physics 1.',
    fig2: 'The plan’s Summary view, with exams by date and the weekly workload.',
    alt1: 'The course card for 01076112. Its sections carry an exam clash badge, and a soft red box says the exam clashes with 01006020 section 4, midterm on 21 Aug 2569.',
    alt2: 'Midterm and final exams of the subjects in the plan listed by date, followed by weekly lecture, practice and self study hours.',
  },
  layouts: {
    h3: 'Built for wide screens, narrow windows and touch',
    body: 'On a laptop the course list sits beside the timetable. On a tablet it opens as a side sheet. In a window narrower than 640 px, the planner shows one pane at a time behind a bottom bar, the timetable reads one day at a time, and a long press picks up a section on a touch screen.',
    figs: [
      'Courses and search',
      'Tuesday timetable',
      'Section details from the bottom of the screen',
    ],
    alts: [
      'The planner in a narrow window, on the courses pane with the Calculus 1 card open and the bottom bar below.',
      'The Tuesday timetable in a narrow window, with General Physics 1 at 09:00 to 12:00 and Introduction to Psychology at 13:00 to 16:00.',
      'The details of General Physics 1, section 4, open from the bottom of the screen with its class time, room, instructors, seats and exam dates.',
    ],
    footnote:
      'The extension runs on computer browsers that support extensions. See the FAQ about phones.',
    region: 'Narrow window examples',
  },
  export: {
    h3: 'Share your timetable as a ready to send image',
    body: 'Preview mode lays your plan out as a poster. Pick a template for a 16:9 share, a phone or tablet wallpaper, or an A4 print, then download it, copy the image, or copy it as text for chat apps. The image comes out at the same size whatever screen you export from, and can carry your exam schedule under the timetable.',
    templates:
      'Templates: Share 16:9, phone wallpaper in portrait and landscape, tablet wallpaper in portrait and landscape, Print A4.',
    alt1: 'A timetable image exported from KCP at 1920 by 1080, with the plan name, semester 1/2569, total credits, and subject blocks from Monday to Friday.',
    alt2: 'A portrait phone wallpaper of the same plan, with days as columns and the exam schedule below.',
  },
  plans: {
    h3: 'Keep several plans, checked against the latest data every time you open them',
    body: 'Keep several named plans per term, duplicate them, and export them as a file. Each time you open a plan, KCP checks its sections against the latest data. If a time, room or exam date changed, or a section is no longer listed, it shows the old and new values for you to review, and never removes anything on its own.',
    fig1: 'The updates dialog shows the old and new time of a section that changed.',
    fig2: 'The plan menu, where you create, switch, import and export plans.',
    alt1: 'The Changes to your planned sections dialog. Calculus 1, section 33, shows its old and new time, with a Mark all as reviewed button.',
    alt2: 'The plan menu with two plans for semester 1/2569, the Create plan button, and the Import JSON and Export JSON actions.',
  },
  privacy: {
    h3: 'Your data stays in your browser, and access is read only',
    body: 'KCP has no account, no server and no usage statistics. The extension reads only the public course data the registration site already uses. It never touches your sign in, never fills in or submits forms, and never registers on your behalf.',
    heading: 'Permissions the extension asks for, and why',
    perms: [
      [
        'storage',
        'Saves your plans and reference lists on this device, so the planner opens quickly and your plans survive a reload.',
      ],
      [
        'regis.reg.kmitl.ac.th',
        'Shows the planner on the registration site and reads the public course data the page already loads.',
      ],
      [
        'api.reg.kmitl.ac.th',
        'Reads the public faculty, department, curriculum and category lists used in the search options.',
      ],
    ],
    link: 'Read the privacy policy',
  },
  more: {
    h2: 'More help with the decisions',
    items: [
      [
        'Suggest a plan',
        'After a curriculum search, KCP offers up to three clash free timetables of the curriculum subjects, shaped for mornings, afternoons or fewer days.',
      ],
      [
        'Compare sections',
        'See every section of a course in one table, with times, instructors, seats, exams and conditions, and add one from there.',
      ],
      [
        'Seats and demand',
        'Every section shows its open seats, and flags when pre registrations exceed capacity.',
      ],
      [
        'Open it your way',
        'Open the planner from the Planner button at the bottom right, the extension icon, or Alt+Shift+P.',
      ],
      ['Thai and English', 'Switch the interface language at any time.'],
    ],
    fig: 'Suggested plans shaped for mornings, three options side by side.',
    alt: 'The suggested plans dialog with Mornings selected, showing options 1 to 3 with credits, subjects, class days, a small timetable and a Use this plan button.',
  },
  steps: {
    h2: 'Get started in three steps',
    intro:
      'After you install, the registration site’s course search opens with a short welcome, and you can open the planner any time from the Planner button at the bottom right.',
    items: [
      [
        'Search for courses',
        'Search by curriculum and class year, subject id, or subject category.',
      ],
      [
        'Drag sections into the timetable',
        'Clashing class times and exam times are flagged as you place them.',
      ],
      [
        'Share as an image',
        'Download or copy your timetable as an image to send to others.',
      ],
    ],
    alt: 'The welcome shown after install, Thank you for installing KCP: Course Planner for KMITL, with three steps and a Start planning button.',
  },
  download: {
    h2: 'Install KCP for free',
    body: 'Works on Chrome, Microsoft Edge, Brave, Opera and Firefox on a computer. The planner runs only on the registration site at regis.reg.kmitl.ac.th.',
    meta: (version, source) =>
      `Version ${version}. Free under the MIT license. ${source}.`,
    source: 'View the source on GitHub',
  },
  faq: {
    h2: 'Frequently asked questions',
    items: [
      [
        'What is KCP?',
        'KCP, or Course Planner for KMITL, is a browser extension for planning your timetable before registration, using the course offerings on the KMITL registration site.',
      ],
      [
        'Is KCP an official KMITL system?',
        'No. KCP is an independent tool built by a student. It is not affiliated with, sponsored by, or endorsed by King Mongkut’s Institute of Technology Ladkrabang.',
      ],
      [
        'Can KCP register for courses for me?',
        'No. KCP is for planning before registration. You still register on the institute’s registration site as usual. The extension never fills in forms or sends requests on your behalf.',
      ],
      [
        'Does any of my data leave my computer?',
        'No. Saved plans live in your browser’s storage on this device. There is no account, no server and no usage tracking. Removing the extension removes this data.',
      ],
      [
        'Which browsers does it work on?',
        'Chrome, Microsoft Edge, Brave, Opera and other Chromium browsers install it from the Chrome Web Store, and Firefox installs it from Firefox Add-ons, all on a computer. Opera may first need its helper for Chrome Web Store extensions.',
      ],
      [
        'Can I use it on my phone?',
        'Not yet. Chrome on phones does not support extensions, and support for Firefox for Android is not yet confirmed. The planner already adapts to narrow windows and touch screens, and the web version in development is planned to work without installing an extension.',
      ],
      [
        'When will the web version open?',
        'There is no date yet. When it opens, the Use on the web button on this page becomes a working link. Until then, use the extension on Chrome or Firefox.',
      ],
      [
        'How current is the course data?',
        'KCP shows the same data the registration site sends and checks its shape before showing it. Results show when they were fetched, and saved plans are checked against the latest data when you open them. Check against the registration site before you register.',
      ],
      [
        'Can I move a plan to another computer?',
        'Yes. Export the plan as a JSON file from the plan menu and import it on the other computer. An imported plan is checked against the latest data the first time you open it.',
      ],
      [
        'Does KCP cost anything?',
        'No. KCP is free and open source under the MIT license.',
      ],
    ],
  },
  footer: {
    disclaimer: `KCP: Course Planner for KMITL is an independent tool built by a student. It is not affiliated with, sponsored by, or endorsed by King Mongkut’s Institute of Technology Ladkrabang (KMITL). The names KMITL and ${TH('สจล.')} are used only to identify the site this tool works with.`,
    sitePrivacy:
      'This site uses no cookies, no analytics and no files from other servers.',
    linksLabel: 'Links',
    source: 'Source on GitHub',
    privacy: 'Privacy policy',
    issues: 'Report an issue',
    trademarks:
      'Chrome and Chrome Web Store are trademarks of Google LLC. Firefox is a trademark of the Mozilla Foundation.',
    license: 'MIT license',
  },
  frame: 'Browser window',
  notFound: {
    title: 'Page not found',
    body: 'The page you asked for does not exist. The link may have changed or the page was removed.',
    back: 'Back to the home page',
  },
};

// English copy for the landing page at https://kcp.cecs.sh/en/ (ADR-0066). Strings
// that hold markup carry only lang spans for Thai runs inside English text.

const TH = (text) => `<span lang="th">${text}</span>`;

export const en = {
  lang: 'en',
  path: '/en/',
  // The brand already answers KMITL course planner; the rest names the phrase English
  // searchers pair with it.
  title: 'KCP: Course Planner for KMITL | Weekly timetable planner',
  // Under 155 characters, so a search result shows the whole claim.
  description:
    'Free Chrome and Firefox extension for KMITL students: turn the course search into a drag and drop weekly timetable that flags class and exam clashes.',
  ogLocale: 'en_US',
  ogLocaleAlt: 'th_TH',
  ogImageAlt:
    'A weekly timetable exported from KCP, with the name KCP: Course Planner for KMITL.',
  skip: 'Skip to content',
  // The quiet cue under a pinned scene that has stopped on a finished step.
  scrollOn: 'Keep scrolling',
  nav: {
    label: 'Main',
    features: 'Features',
    faq: 'FAQ',
    faqShort: 'FAQ',
    home: 'home',
  },
  other: { text: 'ภาษาไทย', lang: 'th', href: '/' },
  install: 'Install',
  hero: {
    lockup: 'KCP: Course Planner for KMITL',
    line1: '<span class="phrase">See your whole week</span>',
    line2: '<span class="phrase">before you register.</span>',
    lede: 'A browser extension that turns the KMITL course search into a drag and drop weekly timetable planner.',
    fine: 'Free and open source. Also for Edge, Brave <span class="keep">and Opera.</span>',
    alt: 'The KCP planner on the registration site, with a weekly timetable from Monday to Friday that holds Programming Fundamental, General Physics 1, Calculus 1 and Discrete Mathematics in the mornings.',
  },
  cta: {
    web: 'Use on the web',
    webBadge: 'Coming soon',
    webNoteShort:
      'The web version is in development, with no release date yet.',
    coarse: 'For computers only.',
  },
  problem: {
    h2: (c) =>
      `<span class="statement__line">Search one category, get ${c.rows} rows.</span> <span class="statement__line"><span class="keep">Only ${c.sections} real sections.</span></span>`,
    sub: 'KCP merges the repeats into one entry per section.',
    caption: (c) =>
      `${c.rows} rows from ${c.groupings} curricula. Real sample: category 90592xxx, semester 1/2569.`,
    headers: [
      'Listed under',
      'Subject id',
      'Subject',
      'Section',
      'Day and time',
      'Seats',
    ],
    merged: (c) => `Merged into ${c.sections} sections.`,
    staticResult: () => 'Each section is listed once.',
    countRows: (c) => `<span class="count__num">${c.rows}</span> rows`,
    countJoin: 'into',
    countSections: (c) =>
      `<span class="count__num">${c.sections}</span> sections`,
  },
  story: {
    h2: 'Plan by drag and drop',
    beats: [
      'Drag sections into your week.',
      'See a clash before you drop.',
      'Get a section that fits, right away.',
    ],
    chip: (b) => [
      `Clashes with ${b.subjectId} section ${b.section}`,
      `${b.dayLabel} ${b.time}`,
    ],
    readout: (s) => `${s.credits} credits, ${s.subjects} subjects, no clashes`,
  },
  exam: {
    h2: 'Exam clashes are checked too.',
    sub: 'Two subjects on different days can share an exam slot. KCP will not add one that clashes.',
    alt1: 'The course card for 01076112. Its sections carry an exam clash badge, and a soft red box says the exam clashes with 01006020 section 4, midterm on 21 Aug 2569.',
  },
  export: {
    h2: 'Share it as a ready to send image.',
    sub: 'Sized for sharing, phone wallpapers or A4 print.',
    alt1: 'A timetable image exported from KCP at 1920 by 1080, with the plan name, semester 1/2569, total credits, and subject blocks from Monday to Friday.',
    alt2: 'A portrait phone wallpaper of the same plan, with days as columns and the exam schedule below.',
  },
  plans: {
    h2: 'Your plan stays current.',
    sub: 'Changed times and rooms show beside the old ones, and nothing is removed <span class="keep">for you.</span>',
    alt1: 'The Changes to your planned sections dialog. Calculus 1, section 33, shows its old and new time, with a Mark all as reviewed button.',
  },
  more: {
    h2: 'And more',
    items: [
      ['Three ways to search', 'By curriculum, subject id or category.'],
      ['Suggested plans', 'Clash free timetables from your curriculum.'],
      ['Compare sections', 'Times, instructors, seats and exams side by side.'],
      ['Copy as text', 'Paste your whole week into a chat as plain text.'],
    ],
  },
  privacy: {
    h2: 'Your data stays in your browser.',
    sub: 'No account, no server, no tracking. KCP only reads public course data.',
    heading: 'Permissions',
    perms: [
      ['storage', 'Keeps your plans on this device.'],
      ['regis.reg.kmitl.ac.th', 'Shows the planner on the registration site.'],
      ['api.reg.kmitl.ac.th', 'Reads faculty, curriculum and category lists.'],
    ],
    link: 'Read the privacy policy',
  },
  download: {
    h2: 'Install KCP for free',
    meta: (version, source) => `Version ${version}, MIT license. ${source}.`,
    source: 'View the source on GitHub',
  },
  faq: {
    h2: 'Frequently asked questions',
    items: [
      [
        'Is KCP an official KMITL system?',
        'No. KCP is an independent tool built by a student and is not endorsed by KMITL.',
      ],
      [
        'Can KCP register for courses for me?',
        'No. KCP is for planning only. You still register on the registration site.',
      ],
      [
        'Can I use it on my phone?',
        'Not yet. Chrome on phones does not support extensions. The web version in development is planned to work without installing.',
      ],
      [
        'Does it work for every faculty?',
        'Yes. KCP reads the same course data as the registration site, so it covers every faculty and curriculum.',
      ],
    ],
  },
  footer: {
    disclaimer: `KCP: Course Planner for KMITL is not affiliated with King Mongkut’s Institute of Technology Ladkrabang (KMITL), and uses the names KMITL and ${TH('สจล.')} only to identify the site it works with.`,
    sitePrivacy:
      'This site uses no cookies, no analytics and no files from other servers.',
    linksLabel: 'Links',
    source: 'Source on GitHub',
    privacy: 'Privacy policy',
    issues: 'Report an issue',
    trademarks:
      'Chrome, the Chrome logo and Chrome Web Store are trademarks of Google LLC. Firefox and the Firefox logo are trademarks of the Mozilla Foundation in the US and other countries.',
    license: 'MIT license',
  },
  frame: 'Browser window',
  notFound: {
    title: 'Page not found',
    body: 'The page you asked for does not exist. The link may have changed or the page was removed.',
    back: 'Back to the home page',
  },
};

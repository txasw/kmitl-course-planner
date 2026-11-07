# Privacy

Last updated: 2026-11-07.

This policy is published at
https://github.com/txasw/kmitl-course-planner/blob/main/docs/PRIVACY.md and is the
privacy policy referenced by the Chrome Web Store and Firefox Add-ons listings.

KCP: Course Planner for KMITL keeps all data inside your browser. It has no backend,
sends no analytics or telemetry of any kind, and loads no remote scripts or fonts at
runtime. Course data is read from the public KMITL endpoints that the registration site
itself calls, and it is used only to render your planner.

KCP: Course Planner for KMITL is an independent student project. It is not affiliated
with, sponsored by, or endorsed by King Mongkut's Institute of Technology Ladkrabang
(KMITL).

## Data storage

The extension keeps the following in the browser extension storage on your own device:

- Your saved plans. If the saved plan data is ever unreadable, a copy is set aside on
  the device so you can export it.
- Cached public course data: the faculty, department, curriculum, and subject lists and
  the current registration term for up to a day, and recent course search results for up
  to ten minutes.
- Your interface preferences, such as the language and the display options.
- The last search on each search tab, so the form can restore it after a reload.
- The date and version of the installation.
- The onboarding state: when the welcome message showed, when the panel first opened,
  and whether you turned off the entry prompt beside the Planner button.
- A short lived record of a tab the extension opened for you, kept in session storage
  so that tab can open the planner. The browser clears it when it restarts.

All of it stays on your device. Nothing is uploaded anywhere. Removing the extension
removes this data.

## First run

When you first install the extension, it opens the course search page of the
registration site, https://regis.reg.kmitl.ac.th/#/teach_table_selector, in a new tab
and shows a short welcome message there. It does this once, and only when it has
access to both KMITL sites. Updates of the extension or the browser open no tab.

## Toolbar icon and shortcut

When you click the extension icon in the browser toolbar or press Alt+Shift+P
(Option+Shift+P on macOS), the planner opens. On a registration page it opens in that
tab. From any other tab, the extension opens the registration search page with the
planner, or brings forward the one it opened moments before. It does this only on your
request. On Firefox, the browser may ask you at that moment to allow access to the two
KMITL sites.

## Permissions

The extension requests the minimum permissions that make the product work.

- `storage`: save your plans, preferences, and onboarding state, and cache course data
  locally so the interface loads quickly and your plans survive page reloads.
- Host access to `https://regis.reg.kmitl.ac.th/*`: run the planner interface on the
  registration site, read the public teach table data, and read the current
  registration term that sets the default term of the search form.
- Host access to `https://api.reg.kmitl.ac.th/*`: read the public faculty,
  department, curriculum, and subject reference data.

The extension requests no access to tabs, browsing history, or any other site.

## Diagnostics

Development builds include a diagnostics view for catching data contract changes
during development. It runs only in the development flavor, never in the
published extension, and any report it produces stays on your machine.

## Contact

Questions about this policy can be raised as an issue on the project repository at
https://github.com/txasw/kmitl-course-planner.

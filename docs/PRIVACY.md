# Privacy policy

Effective date: 2026-11-10.

This policy covers the KCP: Course Planner for KMITL browser extension and its project
site. It is the privacy policy linked from the Chrome Web Store and Firefox Add-ons
listings and from the project site, and it is published at
https://github.com/txasw/kmitl-course-planner/blob/main/docs/PRIVACY.md.

KCP: Course Planner for KMITL stores your plans and settings only in your browser. It has
no account, no server of its own, and no analytics or telemetry, and it loads no remote
scripts or fonts. Its only network traffic is read only requests for public course data to
the KMITL services described below.

KCP: Course Planner for KMITL is an independent student project. It is not affiliated
with, sponsored by, or endorsed by King Mongkut's Institute of Technology Ladkrabang
(KMITL).

## Network requests

The extension contacts only two KMITL services, the same public endpoints the registration
site calls:

- https://regis.reg.kmitl.ac.th for course search results and the current registration
  term.
- https://api.reg.kmitl.ac.th for the faculty, department, curriculum, and subject
  category lists.

Requests are made only when you open the planner, run or refresh a search, or open a saved
plan, which is then checked against the current course data. There is no background
polling. A request carries only the search you chose, such as the term, the faculty, the
curriculum, or a subject id. As with any web request, those servers also receive your IP
address and basic browser details. KCP never signs in, never reads your KMITL login, and
never sends your plans anywhere.

## Data storage

The extension keeps the following in the browser's extension storage on your device:

- Your saved plans. If saved plan data is ever unreadable, a copy is set aside on the
  device so you can export it.
- Cached public course data: the faculty, department, curriculum, and subject category
  lists, the current registration term, and recent course search results.
- Your interface preferences, such as the language and the display options.
- The last search on each search tab, so the form can restore it after a reload.
- The date and version of the installation.
- The onboarding state: when the welcome message showed, when the panel first opened,
  and whether you turned off the entry prompt beside the Planner button.
- A short lived record of a tab the extension opened for you, kept in session storage so
  that tab can open the planner.

| Data                                                                         | Kept for                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Saved plans                                                                  | Until you delete the plan or remove the extension         |
| A set aside copy of unreadable plan data                                     | Until you remove the extension                            |
| Faculty, department, curriculum, and category lists, and the current term    | Used for up to 24 hours, then fetched again               |
| Course search results                                                        | Used for up to 10 minutes, then fetched again             |
| Preferences, last search per tab, install date and version, onboarding state | Until changed or until you remove the extension           |
| Record of a tab KCP opened for you (session storage)                         | At most one minute, and cleared when the browser restarts |

None of this data is uploaded anywhere.

## Deleting your data

Delete a single plan from the plan menu. Removing the extension deletes everything it
stored, because the browser clears an extension's storage when the extension is removed.
Images, plan JSON files, and copied text are created only when you ask for them. They go
where you choose, and KCP keeps no copy.

## First run

When you install the extension, it opens the registration course search page,
https://regis.reg.kmitl.ac.th/#/teach_table_selector, in a new tab and shows a short
welcome there. This happens once, and only if the browser has granted access to both KMITL
sites. Updates of the extension or the browser open no tab.

## Toolbar icon and shortcut

Clicking the KCP icon in the browser toolbar or pressing Alt+Shift+P (Option+Shift+P on
macOS) opens the planner. On a registration page it opens in that tab. On any other tab,
KCP opens the registration search page with the planner, or brings forward the tab it
opened for you within the last minute. It does this only when you ask. On Firefox, the
browser may ask at that moment for access to the two KMITL sites.

## Permissions

| Permission                                       | Why it is needed                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                        | Saves your plans, preferences, and onboarding state, and caches public course data so the planner opens quickly and your plans survive a reload.                           |
| Host access to `https://regis.reg.kmitl.ac.th/*` | Shows the planner on the registration site, reads the public course search results, and reads the current registration term that sets the default term of the search form. |
| Host access to `https://api.reg.kmitl.ac.th/*`   | Reads the public faculty, department, curriculum, and subject category lists.                                                                                              |

KCP does not request the tabs, history, scripting, or all sites permissions, so it cannot
read the address or the content of your other tabs. The toolbar icon and the keyboard
shortcut are manifest entries, not permissions. Opening or bringing forward the
registration tab uses browser functions that need no extra permission.

## Website

The project site at https://kcp.cecs.sh/ (Thai) and https://kcp.cecs.sh/en/ (English) is a
static site served by Cloudflare. It sets no cookies, runs no analytics or tracking, and
loads its fonts, styles, scripts, and images only from its own address, which its Content
Security Policy enforces. Cloudflare receives each request, including your IP address, in
order to deliver and protect the site, under the Cloudflare privacy policy at
https://www.cloudflare.com/privacypolicy/. The project adds no logging of its own and sees
only the aggregate traffic counts that Cloudflare shows every site owner. Links to the
stores and to GitHub lead to sites with their own privacy policies.

## Diagnostics

Development builds include a diagnostics view for catching changes in the course data
during development. It exists only in the development flavor, never in the published
extension, and any report it produces stays on your device.

## Changes to this policy

Changes to this policy are published in this file and recorded in the repository history,
and the effective date above changes with them. A change that would collect new data is
described here before it ships.

## Contact

Open an issue at https://github.com/txasw/kmitl-course-planner/issues. For a matter you
would rather not raise in public, use the contact details on the maintainer's GitHub
profile at https://github.com/txasw.

# 62. Toolbar action, shortcut and install welcome

Status: Accepted
Date: 2026-11-06

Amends brief section 7.2, which lists the manifest keys and asks for a record before any manifest
change, and brief section 6.1, where the floating launcher is the only way into the panel.

## Context

The panel opens only from the floating launcher on a regis page. A student who has just installed
the extension sees nothing happen, a student on another site has no way to reach the planner, and
the toolbar icon that every browser shows for the extension does nothing when clicked. The owner
asked for three entry points beside the launcher: a toolbar icon click that opens the panel, a
keyboard shortcut for the same action, and a one time welcome on the first visit after install.

The manifest today declares no `action` and no `commands`. Permissions are `storage` alone with the
two KMITL host permissions, and section 7.2 rules out `tabs`, `activeTab` and `scripting`. The
worker has one `runtime.onMessage` router whose handlers receive the message only, and the content
script sends messages but never listens. These constraints decide most of the design.

Without the `tabs` permission, `tab.url` on a clicked tab is readable only when the extension
already has host access to that page. Chrome with site access set to on click and Firefox with
access withheld both leave it empty, so a decision by URL would fail in exactly the states where
the student most needs a fallback. WXT 0.20 uses the native `chrome` namespace with no polyfill, so
a promise returned from an `onMessage` listener is not treated as the reply on Chrome. A Manifest
V3 worker can be suspended at any time, so state that must outlive a click cannot live in worker
memory. `storage.session` holds such state but is missing on Firefox before 115, and the manifest
declares no Gecko `strict_min_version`.

## Decision

Manifest. The manifest gains `action` with `default_title` equal to the manifest name, so the
debug build's suffix carries over to the tooltip, and `default_icon` at 16 and 32 px. There is no
`default_popup`. On Firefox only, the action carries `default_area: "navbar"`, so the icon is
pinned to the toolbar instead of hidden in the unified extensions menu. Chrome does not know the
key and lists it as an unrecognized manifest key, so the Chrome build never emits it. The manifest also gains
`commands: { _execute_action: { suggested_key: { default: "Alt+Shift+P" } } }`; Chrome maps Alt to
Option on macOS. `permissions` stays `["storage"]` and `host_permissions` is unchanged: no `tabs`,
no `activeTab`, no `scripting`, and no optional permissions. The host match pattern and the
selector URL, `SELECTOR_URL`, come from one module that both the manifest builder and the worker
import, so the two can never disagree.

Icon click. On Firefox the click handler calls `permissions.request({ origins: HOST_ORIGINS })`
with both origins as its first statement, which keeps the user gesture the request needs. It
resolves true with no prompt when access is already granted, and when the student declines nothing
opens. Chrome makes no request. The worker then sends `{ type: 'shell/openPanel' }` through
`tabs.sendMessage` to the clicked tab whatever its URL, since only this extension's content script
can answer. The content listener acknowledges synchronously through `sendResponse`, and the worker
counts the open as delivered only when the reply passes a Zod check of that acknowledgement. This
is the validation boundary in the worker to content direction.

When the send is rejected, which means no receiver (a tab on another site, or a regis tab opened
before install), the worker acts inside one serialized intent queue. If an unexpired open intent
exists, it activates that tab with `tabs.update` and focuses its window with `windows.update`; both
need no permission. Otherwise it calls `tabs.create({ url: SELECTOR_URL })` and records an open
intent for the new tab id in `storage.session`, with a time to live of 60 seconds. Creating the tab
and recording the intent run as one queued step, so a content script that mounts quickly cannot ask
for its intent before the intent exists. When `storage.session` is missing, on Firefox before 115,
the new tab opens without the panel opening by itself. A click while the panel is open leaves it
open: the icon opens the panel and never closes it.

Handshake. The content script registers its `runtime.onMessage` listener first and then sends
`shell/mounted` once per document. The worker consumes the open intent for `sender.tab.id` through
the same queue and answers `{ openPanel, shortcut }`, and the content side validates the answer with
Zod. The worker reads the shortcut from `commands.getAll()`, since the `commands` API is not
available to content scripts, and the content side formats it into words, because Chrome on macOS
returns modifier key symbols, which section 2 does not allow in copy. An
empty or overlong value becomes null and hides the shortcut hint. The listener is removed when the
WXT content script context is invalidated.

Install. `runtime.onInstalled` with reason `install` writes `kcp:install` to `storage.local` only
when the record is absent, and reports whether it created it. The record holds a schema version,
the install time and the extension version, and the content side only reads it. Only when the
record was newly created and `permissions.contains` reports both origins does the worker call
`tabs.create` at exactly `#/teach_table_selector`, with no query parameters, since the host uses the
Vue 2 hash router, and record a welcome intent for that tab id. Without access, on Firefox before
127 or with access turned off by the student or by policy, it opens no tab, because a host page
without the planner reads as broken. The welcome then shows on the first visible mount after access
is granted. Every other reason, `update`, `chrome_update`, Firefox's `browser_update` and
`shared_module_update`, writes nothing, so existing users see no welcome. A Firefox temporary reload fires `install` again, finds the record,
and opens no tab.

Welcome claim. The content side asks for the welcome only when `kcp:install` exists,
`kcp:onboarding.welcomeShownAt` is absent, the handshake applied no requested open, and the
document is visible. A hidden document waits for its first `visibilitychange`. It sends
`onboarding/claimWelcome`, and the worker grants the claim inside the intent queue when no
unexpired welcome intent names a different tab and no claim is recorded in its own session record.
On a grant the content side writes `welcomeShownAt` and then shows the welcome, so the install tab
has priority over regis tabs that were already open. A document that applied a requested open does
not claim, so the welcome and the panel never stack.

Storage ownership follows section 7.1. The worker writes `kcp:install` in `storage.local` and
`kcp:session:tabIntents` in `storage.session`. The content side writes `kcp:onboarding` in
`storage.local`. Neither side writes a key the other owns, and every read goes through Zod.

## Alternatives considered

A `default_popup` was rejected. It adds a second interface and an extra click, and the panel is the
product.

`activeTab` or `scripting` injection into the clicked tab was rejected on least privilege grounds.

Deciding by `tab.url` was rejected, since the URL is unreadable without `tabs` in some of the
states above.

A URL marker or query parameter that tells the new tab to open the panel was rejected. The host
uses a hash router, and the extension does not alter the host's navigation.

Reloading a regis tab that has no receiver was rejected. It loses the host page state and goes
beyond the read only integration that section 2 requires.

Holding intents in worker memory was rejected, because a Manifest V3 worker can be suspended
between the click and the mount.

Web Locks for the welcome claim were rejected. The lock name lives in the host origin namespace,
where the page can query it; lock behaviour across Firefox content script wrappers is unverified;
and the first injected tab could win the lock over the install tab, which would show the welcome in
a background tab when Firefox injects into regis tabs that were already open.

A welcome page hosted by the extension was rejected. Section 6.9 rules out an options page, and the
welcome belongs where the planner runs.

## Consequences

Playwright cannot click the toolbar or press browser command keys. The click handler is a pure
function with injected dependencies, unit tested for the Firefox gesture order, the serialized
create, and the activation of a pending tab. A debug only `__kcp.action()` handle on the existing
worker console handle drives the same handler end to end on a regis tab and on a blank tab. The
shortcut is asserted in the manifest unit test and the smoke spec, and it is pressed by hand in
manual QA on Chrome, Edge, Opera and Firefox, including Windows with Thai and English layouts where
Alt+Shift switches the input language, and Option+Shift+P on macOS.

Every fresh Playwright profile fires `onInstalled`, so the end to end fixture settles the install
tab by default. Every fresh `wxt dev` profile shows the welcome. Firefox stays under manual QA per
ADR-0030: the pinned toolbar area, the permission request gesture, install without host access,
injection into tabs that were already open, where the welcome must appear only in the install tab,
and `storage.session` on 115 and later.

PRIVACY.md and STORE_LISTING.md gain a line about the tab opened on first run.

Known limitations. On Chrome with site access set to on click, a student may need to reload before
the content script runs, and the fallback tab can also lack access. A message that races the
content listener falls back to a new tab, so a student can end with two regis tabs; this is
accepted.

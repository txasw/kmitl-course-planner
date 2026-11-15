# 70. Firefox for Android support and the host viewport

Status: Accepted
Date: 2026-11-15

Completes the phone support gate of ADR-0048.

## Context

ADR-0048 shipped the Compact tier for narrow windows and touch screens but held back any claim of
phone browser support, in the store listing, the README or a manifest declaration for Firefox for
Android, until two live checks passed. The first is that the host page declares a
width=device-width viewport meta tag. Without it a phone lays the page out at about 980 px and
scales it down, so no narrow breakpoint fires inside the overlay, and the extension may not add
the tag because it never modifies the host document. The second is that the extension runs on the
live host in Firefox for Android, the mobile browser that runs WebExtensions. addons.mozilla.org
lists an add-on for Android only when its manifest declares
`browser_specific_settings.gecko_android`.

## Host viewport finding

On 2026-11-15 at 07:25 UTC one read only page load of
`https://regis.reg.kmitl.ac.th/#/teach_table_selector` ran in Playwright Chromium emulating a
390 by 844 phone at device pixel ratio 3, with `isMobile` and touch on. No form field was filled
and no host control was clicked. The page answered 200 and declares exactly one viewport meta tag:

```
width=device-width,initial-scale=1
```

`document.documentElement.clientWidth`, `window.innerWidth`, `scrollWidth` and the visual
viewport width were all 390. The host lays out at the device width, so the overlay sees the phone
width and the Compact tier applies with no help from the extension. The meta tag is part of the
document, not of the engine, so the finding holds for Firefox for Android too; the phone run in
the validation section confirms the rendering there.

## Decision

The Firefox target declares Firefox for Android support:

```json
"gecko_android": { "strict_min_version": "142.0" }
```

The minimum is 142 because the manifest already declares
`gecko.data_collection_permissions`, which Firefox for Android supports from 142. addons-linter
10.15.0 was run on the Firefox bundle with each candidate minimum: 113.0, 120.0, 128.0 and 140.0
each raise `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` for that key, and 142.0 raises none.
No other manifest key is reported as unsupported on Android at 142. The desktop `gecko` block is
unchanged, and the new key sits beside it in the one `browser_specific_settings` block that every
target already receives. The permissions stay `storage` only and the host permissions stay the
two KMITL origins of brief section 7.2; the unit tests and the manifest smoke spec assert both,
and the smoke spec now reads the built Firefox manifest as well as the Chrome one.

addons-linter lints the built Firefox bundle in CI, as a step of the existing `build` job on its
Firefox leg, so no required check name changes. It is a dev dependency pinned to an exact version
and runs through the `lint:firefox` script with `--warnings-as-errors`, because the linter reports
a manifest key that Firefox for Android does not support at the declared minimum as a warning,
not an error, so an errors only run would pass the very drift this step exists to catch. The
baseline has five warnings, all from bundled third party code: the `Function` constructor feature
check in the validation library and `innerHTML` writes inside the UI runtime. The two JavaScript
rules behind them, `no-new-func` and `no-unsanitized/property`, are turned off with
`--disable-linter-rules`, since ESLint already forbids both in the project's own source. Every
other finding fails the step, and the store review still runs the full rule set.

addons-linter pins `deepmerge` 4.3.1, which carries the low severity advisory
GHSA-gcqx-w48m-w2h4 with no fixed release. The linter merges only its own bundled schemas with
it, runs only in CI against the extension's own build output, and never ships in the bundle.
`osv-scanner.toml` ignores that one advisory with a reason and an expiry date three months out,
so the scan fails again if the ignore is not revisited.

Merging this decision is the phone support claim. Store and README copy that mention phones
follow in their own change once this lands.

## Alternatives considered

Running addons-linter through `pnpm dlx` was rejected: its dependency tree would resolve fresh on
every run, outside the lockfile and outside the vulnerability scan. `web-ext lint` was rejected
because it wraps the same linter in a larger tree. A separate CI job was rejected because it adds a
required check name to branch protection for a step that belongs with the build it inspects.
Failing on errors only was rejected because an Android minimum below 142 raises a warning, so that
run passed a manifest the store would list with an ignored consent key.

A lower Android minimum was rejected because the linter reports the data collection key as
unsupported below 142, so the consent declaration would be ignored on those versions. Injecting a
viewport meta tag was rejected outright: the host already declares one, and the extension never
modifies the host document. Declaring Android support from the viewport check alone, without a
run on a real phone, was rejected because ADR-0048 makes both checks the gate.

## Consequences

Once a version with this manifest is submitted, addons.mozilla.org lists the add-on for Firefox
for Android 142 and later. The Chrome build already carries the `browser_specific_settings` block,
which Chromium ignores, and the new key rides in it the same way, so Chrome behavior is unchanged.
The `e2e` job now also builds the Firefox bundle so the smoke spec can read its manifest. If the
validation run fails, this decision does not merge, and an amendment records that phone support
is not claimed and why.

## Validation

The extension runs on Android only in Firefox, which Playwright cannot drive with an extension
loaded, so this run is manual and is done by the owner on a real phone. The merge of this
decision waits on it. The same steps are the Firefox for Android support gate in
`docs/MANUAL_QA.md`. The back gesture step needs the overlay back gesture handling, so the run
uses a build of a branch that includes it.

1. On the phone, install Firefox 142 or later from Google Play. Turn on Developer options and USB
   debugging in Android settings, and Remote debugging via USB in Firefox settings. Connect the
   phone to a computer with the Android platform tools installed; `adb devices` lists its device
   id.
2. On the computer, run `pnpm install --frozen-lockfile` and `pnpm wxt build -b firefox`, the
   production bundle that carries the declaration.
3. Install it with the command below, with the device id from step 1. Firefox opens on the phone
   with the add-on loaded.

   ```
   pnpm dlx web-ext@10.8.0 run --target=firefox-android --android-device=<device id> --firefox-apk=org.mozilla.firefox --source-dir .output/firefox-mv3
   ```

4. Site access. In Firefox, open Extensions from the menu and then the add-on's permissions. They
   list storage and access to the two KMITL sites only, and the site access is on. If it is off,
   turn it on and record that in the result.
5. Open `https://regis.reg.kmitl.ac.th/#/teach_table_selector`. The host page fits the screen
   width with no horizontal scroll.
6. Open the launcher. A tap opens the panel at the phone layout.
7. Search. On the by subject id tab, type an 8 digit code with the on screen keyboard and submit.
   The results list below the folded form.
8. Add a section. Open a course card and tap a section's add button. The add toast shows, and its
   action switches to the timetable pane, where the block is placed.
9. Open a block. A tap on the placed block opens its details as a bottom sheet, which closes from
   its close button.
10. Back gesture. With the panel open, use the system back gesture. The overlay closes, the host
    page stays on its route, and it scrolls again.
11. Export. Reopen the panel, switch to preview, and download the image. Firefox saves the PNG,
    and the Thai text in it renders correctly.
12. Record the phone model, the Android version, the Firefox version, the date and the result of
    each step in the pull request. A failed step blocks the merge.

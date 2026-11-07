# 65. Product name carries KCP

Status: Accepted
Date: 2026-11-07

Amends ADR-0032 (public release identity). The independence notice, the original mark, and
the stable `kmitl-course-planner` identifiers it records are unchanged.

## Context

ADR-0032 named the extension Course Planner for KMITL and kept KCP as an informal short
form. Since the listings went live, students refer to the tool as KCP, and the search they
type is KCP KMITL. Store search and general web search give the item title heavy weight, and
none of the titles contained KCP, so the search students actually run did not lead reliably
to the store listings, the repository, or the landing page at https://kcp.cecs.sh/.

The Chrome Web Store takes the item title and the summary from the manifest `name` and
`description`. The summary is capped at 132 characters. The full description is set in the
store dashboard and is not read from the package.

## Decision

The product display name is KCP: Course Planner for KMITL. The manifest name and the toolbar
title use it, and the debug flavor keeps its (Debug) suffix. The English panel title, the
launcher label, the welcome title, and the export watermark carry the same name. The Thai
panel title keeps its Thai wording behind the same prefix, KCP: ตัววางแผนตารางเรียน สจล., so
the copied text and the poster credit name the product in both locales.

The manifest description is a short English summary of at most 132 characters that names
KCP and KMITL in plain sentences and says what the tool does, with no keyword list. A unit
test holds the limit and the two terms. The README heading, the store listing texts, and the landing page lead with the same
name, so every surface a search can reach shares one title.

## Alternatives considered

A Thai first name, such as a Thai title with KCP as a suffix, was rejected because the store
titles are shared across locales, most search traffic for the tool uses the Latin letters
KCP and KMITL, and a Thai only title would not match that query. The Thai wording stays
where it reads best, in the Thai interface.

Keeping the name Course Planner for KMITL was rejected because the short form students use
would stay absent from every title, and the listings would stay hard to find for the query
KCP KMITL.

## Consequences

The Chrome Web Store and Firefox Add-ons titles change on the next package upload, and the
web search title follows the README and the landing page. The owner checks the Firefox
listing name in the Add-ons developer hub after the upload and edits it there when it does
not follow the manifest.

The trademark posture of ADR-0032 holds. The name still leads with the product, names the
institution only as the context it serves through the phrase for KMITL, and every listing
keeps the notice that the tool is independent and not affiliated with or endorsed by the
institute. KCP is an original short form with no link to any mark of the institute.

Tests and end to end specs that match the visible name change with it. The gecko id, the
package name, and the repository name stay as they are, so signing and release tooling are
unaffected.

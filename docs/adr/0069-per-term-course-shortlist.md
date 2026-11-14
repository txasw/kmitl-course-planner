# 69. Per term course shortlist

Status: Accepted
Date: 2026-11-14

## Context

A student browsing a category result often finds several courses worth a second look before
deciding which to place. The catalog offered no way to mark them: the only durable list was the
plan itself, and adding a course to the plan to remember it puts its section on the grid and
blocks other sections of the same time. The design review adopted the bookmark shortlist from the
mockup and deferred it to a later wave behind its own record, because it adds persisted data.

## Decision

Bookmark toggle on the course card. Each catalog card header carries a bookmark button beside the
disclosure toggle, never inside it, since a button cannot nest a button. Its accessible name
switches between save for later and remove from saved, and it is described by the card title, so a
screen reader hears which course it acts on. The button is a plain toggle, not a drag source: a
press on it never opens the card and never starts the course drag. A saved course shows a filled
bookmark; an unsaved one shows the outline.

Keyed by the browsed term. The shortlist holds subject ids per term, keyed by the semester over the
year of the result being browsed, for example 1/2569. A course offered in two terms is saved in
each separately, because what a student considers for one term says nothing about the next. The
key is the browsed term, not the plan term, so a student can shortlist courses of a term before a
plan for it exists.

Optional preferences field. The shortlist rides the preferences blob under `kcp:prefs` as an
optional `shortlist` field, next to the catalog hide toggles, so no schema version bump is needed
and a blob written before the field existed still validates. A malformed field reads as absent, so
it never costs the language or any other preference. The field is written only while some term
holds a saved course, and a term whose last course is removed drops out of the map. Plans stay in
the plan root; the shortlist is not part of a plan, is not exported with a plan, and is never sent
anywhere.

Saved filter chip. When the current result holds a saved course, or the filter is already on, a
ที่บันทึกไว้ (Saved) chip with the count of saved courses in the result appears beside the sort
control. Pressing it narrows the catalog to the saved courses with every other facet still
applied; it is `aria-pressed` and clearing the filters turns it off. The chip state itself belongs
to the session filter and is not persisted, so the catalog never opens narrowed to a list the
student has forgotten about.

## Alternatives considered

A shortlist inside the plan, as entries with no placement, was rejected: entries carry a section
snapshot and take part in revalidation and conflicts, and a course under consideration has no
chosen section yet. A shortlist keyed by the plan term was rejected because a student browsing a
term with no plan would have nowhere to save. Persisting the saved chip was rejected for the
reason above. A separate storage key was rejected because the preferences key already holds the
other content owned UI preferences, and a second key would need a second hydration path.

## Consequences

The preferences blob grows by one optional map of short strings, bounded in practice by the number
of courses a student saves. Saved subject ids that the current result does not list are kept and
reappear when a later search lists them. Clearing the extension storage clears the shortlist with
the other preferences.

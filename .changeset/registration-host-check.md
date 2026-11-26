---
'kmitl-course-planner': minor
---

When the registration site puts out a new version of its pages, the helper no longer turns Add for me off at once. On the pre registration page KCP reads the site's new app script once, in the background, and compares the parts it relies on, the pre registration page, its buttons, its dialogs, its labels, and the requests it can send, with the versions KCP was tested with. When they are all unchanged, the checklist reads the page and Add for me works as before. When any of them changed, or the check cannot run, Add for me stays off and the checklist keeps your own marks until KCP is reviewed with the new version. Each new version is read once per browser, never checked again, and sends nothing about you.

---
'kmitl-course-planner': minor
---

Make the export template picker the preview itself. The dropdown and the corner size label are gone. The preview pane now renders the selected template poster centered, full height and unclipped, with the previous and next templates as a constant narrow sliver at each edge, dimmed and slightly scaled down as continuation cues. Paging: left and right arrow buttons that disable at the ends, a pointer swipe, the arrow keys, a scroll wheel or trackpad swipe (one notch one page), and a dot radiogroup below for direct jumps with the template names as tooltips and Home and End. A caption carries the localized name with the exact output pixels. Only the selected poster renders eagerly and holds the capture; the slivers render from a deferred copy so a display option change updates the visible poster at once. Paging clamps at the first and last template, and reduced motion keeps the switch instant.

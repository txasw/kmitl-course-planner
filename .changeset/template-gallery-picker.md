---
'kmitl-course-planner': minor
---

Make the export template picker the preview itself. The dropdown and the corner size label are gone. The preview pane now renders the selected template poster centered with the adjacent templates peeking at both edges; a pointer swipe and the arrow keys page between them, a dot radiogroup below allows direct jumps with the template names as tooltips and Home and End for the ends, and a caption carries the localized name with the exact output pixels. Only the selected poster renders eagerly and holds the capture; the neighbors render from a deferred copy so a display option change updates the visible poster at once. Paging clamps at the first and last template, and reduced motion swaps the slide for an instant switch.

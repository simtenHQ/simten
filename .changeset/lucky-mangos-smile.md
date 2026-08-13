---
'@simten/ui': patch
---

Re-apply Monaco IntelliSense when `SimtenCodeEditor`'s `intellisense` prop changes. It was only applied in `beforeMount`, which fires once, so a consumer that varies the available globals at runtime kept the set from first mount until a full page reload.

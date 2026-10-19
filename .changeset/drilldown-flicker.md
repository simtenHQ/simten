---
'@simten/ui': patch
---

Stop the drill-down inspector flickering. Its backdrop, panel and each level now fade in with CSS, which runs once, instead of framer-motion animations that jumped back at the end of each fade; drilling into a nested component flashed twice. Escape now closes the inspector (or steps back a level) wherever focus is; it used to do nothing unless the backdrop happened to have focus.

`@simten/ui` no longer depends on framer-motion; nothing in it uses it any more.

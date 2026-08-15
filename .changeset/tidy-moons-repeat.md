---
'@simten/ui': patch
---

Keep the Monaco model that shadows a planted lib in step with it. `addExtraLib` registers a virtual file, but the first hover or quick fix on a lib makes Monaco materialise it as a model at the same URI, which then shadows the lib for every later update. Consumers that vary the globals at runtime — handing out a different set of components per screen — got the set frozen at whichever one was open when the first hover happened, and any component added afterwards reported "Cannot find name". Writing through the model also revalidates open files, so a stale marker clears immediately rather than on the next keystroke.

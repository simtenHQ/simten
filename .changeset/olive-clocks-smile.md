---
'@simten/ui': patch
---

Give port labels room when `showPortLabels` is on. The labels render inside the node, and on a two-input gate — roughly 88px wide — a symbol plus `a`, `b` and `out` did not fit: the side labels sat against the border and `out` overlapped the gate symbol. Node content now takes wider horizontal padding while labels are shown, and the default spacing is unchanged when they are not.

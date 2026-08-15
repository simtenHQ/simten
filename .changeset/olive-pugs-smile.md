---
'@simten/ui': patch
---

Make port labels legible. `showPortLabels` rendered them at 9px, which is small enough that the name a beginner is hunting for does not register as text. Now 11px, which stays inside the padding the labels already reserve.

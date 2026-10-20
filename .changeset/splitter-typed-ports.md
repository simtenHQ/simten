---
"@simten/core": patch
---

`Splitter({ width })` and `Combiner({ width })` now type exactly the ports their width has. `Splitter({ width: 4 })` autocompletes `bit0` to `bit3`, and `bit4` is a type error. A width that isn't a literal still accepts any `bitN`.

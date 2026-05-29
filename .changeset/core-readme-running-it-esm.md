---
"@simten/core": patch
---

docs(readme): correct the "Running it" instructions — `@simten/core` is ESM-only, consumer must opt into ESM

The previous note claimed `tsx` would skip the need for `"type": "module"`. That's wrong: `@simten/core`'s exports only define the `import` condition, so a default CJS-mode consumer hits `ERR_PACKAGE_PATH_NOT_EXPORTED` on the subpath import (e.g. `@simten/core/circuit`) regardless of whether tsx is doing the transform. Updated the instructions to make the ESM requirement explicit — either add `"type": "module"` to `package.json` or save the file with the `.mts` extension.

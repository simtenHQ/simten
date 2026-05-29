---
"@simten/embed": patch
---

docs(readme): add `@types/react @types/react-dom` to the install line for TypeScript consumers

The install line was correct at runtime but omitted the TS-side dev deps. A TypeScript consumer (the target audience) following the readme verbatim got implicit-any errors on every React-typed prop until they figured out to install the types. Added them explicitly as a dev-deps line right after the main install.

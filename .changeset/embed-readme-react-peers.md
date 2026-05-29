---
"@simten/embed": patch
---

docs(readme): include `react react-dom` in the install command

The install line previously read `npm install @simten/embed @simten/core`, which works under npm 7+ (auto-installs declared peers) but breaks under pnpm with strict-peer-dependencies (the default) and under yarn. React and react-dom are declared peer dependencies; the install line now lists them explicitly, matching `@simten/ui`'s README.

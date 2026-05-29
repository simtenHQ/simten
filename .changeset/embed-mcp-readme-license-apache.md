---
"@simten/embed": patch
"@simten/mcp": patch
---

docs(readme): correct license text — was BUSL 1.1, all machine-readable signals (package.json + LICENSE file) are Apache-2.0

The README License section claimed Business Source License 1.1 while the package's `license` field, shipped LICENSE file, and SPDX identifier are all Apache-2.0. The machine-readable signals are what npmjs.com, license scanners, and Dependabot trust — a court would side with the LICENSE file. Updated the README prose to match: Apache-2.0.

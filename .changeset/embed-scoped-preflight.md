---
'@simten/embed': patch
---

Stop the embed stylesheet restyling the page it is embedded in.

`dist/styles.css` is meant to be dropped into someone else's site with a plain `<link>` tag — that is the point of the `<circuit-embed>` web component. It was built with `@import "tailwindcss"`, which includes Preflight, and Preflight's resets are unscoped. So the shipped stylesheet carried:

```css
h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit }
a { color: inherit; text-decoration: inherit }
```

Embedding a circuit in a blog post therefore flattened every heading on the page and stripped the colour and underline from every link. The damage lands on the host's article rather than on the embed, so it was invisible to anyone testing the embed on its own.

Tailwind's theme and utility layers are now imported directly and Preflight's resets are re-applied scoped to `[data-embed-theme]`, the root element both `CircuitViewer` and the web component render. There is no Shadow DOM to fall back on — ReactFlow needs direct DOM access — so the scoping is what provides the isolation.

Verified in a host page carrying its own `h1` and link styling: both survive untouched, and the embed still renders its nodes and edges with `box-sizing: border-box` intact.

One thing this does not fix: the utility classes are unprefixed, so a host page that also uses Tailwind will define `.flex` and `.absolute` twice. Values normally match, but a different Tailwind version on the host could disagree.

Also in this release: `<circuit-embed>` now renders compile failures through the package's `ErrorDisplay`, which carries `role="alert"` and `aria-live`, rather than a bespoke `div` that announced nothing; and each element compiles into its own sandbox slot instead of the shared default.

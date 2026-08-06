---
'@simten/ui': minor
---

Ship the design tokens the components already depend on, as `@simten/ui/styles/theme.css`.

Every component in this package is written with `bg-card`, `border-border`, `text-muted-foreground` and friends, but nothing in the package defined those custom properties — so a consumer had to reverse-engineer and hand-author the whole palette or the components rendered unstyled. The stylesheet now ships alongside them:

```css
@import "tailwindcss";
@import "@simten/ui/styles/theme.css";
@source "../node_modules/@simten/ui/dist";
```

The `@source` line matters: Tailwind v4 does not scan dependencies, so without it the utility classes the components reference are never emitted and nodes render with no width or padding.

This does not remove the Tailwind requirement — an app without Tailwind still cannot consume these components from source. `@simten/embed` solves that by compiling its CSS at build time and shipping the result; this package should grow the same, and that is tracked separately.

Also adds `@simten/ui/primitives/resizable`, the shadcn wrapper over `react-resizable-panels`, which was previously copy-pasted per app.

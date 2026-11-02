# @simten/web

The site at [simten.dev](https://simten.dev): the circuit editor, the docs, the blog and
the learn pages. It's a TanStack Start app deployed as a Cloudflare Worker.

```bash
pnpm dev           # from the repo root: the site on :3001
pnpm dev:sandbox   # the sandbox on :3002, needed for any circuit to draw
```

`pnpm dev` and `pnpm build` read the root `.env`.

Where things are:

- `src/routes/`: one file per page.
- `src/features/`: the editor (`visual-editor`), docs, blog posts and their demos, learn pages.
- `content/`: the docs and blog text, in MDX. Changes there need `pnpm build` to check.

Tests run with `pnpm test`. Deploy with `pnpm deploy:web` from the root.

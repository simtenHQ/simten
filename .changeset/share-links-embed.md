---
'@simten/ui': minor
'@simten/embed': minor
---

Share links never expire, and Fork creates a share only on simten.dev:

- `@simten/embed`: Fork on simten.dev creates a short `/circuit/s/<hash>` link through the site, as before. Given a `shareId` (`share-id` on `<circuit-embed>`), Fork opens that share. Anywhere else it opens `/circuit/<encoded>` with the source in the URL. Wires show again in `<circuit-embed>` in Chrome: the scoped Preflight no longer caps every `svg` at `max-width: 100%`.
- `@simten/ui/share`: removed `INLINE_URL_THRESHOLD` and `shouldUseShortLink`. Added the KV storage format shared by simten.dev and embed.simten.dev: `ShareKV`, `saveShare`, `loadShare`, `isShareHash`, `validateShareHash`.

---
'@simten/ui': minor
'@simten/embed': minor
---

Share links are always short now, and never expire:

- `@simten/embed`: Fork always creates a short `/circuit/s/<hash>` link. Off simten.dev it calls simten.dev's `POST /api/share` instead of putting the whole compressed source in the URL. `useShareCircuit()` always returns a function. Wires show again in `<circuit-embed>` in Chrome: the scoped Preflight no longer caps every `svg` at `max-width: 100%`.
- `@simten/ui/share`: removed `encodeSourceForUrl`, `INLINE_URL_THRESHOLD` and `shouldUseShortLink`. `decodeSourceFromUrl` stays for links shared before short links. Added the KV storage format shared by simten.dev and embed.simten.dev: `ShareKV`, `saveShare`, `loadShare`, `isShareHash`, `validateShareHash`.

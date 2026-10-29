# @simten/shared

Code that Simten's own apps share: simten.dev, the game and the embed page. It holds the UI primitives, share links and their store, the Fork button and the theme tokens.

It's private and never published. Nothing outside this repo should depend on it.

What goes here:

- Only code that two or more apps use. Code that one app uses lives in that app.
- Nothing that's part of the public API. If people building with Simten need it, it belongs in `@simten/react`.

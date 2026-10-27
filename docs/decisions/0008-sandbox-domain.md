# 0008. A separate domain for the sandbox before accounts

**Status:** Accepted.

## Context

User circuit code runs only in the sandbox: an iframe on `sandbox.simten.dev` that runs the code in a Web Worker. A subdomain is a different origin from `simten.dev`, so the sandbox can't read the main site's pages, `localStorage` or DOM. It is still the same *site*, because both share the registrable domain `simten.dev`. Browsers treat same-site pages as related:

- Cookies set for `.simten.dev` are sent to every subdomain, and a subdomain can set cookies that `simten.dev` will receive.
- `SameSite` cookie protection doesn't apply to requests between subdomains.
- Browsers may run same-site pages in one process.
- Blocklists such as Safe Browsing and school filters act on the whole site, so abuse of the sandbox could get `simten.dev` flagged.

Today `simten.dev` has no accounts and no login cookies, so none of this exposes anything.

## Decision

`simtenusercontent.dev` is reserved for the sandbox. Before Simten adds accounts or any login cookie, the sandbox moves there (for example `sandbox.simtenusercontent.dev`), so untrusted code runs on a different site from the main app. Until then it stays on `sandbox.simten.dev`.

The move is configuration only, because the sandbox is already a separate origin: DNS, the sandbox app's route, the page's sandbox URL, and the `frame-src` entry in the main app's and game's CSP.

Pages that run only Simten's own code, such as a future embed page (#419), may stay on `simten.dev` subdomains, where their URL is visible and recognizable to the people pasting them.

## Rejected

- **Moving now.** Nothing to protect yet, and it adds a domain to every config and local setup.
- **An abbreviation such as `smtn.dev`.** A descriptive name, like `githubusercontent.com` or `googleusercontent.com`, makes it obvious who owns the domain wherever it shows up (devtools, CSP errors, firewall logs).

## What would change it

Accounts, login cookies or any other credential on `simten.dev` trigger the move. A need for the sandbox to share cookies with the main site would be a reason to revisit the sandbox design itself, not this rule.

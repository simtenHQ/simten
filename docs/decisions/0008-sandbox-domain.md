# 0008. The sandbox on its own domain

**Status:** Accepted.

## Context

User circuit code runs only in the sandbox: an iframe that runs the code in a Web Worker. It was served from `sandbox.simten.dev`. A subdomain is a different origin from `simten.dev`, so it can't read the main site's pages, `localStorage` or DOM. It is still the same *site*, because both share the registrable domain `simten.dev`, and browsers treat same-site pages as related:

- Cookies set for `.simten.dev` are sent to every subdomain, and a subdomain can set cookies that `simten.dev` will receive.
- `SameSite` cookie protection doesn't apply to requests between subdomains.
- Browsers may run same-site pages in one process.
- Blocklists such as Safe Browsing and school web filters act on the whole site, so abuse of the sandbox could get `simten.dev` flagged.

## Decision

Serve the sandbox from a separate registrable domain, `sandbox.simtenusercontent.dev`, so untrusted code runs on a different site from the main app. The main app, the game and the embeds built from this repo use it, and their CSP `frame-src` allows only it.

`sandbox.simten.dev` stays as a second route on the same sandbox app for already-published `@simten/embed` versions, which have it built in. Remove it at the next npm release. It must be gone before Simten adds accounts or any login cookie, because while it exists anyone can still run code on a `simten.dev` subdomain.

Pages that run only Simten's own code, such as a future embed page (#419), may stay on `simten.dev` subdomains, where their URL is visible and recognizable to the people pasting it.

## Rejected

- **Waiting until accounts exist.** The blocklist risk applies today, and the embed page and the runtime work (#417, #419) are easier to build against the final address.
- **An abbreviation such as `smtn.dev`.** A descriptive name, like `githubusercontent.com` or `googleusercontent.com`, makes it obvious who owns the domain wherever it shows up (devtools, CSP errors, firewall logs).
- **Switching without keeping the old route.** Breaks any site using a published `@simten/embed` until the next release, for no gain over removing it then.

## What would change it

A need for the sandbox to share cookies or storage with the main site would be a reason to revisit the sandbox design itself, not this rule.

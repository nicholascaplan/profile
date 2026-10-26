# Working in this repo

Guidance for anyone contributing changes, including automated contributors. The requirements are in `docs/project-brief.md` and important decisions are logged in `docs/decisions.md`; this file covers how to work here.

## What the site is

Three-page static site (`index.html`, `experience/`, `contact/`) with shared CSS (`assets/css/site.css`) and vanilla JS (`assets/js/`). No build step and no runtime dependencies - edit files directly and keep it that way unless Nick decides otherwise.

## Running the checks locally

For local development, run `npm run dev` and open http://127.0.0.1:8080.
There is no build step; refresh the browser after editing. `npm start` is an alias.

```
npm ci                 # one-time setup (Playwright only; the unit checks need no dependencies)
npm run test:unit      # fast DOM and content checks: node --test tests/*.test.mjs
npm run test:e2e       # browser checks: npx playwright test
```

- The unit checks are dependency-free; `node --test tests/*.test.mjs` works without `npm ci`.
- Locally the Chromium and mobile-Chrome projects drive the system-installed Chrome, so no browser download is needed for those. Firefox and WebKit need `npx playwright install firefox webkit` first; the full four-browser matrix always runs in CI.
- The Playwright config starts a local static server itself (`scripts/serve-static.mjs`) on a free port; just run the tests.

## How changes ship

1. Work happens on a branch and a pull request. Every push and PR runs `.github/workflows/test.yml`: the unit checks plus the full Playwright matrix (Chromium, Firefox, WebKit, mobile Chrome) in the official Playwright container. All checks must be green before a change is presented as ready.
2. Each PR gets a Netlify deploy preview. Verify the change on the preview - real pages, phone and desktop widths - before calling it ready.
3. Only `main` deploys the live site (`.github/workflows/pages.yml` -> GitHub Pages). After any merge to `main`, check the live site once to confirm the deploy landed as intended.

## Documentation

- `docs/project-brief.md` describes what the site must do. Update it only when the project's direction or requirements change, not for each change.
- `docs/decisions.md` records important decisions and the reason for each, newest first. Add an entry only when a choice would otherwise be questioned or reversed later. Small fixes and implementation details belong in the pull request.

## House rules

- Never remove, skip, or weaken a check to make the suite green. When the DOM or design changes intentionally, update the expectations to assert the new intended state with the same rigour.
- When a check fails, explain the cause and the planned fix before changing code.
- Never merge a pull request without Nick's explicit approval.

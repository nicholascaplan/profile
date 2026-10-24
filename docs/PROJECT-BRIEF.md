# Profile site project brief

Personal profile page for Nick Caplan, live at [nicholascaplan.github.io/profile](https://nicholascaplan.github.io/profile/). Deployed from `main` by GitHub Pages (`.github/workflows/pages.yml`).

## How the site is built

- Single static `index.html`: inline CSS and vanilla JavaScript, no build step and no runtime dependencies.
- Behaviour checks live in `tests/` and run with `node --test` - also dependency-free.

## Decisions

- Light and dark themes; the choice persists in `localStorage` under `nick-theme`.
- The mobile preview toggle in the nav is a development aid, not a visitor feature. It only appears when the site is served locally (`localhost`, `127.0.0.1`, `[::1]`, or a `file://` page). On the deployed site the control is removed and the layout simply follows the viewport width, including on narrow screens; a stored `nick-mobile` choice is only honoured on local hosts (24 October 2026).
- Test coverage extends beyond the preview toggle: theme logic, page content and structure, and real browser behaviour in headless Chrome (still dependency-free). Coverage work lands on a separate branch and pull request so the preview fix stays focused (24 October 2026).
- Known defects, recorded 24 October 2026: at 320px the hero headline text overflows into the portrait (the painted text, not the element box, crosses it); the light theme's muted body text measures about 3.9:1 contrast, below the 4.5:1 guideline. The checks assert the desired state and are reported as expected failures while each defect reproduces, separately from passing checks; they fail loudly if a defect stops reproducing so the record is updated. Neither defect is fixed yet - fixes need a product decision first.

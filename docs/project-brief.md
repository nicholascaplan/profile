# Profile site project brief

Personal profile page for Nick Caplan, live at [nicholascaplan.github.io/profile](https://nicholascaplan.github.io/profile/). Deployed from `main` by GitHub Pages (`.github/workflows/pages.yml`).

## How the site is built

- Single static `index.html`: inline CSS and vanilla JavaScript, no build step and no runtime dependencies.
- Behaviour checks live in `tests/` and run with `node --test` - also dependency-free.

## Decisions

- Light and dark themes; the choice persists in `localStorage` under `nick-theme`.
- The mobile preview toggle in the nav is a development aid, not a visitor feature. It only appears when the site is served locally (`localhost`, `127.0.0.1`, `[::1]`, or a `file://` page). On the deployed site the control is removed and the layout simply follows the viewport width, including on narrow screens; a stored `nick-mobile` choice is only honoured on local hosts (24 October 2026).

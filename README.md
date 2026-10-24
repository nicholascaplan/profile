# Nick Caplan Profile

Personal profile page for Nick Caplan, hosted on GitHub Pages.

Website: [nicholascaplan.github.io/profile](https://nicholascaplan.github.io/profile/)

## Technical Details

- Single-page static site implemented in `index.html`.
- Uses semantic HTML, inline CSS, and vanilla JavaScript with no build step or runtime dependency.
- Loads DM Sans, DM Mono, Fraunces, and Space Grotesk from Google Fonts.
- Includes light and dark themes with the selected theme persisted in `localStorage`.
- Includes a mobile preview mode that can be toggled from the page navigation when running locally; the toggle is hidden on the deployed site, where the mobile layout simply follows the viewport width.
- Responsive CSS adapts the layout for narrow screens and mobile preview mode.
- Behaviour checks run with `node --test` (see `tests/`) - no dependencies. Product and design decisions are recorded in `docs/project-brief.md`.
- GitHub Pages deployment is handled by `.github/workflows/pages.yml` on pushes to `main`.

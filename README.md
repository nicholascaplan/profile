# Websites by Nick Caplan

Personal profile page for Nick Caplan, hosted on GitHub Pages.

Website: [nickcaplan.github.io/websites-by-nick](https://nickcaplan.github.io/websites-by-nick/)

## Technical Details

- Three-page static site: home (`index.html`), `experience/` and `contact/`, each a real URL.
- Uses semantic HTML, shared CSS (`assets/css/site.css`) and vanilla JavaScript (`assets/js/`) with no build step or runtime dependency.
- The home page showcases live websites with screenshot selectors: labelled thumbnails choose the hero-sized screenshot, and on mobile visible arrows and a counter step through the same set. Screenshots are static, optimised WebP files in `assets/images/work/`.
- Self-hosts DM Sans, DM Mono, Fraunces and Space Grotesk as woff2 (latin subsets, `assets/fonts/`, declared in `assets/css/fonts.css`); each family is licensed under the SIL Open Font License 1.1 (texts alongside the font files).
- Includes light and dark themes with the selected theme persisted in `localStorage`.
- Includes a mobile preview mode that can be toggled from the page navigation when running locally; the toggle is hidden on the deployed site, where the mobile layout simply follows the viewport width.
- Responsive CSS adapts the layout for narrow screens and mobile preview mode.
- Behaviour checks run with `node --test` (see `tests/`) - no dependencies. Product and design decisions are recorded in `docs/PROJECT-BRIEF.md`.
- GitHub Pages deployment is handled by `.github/workflows/pages.yml` on pushes to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the checks, how changes ship, and the house rules.


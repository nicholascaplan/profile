# Websites by Nick Caplan

Personal profile page for Nick Caplan, hosted on GitHub Pages.

Website: [nickcaplan.github.io/websites-by-nick](https://nickcaplan.github.io/websites-by-nick/)

## Technical Details

- Three-page static site: home (`index.html`), `experience/` and `contact/`, each a real URL.
- Uses semantic HTML, shared CSS (`assets/css/site.css`) and vanilla JavaScript (`assets/js/`) with no build step or runtime dependency.
- The home page showcases live websites with composed desktop-and-phone overviews. Readable page-selector buttons change each screenshot pair; the live-site links are the primary route for exploring the work. Screenshots are static, optimised WebP files in `assets/images/work/`.
- Self-hosts DM Sans, DM Mono, Fraunces and Space Grotesk as woff2 (latin subsets, `assets/fonts/`, declared in `assets/css/fonts.css`); each family is licensed under the SIL Open Font License 1.1 (texts alongside the font files).
- Includes light and dark themes with the selected theme persisted in `localStorage`.
- Includes a mobile preview mode that can be toggled from the page navigation locally or on Netlify deploy previews. Only an explicit preview choice creates a 430px phone frame; the public site stays fluid, with phone styling at 600px and below and stacked project layouts up to 960px. Without a manual override, previews also follow viewport changes.
- Responsive CSS adapts the layout for narrow screens and mobile preview mode.
- Behaviour checks run with `node --test` (see `tests/`) - no dependencies. Product and design decisions are recorded in `docs/PROJECT-BRIEF.md`.
- GitHub Pages deployment is handled by `.github/workflows/pages.yml` on pushes to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the checks, how changes ship, and the house rules.

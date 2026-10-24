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

- Update (24 October 2026): browser checks standardise on Playwright (Desktop Chromium, Firefox, WebKit and mobile Chrome) on the coverage PR, matching the FOA and Sam repos. Dependency-free was an implementation choice of the first harness, not a repo policy; the `node --test` unit and content checks stay dependency-free. The workflow runs in the official Playwright container with the package version pinned and stays green cold (77s) and warm (under 90s).
- Update (24 October 2026): both defects are fixed on the defect-fix PR. The hero portrait stacks under the headline at 480px and below (the overlap reproduced from 320px to 414px and cleared at 428px); the light-theme muted tokens move from 3.93:1 to 5.36:1. Verified with before/after captures and with both checks asserted in their desired state passing on all four browsers. When that PR merges, the coverage suite's two expected-failure records are removed on merge-up; until then their loud failure is intentional.
- Update (24 October 2026): this PR and the coverage PR both add `.github/workflows/test.yml` with different content; whichever merges second reconciles that file.
- Update (24 October 2026): a third known defect was found and fixed on the defect-fix PR: at 320px the "Explore my work" hero button let its arrow wrap onto a line of its own, away from the word "work". Nick's rule (24 October 2026): a CTA symbol never wraps away from the end of its label - the final word and its symbol form one no-wrap unit. The rule is stored in code (the final word and arrow sit in a no-wrap `cta-end` span, with a comment at the pattern) and recorded here. The coverage suite carries a third expected-failure record for it, which reproduces on all four browsers until the defect-fix PR merges; the earlier entries' count of expected-failure records rises from two to three, all to be removed on that PR's merge-up.

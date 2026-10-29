# Decisions

Important decisions, newest first. This is not a changelog: small fixes and implementation details belong in the pull request. Add an entry only when a choice would otherwise be questioned or reversed later. Requirements are in [PROJECT-BRIEF.md](PROJECT-BRIEF.md).

## 29 October 2026: NC favicon in the atelier colours

Chosen by Nick from labelled visual options. The mark is an NC monogram set in the site's own DM Sans: a terracotta N and cream C on the atelier dark green tile, letters nearly edge to edge so the pair stays readable at tab size. The SVG is built from the font's actual glyph outlines, with an ICO fallback, an apple-touch-icon and a small web manifest. Content tests assert the links and files on every page.

## 26 October 2026: Desktop screenshots sit side by side (in progress)

Chosen by Nick for build; pull request #24, not yet merged when this was written. At desktop widths each project shows the phone capture beside the desktop capture at the same height instead of overlaying it. Phone, tablet and enlarged-text widths keep the overlay.

## 26 October 2026: Experience page focuses on website building

At Nick's request, the pre-NatWest roles foreground website delivery. Oddschecker leads with the high-traffic US website, restoring the 100,000+ monthly visitors and 2 to 23 US states figures from his original CV copy. Moogsoft and Alfa describe their web platforms explicitly. The NatWest Boxed entry is unchanged. Existing facts from his original CV copy were reworded only, with no new projects, responsibilities or results.

## 26 October 2026: Optional analytics follow the FOA consent model

Google Analytics stays off until the visitor chooses Allow, adapted from the consent model used on the FOA site. Allow and Reject carry equal weight. A rejection takes precedence on later visits, including when browser storage is blocked, and is cleared only by a fresh explicit Allow. Withdrawal disables the tag and deletes this site's `_ga` cookies; it does not claim to delete data already collected. Advertising features and personalisation stay denied.

## 25 October 2026: Netlify address redirects to GitHub Pages

The Netlify main address redirects every path to the same path on the GitHub Pages site, instead of serving a second copy of `main`. The redirect is built only for production deploys, so previews are unaffected. It is a temporary (302) redirect so browsers do not cache it permanently and the change stays easy to reverse. GitHub Pages remains the live host and Netlify remains for pull request previews.

## 25 October 2026: Self-hosted fonts

The four font families are self-hosted instead of loaded from Google Fonts, using the same latin woff2 files (SIL OFL 1.1). This removes two cross-origin connections and the render-blocking third-party stylesheet. Appearance was verified unchanged.

## 25 October 2026: Theme set before first paint, dark by default

One small inline script per page, identical on every page, sets the theme before first paint, so the first paint is already correct and the light-to-dark flash is gone. This is the single exception to the no-inline-scripts rule; a content test asserts exactly one per page. Dark is the default for new visitors and a saved choice wins.

## 25 October 2026: Screenshots are teasers

Project screenshots are paired, theme-matched, static captures with one set of keyboard-operable page buttons. No lightbox or zoom, no tiny thumbnails and no duplicate arrow or counter controls. The live site is the way to explore a project.

## 25 October 2026: Full-width public site, phone frame for development only

Public pages use the available width and follow the viewport. The fixed 430px phone frame exists only as an explicit local or preview choice, and production ignores any stored choice.

## 24 October 2026: Portfolio first, three real pages

The site moves from a CV to a portfolio of Nick's website-building work: websites lead on the home page, the CV content moves to an Experience page as supporting credibility, and Contact becomes its own page ("Have a website in mind?"). Navigation is visible at every size with no menu button.

## 24 October 2026: Call-to-action symbols never wrap away from their label

Nick's rule: a CTA arrow or icon never wraps away from the end of its label. The final word and its symbol form one no-wrap unit (`cta-end`), covered by tests at 320px and with enlarged text.

## 24 October 2026: Playwright for browser checks

Browser checks run on Playwright (Chromium, Firefox, WebKit and mobile Chrome) in the official Playwright container, matching the FOA and Samantha Fernando repositories. Unit and content checks stay dependency-free. Checks assert the intended state and are never removed or weakened to make the suite pass.

# Decisions

Important decisions and the reasons for them, newest first. This is not a changelog: small fixes and implementation details belong in the pull request. Add an entry only when a choice would otherwise be questioned or reversed later. Requirements are in [project-brief.md](project-brief.md).

Entry format: date, decision, reason, and what it rules out.

## 26 October 2026: Experience page focuses on website building

At Nick's request, the pre-NatWest roles foreground website delivery. Oddschecker leads with the high-traffic US website, restoring the 100,000+ monthly visitors and 2 to 23 US states figures from his original CV copy. Moogsoft and Alfa describe their web platforms explicitly. The NatWest Boxed entry is unchanged.

Reason: the site exists to win website work, so the supporting experience should show website delivery. Existing facts from his original CV copy were reworded only, with no new projects, responsibilities or results.

## 26 October 2026: Optional analytics

Optional Google Analytics follows the consent model used on the FOA site, adapted to this static site. Allow and Reject carry equal weight. Rejection always takes precedence on later visits, including when browser storage is blocked, and is cleared only by a fresh explicit Allow. Withdrawal disables the tag, deletes this site's `_ga` cookies and does not claim to delete data already collected. Advertising features and personalisation stay denied. Consent is stored under `websites-by-nick-cookie-preferences`.

Reason: visitors must be able to refuse and withdraw reliably, and the privacy page must describe real behaviour.

## 26 October 2026: Portrait

The smiling, centred burgundy-shirt portrait was selected after comparing shirt colours in both themes. It stays a circular CSS crop at 600px square to limit page weight.

## 26 October 2026: Screenshot page selector style

Quiet text labels on one baseline with a terracotta underline on the selected view (option B, chosen from alternatives), rather than boxed buttons. Page navigation chips and live-site calls to action are unchanged because they sit higher in the action hierarchy.

## 25 October 2026: Screenshots are teasers

Project screenshots are paired, theme-matched, static captures with one set of readable page buttons. No lightbox, zoom, tiny thumbnails or duplicate arrow and counter controls. The live site is the way to explore a project.

Reason: miniature interactive sites on a phone are hard to use and add weight.

## 25 October 2026: Redirect the Netlify address to GitHub Pages

The Netlify main address redirects every path to the same path on the GitHub Pages site, using a temporary (302) redirect built only for production deploys. Previews are unaffected. GitHub Pages remains the live host.

Reason: avoids a second live copy of the site. A 302 keeps the change easy to reverse.

## 25 October 2026: Self-host fonts and shrink the portrait

The four font families are self-hosted (latin subsets, SIL OFL 1.1) instead of loaded from Google Fonts. Appearance was verified unchanged.

Reason: fewer cross-origin connections, no render-blocking third-party stylesheet.

## 25 October 2026: Theme set before first paint, dark by default

One tiny inline script per page, identical on every page, sets the theme before first paint. This is the only exception to the no-inline-scripts rule, and a content test enforces exactly one per page. Dark is the default for new visitors; a saved choice wins.

Reason: removes the light-to-dark flash on load.

## 25 October 2026: Full-width layout with a development-only phone frame

Public pages use the available width. The fixed 430px phone frame is an explicit local and preview choice only, and production ignores any stored choice. Phone styling starts at 600px and project sections stack at 960px and below.

Reason: visitors on real phones and tablets should never see a framed layout.

## 24 October 2026: Portfolio first, three real pages

The site moves from a CV to a portfolio: websites lead on the home page, the CV content moves to an Experience page, and Contact becomes its own page ("Have a website in mind?"). Navigation is visible at every size with no menu button.

Reason: the site exists to win website work, not to present a CV.

## 24 October 2026: Call-to-action symbols never wrap away from their label

The final word and its arrow or icon form one no-wrap unit, in code (`cta-end`) and tested at 320px and with enlarged text.

Reason: a stranded arrow or icon on its own line looks broken.

## 24 October 2026: Playwright for browser checks

Browser tests run on Playwright across Chromium, Firefox, WebKit and mobile Chrome in the official Playwright container, matching the FOA and Samantha Fernando repositories. Unit and content checks stay dependency-free. Checks assert the intended state; never remove or weaken a check to make the suite pass.

## 24 October 2026: Mobile preview toggle is a development aid

The toggle appears only on local hosts and Netlify previews. The deployed site follows the viewport.

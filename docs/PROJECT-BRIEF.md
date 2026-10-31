# Project brief

What this site is and what it must do. This document describes requirements. It changes only when the project's direction changes. Individual design and engineering decisions, and the reasons for them, are in [decisions.md](decisions.md). Working rules for contributors are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Purpose

Websites by Nick Caplan (websitesbynick.co.uk) shows Nick's website-building work and makes it easy for a small business or organisation to get in touch. Websites come first. His wider engineering experience is supporting evidence of credibility, not the main offer.

## Audience

Prospective clients who want a modern, responsive website designed, built and maintained for them. Most arrive on a phone, so the mobile experience matters as much as desktop.

## Pages

- **Home**: leads with the websites Nick has built. Each project shows what it is, Nick's role and a link to the live site.
- **Experience**: Nick's background, written in terms of what it means for a client. Earlier roles are presented around the website building they involved. Use only facts Nick has approved and never invent projects, responsibilities or results.
- **Pricing**: guide prices for the three kinds of website project (starter, content & growth, bespoke engineering), what each includes and how a project starts. Prices are starting points; every project is quoted individually before the visitor commits.
- **Contact**: a short enquiry form ("Have a website in mind?"), sent through Formspree.
- **Privacy & cookies**: describes what the site actually does.

Every page has the same navigation, visible at all screen sizes, and the same footer with a single closing contact call to action.

## Content requirements

- Describe roles and work plainly. Do not invent project outcomes, target markets, results or delivery promises.
- Do not promise a response time unless Nick confirms one.
- Use British English.
- Project examples use composed desktop and phone screenshots that follow the page theme. They are visual teasers; the live site is how a visitor explores a project.
- Only the finished portrait belongs in the repository, not source photographs.

## Design requirements

- Forest green and terracotta identity, with light and dark themes. Dark is the default for new visitors, and a visitor's saved choice always wins. The page is correct on first paint, with no flash of the wrong theme.
- Responsive at every width from 320px up, with phone styling on small screens and stacked project sections below desktop widths. The public site follows the viewport. A fixed phone frame exists only as a development aid on local and preview hosts.
- Readable and usable: text contrast meets WCAG AA in both themes, body and form text is at least 16px on phones, and touch targets are at least 44px.
- Everything works with enlarged text and at 320px with no clipping, overlap or sideways scrolling.
- Interactive controls are keyboard operable with visible focus and correct accessible names.
- A call-to-action's arrow or icon never wraps away from the end of its label.

## Performance requirements

- Pages load quickly on a throttled mobile connection. Fonts are self-hosted, images are optimised and sized for where they appear, and there is no render-blocking third-party code.
- Optimisation must not visibly reduce image sharpness.
- Project screenshots are delivered responsively. Initial screenshots are created from inert templates once the saved theme is known, so a light-theme visit never downloads the dark set first. Homepage screenshot and portrait candidates let the browser choose detail for the viewport and pixel density, with the original full-size captures as the upper-resolution fallback and as the non-home tab captures; noscript keeps complete static dark captures. The first Friends of Ashley desktop capture stays eager and high priority because it can be the mobile largest-contentful-paint element. Retina sharpness, no-JS content, theme first paint and consent are never traded for a performance score.
- Both selected screenshot candidates load and decode before a tab or theme swap commits, preserving the atomic pair and latest-selection behaviour. If a replacement cannot load or decode, the existing working pair and its selected label stay; a later choice or retry must still work.

## Privacy and analytics

- Google Analytics for this site is off until the visitor chooses Allow. Rejecting is remembered, Allow and Reject carry equal weight, and consent can be withdrawn from the privacy page at any time.
- Analytics use this site's own measurement ID. They never run on local or preview hosts, and never collect form contents or personal information.
- The privacy page describes real behaviour, including Formspree, and makes no invented retention promises.

## Technical constraints

- Static site: plain HTML, shared CSS and vanilla JavaScript. No build step and no runtime dependencies unless Nick decides otherwise.
- Hosted on GitHub Pages, deployed from `main`. Netlify is used only for pull request previews.
- `main` is protected. Changes go through a pull request with passing checks (unit tests and browser tests on Chromium, Firefox, WebKit and mobile Chrome) and a verified preview.

## Out of scope

Lightbox or zoom controls on screenshots, and visitor-facing preview toggles.

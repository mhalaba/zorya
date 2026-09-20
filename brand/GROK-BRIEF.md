# Build brief for the bot — zorya.website and the Zorya app

You are building the public website at **zorya.website** and the **Zorya** web app (PWA) from this package. Read this file, then `README.md`, then the files in the order listed in section 2. Everything you need is here; do not invent colours, fonts, copy or components that the package does not define. Documentation is in English; **all user-facing text is Polish** and comes from `04-ux/ui-strings.pl.json` and `04-ux/site-copy.pl.md` verbatim.

## 1. Non-negotiables

1. **Tokens only.** Every colour, size, font and spacing comes from `02-tokens/tokens.css` (`--z-*` variables) or `02-tokens/tailwind.tokens.js`. No hex values in components. Use the *semantic* colours (`--z-bg`, `--z-text`, `--z-status-alarm` …), never the core names, so both themes work.
2. **Two themes**: `noc` (default) and `dzien`, switched with `data-theme` on `<html>`; `prefers-color-scheme` is respected when the user has not chosen. Test every screen in both.
3. **Square corners, no shadows, no gradients, no glow, no blur, no emoji.** Elevation is a 1 px border on `--z-bg-raised`.
4. **Fonts**: self-host Atkinson Hyperlegible Next and Mono from `05-fonts/` (both `latin` and `latin-ext` subsets — Polish glyphs live in `latin-ext`). No Google Fonts link, no Inter, no Roboto, no system font except as fallback.
5. **The mark and lockups are SVG files from `03-logo/`.** Never redraw or retype the logo. The only live-typed wordmark is ZORYA in the app header (18 px, weight 800, +0.08 em, uppercase). The status glyphs are `03-logo/level-*.svg` with `currentColor`.
6. **A level is word + shape + colour**, never colour alone. Confidence is a rule style + word, never colour. See `01-brand/brand-book.md` §5.
7. **Copy is verbatim** from the JSON/MD files. No exclamation marks anywhere. If you need a string that does not exist, add it to `ui-strings.pl.json` in the same voice (`01-brand/voice-and-copy.md`) and flag it in your summary.
8. **Privacy**: no third-party scripts, no analytics, no cookies, no external fonts or CDNs on the website; the CSP in `06-web/head-snippet.html` must pass.
9. **Accessibility**: WCAG AA as computed in `02-tokens/contrast.json`; focus rings never removed; live regions and labels as in `04-ux/ux-spec.md` §7; `prefers-reduced-motion` turns the alarm star's breathing off.
10. **Alarm is different**: inverted card, "Co robić teraz" button, notification with sound regardless of quiet hours. Do not soften it and do not apply its treatment to any other level.

## 2. Read in this order

1. `README.md` — the map of the package.
2. `01-brand/brand-book.md` — identity, mark, colour, levels, type, layout, motion, icons.
3. `01-brand/voice-and-copy.md` — how the app talks; alert line and push templates.
4. `02-tokens/tokens.json` (+ `tokens.css`, `tailwind.tokens.js`) — the values.
5. `04-ux/ux-spec.md` — principles, IA, the level algorithm, every screen, states, notifications, accessibility.
6. `04-ux/components.md` — component anatomy and tokens.
7. `04-ux/flows.md` — first run, alarm lifecycle, reports, offline.
8. `04-ux/content-model.json` — data shapes and suggested endpoints; `04-ux/sample-data/*.json` — realistic fixtures (fictional places).
9. `04-ux/ui-strings.pl.json`, `04-ux/site-copy.pl.md` — all Polish text.
10. `04-ux/screens/*.html` and `screens/png/` — reference renders. Match them; where the spec and a mockup disagree, the spec wins.
11. `06-web/` — manifest and `<head>` snippet.

## 3. Deliverables, in order

1. **Website** (`www-01-landing.html` as the reference): one page with six sections, the three linked pages (Jak działa, Prywatność, Status), the `<head>` from `06-web/head-snippet.html`, the manifest, icons from `03-logo/`, fonts from `05-fonts/`, `tokens.css` included as-is. The hero panel and the footer read `GET /status` with `sample-data/status.json` as the fallback, labelled *przykład* when sample.
2. **App shell**: bottom navigation (Horyzont · Mapa · Sygnały · Zgłoś · Więcej), header with the live horizon rule, theme switching, service worker caching the shell, fonts and the last state.
3. **Screens**: Horyzont (all five levels, empty, stale, offline), Zdarzenie, Mapa (with legend and sheet), Sygnały (+ source page), Zgłoś (+ sent/withdraw states), Ustawienia, first run (3 steps).
4. **Notifications**: channels and templates as specified; one notification per event, updated in place.
5. **A fixture mode** that renders the app from `sample-data/` so screens can be reviewed without the backend.

## 4. Definition of done (check every item)

- [ ] Both themes render every screen; no hard-coded colours (`grep -rn "#[0-9A-Fa-f]\{3,6\}"` in components returns nothing outside `tokens.css`).
- [ ] Every screen matches its mockup in structure and order; the status block is always first under the header.
- [ ] Polish strings render with diacritics in the shipped font (check ą ę ł ś ź ż on every screen).
- [ ] Level cards carry glyph + word + colour; alarm inverts; confidence rules render as solid/dashed/dotted.
- [ ] Keyboard: every interactive element reachable, visible focus ring, bottom nav has `aria-current`.
- [ ] Reduced motion: nothing animates.
- [ ] Text scales to 200 % without horizontal scroll.
- [ ] Lighthouse: accessibility ≥ 95, best practices ≥ 95, no third-party requests.
- [ ] Offline: the app opens to the last known state with its timestamp.
- [ ] Alarm notification plays sound with quiet hours enabled.
- [ ] `og-image`, favicons and the manifest are wired and validate.

## 5. If something is missing

The package does not define: backend implementation, the map tile source, the exact TERYT dataset, legal texts. Use `content-model.json` for shapes, keep the map on the app's tokens (land = page ground), and put placeholders in square brackets in Polish (`[adres e-mail]`) where a real value is needed. List every placeholder and every added string in your final summary.

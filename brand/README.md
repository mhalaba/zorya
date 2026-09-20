# Zorya — brand and UX package

Visual identity, design tokens, logo files, fonts, UX specification, Polish UI copy and data shapes for **zorya.website** and the Zorya app (signal-fusion warning for Polish communes). Version 1.0, September 2026. Built to be handed to a person or a bot that will build the site and the app: start with `GROK-BRIEF.md`.

## What is where

```
GROK-BRIEF.md               build instructions and definition of done for the bot
README.md                   this file
01-brand/
  brand-book.md             the identity: idea, name, mark, colour, the five levels, type, layout, motion, icons, co-branding
  voice-and-copy.md         voice rules, the alert line, push templates, states, vocabulary
02-tokens/
  tokens.json               the source of truth (colours in two themes, type, space, sizes, radius, borders, motion, levels, confidence)
  tokens.css                CSS custom properties (--z-*), @font-face, type classes (.z-*), both themes — generated
  tailwind.tokens.js        Tailwind theme extension — generated
  contrast.json             every text/ground pair computed (WCAG 2.1), 0 fails — generated
  zorya.gpl                 GIMP / Inkscape palette — generated
03-logo/
  zorya-mark-{night,day,mono}.svg          the mark (star over horizon) with its clear space
  zorya-wordmark-*.svg                      ZORYA in curves
  zorya-lockup-h-*.svg, -h-tagline-*.svg    horizontal lockups (primary)
  zorya-lockup-v-*.svg                      vertical lockups
  level-{cisza,obserwacja,ostrzezenie,alarm,odwolanie}.svg   status glyphs, currentColor
  app-icon.svg, app-icon-{1024,512,192,180}.png, app-icon-maskable-512.png
  favicon.svg, favicon-{32,16}.png, avatar-1000.png, og-image-1200x630.{svg,png}
  logo-sheet.png            contact sheet; logo-manifest.json — the geometry and file list
04-ux/
  ux-spec.md                principles, IA, the level algorithm, screens, states, notifications, accessibility, offline, privacy
  components.md             component anatomy with tokens
  flows.md                  first run, alarm lifecycle, reports, area switch, source down, offline
  content-model.json        JSON Schema of Event, Signal, Source, Area, Report, AreaStatus, Settings + suggested endpoints
  ui-strings.pl.json        every UI string, Polish
  site-copy.pl.md           landing page copy and meta, Polish
  sample-data/              areas, sources, signals, events, status — fictional places, realistic shapes
  screens/                  HTML mockups (open in a browser) and screens/png/ renders at 2×
05-fonts/                   Atkinson Hyperlegible Next + Mono, variable, woff2 (latin + latin-ext), OFL.txt
06-web/                     manifest.webmanifest, head-snippet.html (meta, icons, preload, CSP suggestion)
tools/                      build-tokens.py, build-logo.py, build-screens.py, render-screens.js — regenerate everything from tokens.json and the numbers in build-logo.py
```

## The identity in five lines

- A **star over a horizon**: the Zorya of Slavic myth is the morning star that keeps watch before dawn. The horizon is the line between what is confirmed and what is still a signal.
- **Night first.** Dark ground #0E1219, ivory text, one accent — dawn gold #F2B544 — spent only on the star, link underlines and focus. A light *dzień* theme with the same structure.
- **Five levels, one graphic system**: the mark reshapes itself — hollow star (cisza), filled star (obserwacja), double horizon (ostrzeżenie), inverted card (alarm), calm blue (odwołanie). Word, then shape, then colour.
- **One face**: Atkinson Hyperlegible Next, designed for low vision, with its Mono for times and numbers. Square corners, no shadows, no gradients, no emoji, no exclamation marks.
- **Voice**: short, exact, second person, says what it does not know.

## How to regenerate

```
pip install fonttools brotli cairosvg
python3 tools/build-tokens.py     # tokens.css, tailwind.tokens.js, zorya.gpl, contrast.json
python3 tools/build-logo.py       # every file in 03-logo/
python3 tools/build-screens.py    # the HTML mockups
node tools/render-screens.js      # the PNG renders (needs playwright)
```

Change `02-tokens/tokens.json` or the numbers at the top of `tools/build-logo.py`; never edit a generated file by hand.

## Licences

Fonts: Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, SIL Open Font License 1.1 (`05-fonts/OFL.txt`). The Zorya mark, wordmark and name: all rights reserved by the project's author. Sample data is fictional. This package contains no third-party images.

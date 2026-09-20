#!/usr/bin/env python3
"""build-tokens.py — generates tokens.css, tailwind.tokens.js, zorya.gpl and contrast.json from tokens.json.
Run from the package root: python3 tools/build-tokens.py"""
import json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = json.load(open(os.path.join(ROOT, '02-tokens/tokens.json')))
core = t['color']['core']; sem = t['color']['semantic']
def resolve(v):
    m = re.match(r'^\{color\.core\.([a-z0-9-]+)\}$', str(v))
    return core[m.group(1)]['value'] if m else v
LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
faces = [('Atkinson Hyperlegible Next', '../05-fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2', 'normal', LATIN),
         ('Atkinson Hyperlegible Next', '../05-fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2', 'normal', LATIN_EXT),
         ('Atkinson Hyperlegible Next', '../05-fonts/atkinson-hyperlegible-next-latin-wght-italic.woff2', 'italic', LATIN),
         ('Atkinson Hyperlegible Next', '../05-fonts/atkinson-hyperlegible-next-latin-ext-wght-italic.woff2', 'italic', LATIN_EXT),
         ('Atkinson Hyperlegible Mono', '../05-fonts/atkinson-hyperlegible-mono-latin-wght-normal.woff2', 'normal', LATIN),
         ('Atkinson Hyperlegible Mono', '../05-fonts/atkinson-hyperlegible-mono-latin-ext-wght-normal.woff2', 'normal', LATIN_EXT)]
L = ['/* Zorya — design tokens. Generated from tokens.json by tools/build-tokens.py; edit tokens.json, not this file. */',
     '/* Fonts: Atkinson Hyperlegible Next + Mono, SIL OFL 1.1, variable weight 200–800. Both subsets are needed: latin-ext carries the Polish glyphs. Adjust the font paths to where you serve them. */']
for fam, f, st, ur in faces:
    L.append(f'@font-face {{ font-family: "{fam}"; font-style: {st}; font-weight: 200 800; font-display: swap; src: url("{f}") format("woff2-variations"); unicode-range: {ur}; }}')
L += ['', ':root {']
for k, v in core.items(): L.append(f'  --z-{k}: {v["value"]};')
L.append('')
L.append(f'  --z-font-ui: {t["font"]["family"]["ui"]["value"]};')
L.append(f'  --z-font-mono: {t["font"]["family"]["mono"]["value"]};')
for k, v in t['space'].items(): L.append(f'  --z-space-{k}: {v};')
for k, v in t['size'].items(): L.append(f'  --z-size-{k}: {v["value"]};')
for k, v in t['radius'].items(): L.append(f'  --z-radius-{k}: {v["value"]};')
for k, v in t['border'].items(): L.append(f'  --z-border-{k}: {v["value"]};')
for k, v in t['motion'].items(): L.append(f'  --z-{k}: {v["value"]};')
L += ['  --z-shadow: none;', '}']
def theme_block(sel, theme, scheme):
    out = [f'{sel} {{', f'  color-scheme: {scheme};']
    for k, v in sem.items():
        if k.startswith('$'): continue
        out.append(f'  --z-{k}: {resolve(v[theme])};')
    out.append('}')
    return out
L += theme_block(':root, [data-theme="noc"]', 'noc', 'dark')
L += theme_block('[data-theme="dzien"]', 'dzien', 'light')
L.append('@media (prefers-color-scheme: light) {')
L += ['  ' + x for x in theme_block(':root:not([data-theme="noc"]):not([data-theme="dzien"])', 'dzien', 'light')]
L.append('}')
L += ['', '/* Type styles */']
for k, v in t['font']['style'].items():
    fam = 'var(--z-font-mono)' if v.get('family') == 'mono' else 'var(--z-font-ui)'
    extra = ' text-transform: uppercase;' if k in ('label', 'wordmark') else ''
    L.append(f'.z-{k} {{ font-family: {fam}; font-size: {v["size"]}; line-height: {v["line"]}; font-weight: {v["weight"]}; letter-spacing: {v["tracking"]};{extra} }}')
L.append('@media (min-width: 900px) { .z-display { font-size: 56px; line-height: 60px; } }')
L += ['', '/* Base */',
      'html { background: var(--z-bg); color: var(--z-text); font-family: var(--z-font-ui); font-size: 17px; line-height: 26px; -webkit-font-smoothing: antialiased; }',
      'body { margin: 0; }',
      'a { color: var(--z-link); text-decoration: underline; text-decoration-color: var(--z-link-underline); text-decoration-thickness: 1px; text-underline-offset: 0.16em; }',
      ':focus-visible { outline: var(--z-border-focus) solid var(--z-focus); outline-offset: 2px; }',
      '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }']
open(os.path.join(ROOT, '02-tokens/tokens.css'), 'w').write('\n'.join(L) + '\n')
# Tailwind
tw = {'theme': {'extend': {
    'colors': {}, 
    'fontFamily': {'ui': ['Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', 'system-ui', 'sans-serif'], 'mono': ['Atkinson Hyperlegible Mono', 'ui-monospace', 'Menlo', 'monospace']},
    'spacing': dict(t['space']), 'borderRadius': {'none': '0', 'full': '9999px', 'DEFAULT': '0'}, 'boxShadow': {'none': 'none', 'DEFAULT': 'none'},
    'fontSize': {k: [v['size'], {'lineHeight': v['line'], 'fontWeight': str(v['weight']), 'letterSpacing': v['tracking']}] for k, v in t['font']['style'].items() if k != 'wordmark'},
    'maxWidth': {'app': '40rem', 'site': '72rem', 'measure': '64ch'}}}}
for k, v in core.items(): tw['theme']['extend']['colors'][k] = v['value']
for k in sem:
    if k.startswith('$') or k.startswith('map-area'): continue
    tw['theme']['extend']['colors'][k] = f'var(--z-{k})'
open(os.path.join(ROOT, '02-tokens/tailwind.tokens.js'), 'w').write('/* Zorya — Tailwind theme extension, generated from tokens.json. Semantic colours are CSS variables from tokens.css, so they follow data-theme. */\nmodule.exports = ' + json.dumps(tw, indent=2) + ';\n')
# GIMP palette
g = ['GIMP Palette', 'Name: Zorya', 'Columns: 4', '#']
for k, v in core.items():
    h = v['value'].lstrip('#'); r, gg, b = [int(h[i:i+2], 16) for i in (0, 2, 4)]
    g.append(f'{r:3d} {gg:3d} {b:3d}\t{k}')
open(os.path.join(ROOT, '02-tokens/zorya.gpl'), 'w').write('\n'.join(g) + '\n')
# contrast
def lum(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i+2], 16) / 255
        out.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]
def cr(a, b):
    x, y = lum(a), lum(b)
    if x < y: x, y = y, x
    return round((x + 0.05) / (y + 0.05), 2)
pairs = []
for theme in ['noc', 'dzien']:
    for gnd in ['bg', 'bg-raised']:
        for tx in ['text', 'text-2', 'link', 'status-cisza', 'status-obserwacja', 'status-ostrzezenie', 'status-alarm', 'status-odwolanie']:
            r = cr(resolve(sem[tx][theme]), resolve(sem[gnd][theme])); pairs.append({'theme': theme, 'text': tx, 'ground': gnd, 'ratio': r, 'aa': r >= 4.5, 'aaa': r >= 7})
    for fill in ['fill-obserwacja', 'fill-ostrzezenie', 'fill-alarm', 'fill-odwolanie']:
        r = cr(resolve(sem['on-status'][theme]), resolve(sem[fill][theme])); pairs.append({'theme': theme, 'text': 'on-status', 'ground': fill, 'ratio': r, 'aa': r >= 4.5, 'aaa': r >= 7})
        r = cr(resolve(sem[fill][theme]), resolve(sem['bg'][theme])); pairs.append({'theme': theme, 'text': fill, 'ground': 'bg', 'ratio': r, 'graphic-3-1': r >= 3})
    for ln in ['line-strong', 'focus']:
        for gnd in ['bg', 'bg-raised']:
            r = cr(resolve(sem[ln][theme]), resolve(sem[gnd][theme])); pairs.append({'theme': theme, 'text': ln, 'ground': gnd, 'ratio': r, 'graphic-3-1': r >= 3})
fails = [p for p in pairs if ('aa' in p and not p['aa']) or ('graphic-3-1' in p and not p['graphic-3-1'])]
json.dump({'method': 'WCAG 2.1 relative luminance, computed by tools/build-tokens.py', 'pairs': pairs, 'fails': fails}, open(os.path.join(ROOT, '02-tokens/contrast.json'), 'w'), indent=1)
print('tokens built:', len(pairs), 'pairs checked,', len(fails), 'fails', fails)

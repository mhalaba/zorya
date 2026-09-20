#!/usr/bin/env python3
"""build-logo.py — generates every Zorya logo file from one set of numbers.
Mark: a star (circle) over a horizon (rule). u = 20 SVG units.
  horizon: 8u long, 0.5u thick, its bottom edge is the wordmark baseline
  star:    diameter 2u, centred at x = 6u (east), 1u above the horizon
  clear space: 1u on every side of the mark's box
Wordmark: ZORYA, Atkinson Hyperlegible Next wght 800, tracking +80/1000, cap height = mark height (3.5u).
Descriptor: "czuwanie świtu", Atkinson Hyperlegible Mono wght 500, 0.36 × cap, tracking +40/1000.
Run from the package root: python3 tools/build-logo.py  (needs fontTools, brotli, cairosvg)"""
import os, json, io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform
import cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, '05-fonts')
OUT = os.path.join(ROOT, '03-logo')
os.makedirs(OUT, exist_ok=True)
T = json.load(open(os.path.join(ROOT, '02-tokens/tokens.json')))['color']['core']
C = {k: v['value'] for k, v in T.items()}

U = 20.0
RULE_L, RULE_T = 8 * U, 0.5 * U
STAR_R, STAR_CX = 1 * U, 6 * U
GAP = 1 * U
MARK_W, MARK_H = RULE_L, 2 * STAR_R + GAP + RULE_T   # 160 × 70
CAP = MARK_H                                          # wordmark cap height = mark height
TRACK_WM, TRACK_DESC = 80, 40
DESC_SIZE = 0.36
NAME, DESC = 'ZORYA', 'czuwanie świtu'

_cache = {}
def font(family, weight):
    key = (family, weight)
    if key not in _cache:
        fonts = []
        for subset in ('latin', 'latin-ext'):
            f = TTFont(os.path.join(FONTS, f'atkinson-hyperlegible-{family}-{subset}-wght-normal.woff2'))
            f = instancer.instantiateVariableFont(f, {'wght': weight})
            fonts.append((f, f.getGlyphSet(), f.getBestCmap(), f['hmtx']))
        _cache[key] = fonts
    return _cache[key]

def text_path(family, weight, text, cap_px, tracking):
    """Returns (d, width) for text converted to curves, scaled so the cap height is cap_px, y up → y down handled by caller."""
    fonts = font(family, weight)
    upm = fonts[0][0]['head'].unitsPerEm
    capH = fonts[0][0]['OS/2'].sCapHeight
    scale = cap_px / capH
    cmds = []
    x = 0.0
    for ch in text:
        for f, gs, cmap, hmtx in fonts:
            g = cmap.get(ord(ch))
            if g is None: continue
            pen = SVGPathPen(gs)   # the glyph set is needed for composite glyphs (ś, ó)
            gs[g].draw(TransformPen(pen, Transform(scale, 0, 0, -scale, x * scale, 0)))
            c = pen.getCommands()
            if c: cmds.append(c)
            x += hmtx[g][0] + tracking * upm / 1000
            break
        else:
            raise SystemExit(f'glyph missing: {ch!r}')
    x -= tracking * upm / 1000
    return ' '.join(cmds), x * scale

def mark_body(ink, star, dx=0, dy=0, level='obserwacja'):
    """The mark at (dx, dy). level: cisza → hollow star; ostrzezenie/alarm → double horizon."""
    parts = []
    cy = dy + STAR_R
    if level == 'cisza':
        parts.append(f'<circle cx="{dx + STAR_CX:.2f}" cy="{cy:.2f}" r="{STAR_R - 0.15 * U:.2f}" fill="none" stroke="{star}" stroke-width="{0.3 * U:.2f}"/>')
    else:
        parts.append(f'<circle cx="{dx + STAR_CX:.2f}" cy="{cy:.2f}" r="{STAR_R:.2f}" fill="{star}"/>')
    y = dy + 2 * STAR_R + GAP
    if level in ('ostrzezenie', 'alarm'):
        t = RULE_T / 2
        parts.append(f'<rect x="{dx:.2f}" y="{y - t - 0.25 * U:.2f}" width="{RULE_L:.2f}" height="{t:.2f}" fill="{ink}"/>')
        parts.append(f'<rect x="{dx:.2f}" y="{y + RULE_T - t:.2f}" width="{RULE_L:.2f}" height="{t:.2f}" fill="{ink}"/>')
    else:
        parts.append(f'<rect x="{dx:.2f}" y="{y:.2f}" width="{RULE_L:.2f}" height="{RULE_T:.2f}" fill="{ink}"/>')
    return '\n  '.join(parts)

def svg(w, h, body, title='Zorya', bg=None, extra=''):
    bgr = f'<rect width="{w:.2f}" height="{h:.2f}" fill="{bg}"/>\n  ' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.0f}" height="{h:.0f}" role="img" lang="pl" aria-label="{title}"{extra}>\n'
            f'  <title>{title}</title>\n  {bgr}{body}\n</svg>\n')

VARIANTS = {
    'night': dict(ink=C['ivory'], star=C['dawn'], text=C['ivory'], desc=C['ash'], bg=C['night']),
    'day':   dict(ink=C['night'], star=C['dawn-deep'], text=C['night'], desc=C['slate'], bg=C['fog']),
    'mono':  dict(ink='currentColor', star='currentColor', text='currentColor', desc='currentColor', bg=None),
}

def write(name, content):
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(content)

def png(svg_text, name, width):
    cairosvg.svg2png(bytestring=svg_text.encode('utf-8'), write_to=os.path.join(OUT, name), output_width=width)

made = []
wm_d, wm_w = text_path('next', 800, NAME, CAP, TRACK_WM)
desc_d, desc_w = text_path('mono', 500, DESC, CAP * DESC_SIZE, TRACK_DESC)
PAD = U  # clear space

for v, c in VARIANTS.items():
    # mark alone, with its clear space
    body = mark_body(c['ink'], c['star'], PAD, PAD)
    s = svg(MARK_W + 2 * PAD, MARK_H + 2 * PAD, body, 'Zorya')
    write(f'zorya-mark-{v}.svg', s); made.append(f'zorya-mark-{v}.svg')
    # wordmark alone (baseline at CAP + PAD)
    body = f'<g fill="{c["text"]}" transform="translate({PAD:.2f} {PAD + CAP:.2f})"><path d="{wm_d}"/></g>'
    s = svg(wm_w + 2 * PAD, CAP + 2 * PAD, body, 'Zorya')
    write(f'zorya-wordmark-{v}.svg', s); made.append(f'zorya-wordmark-{v}.svg')
    # horizontal lockup: mark, gap 2u, wordmark; the horizon's bottom edge is the baseline
    x_text = PAD + MARK_W + 2 * U
    body = mark_body(c['ink'], c['star'], PAD, PAD) + f'\n  <g fill="{c["text"]}" transform="translate({x_text:.2f} {PAD + CAP:.2f})"><path d="{wm_d}"/></g>'
    W = x_text + wm_w + PAD
    s = svg(W, CAP + 2 * PAD, body, 'Zorya')
    write(f'zorya-lockup-h-{v}.svg', s); made.append(f'zorya-lockup-h-{v}.svg')
    # horizontal lockup with the descriptor under the wordmark
    y_desc = PAD + CAP + U + CAP * DESC_SIZE
    body2 = body + f'\n  <g fill="{c["desc"]}" transform="translate({x_text:.2f} {y_desc:.2f})"><path d="{desc_d}"/></g>'
    s = svg(W, y_desc + PAD, body2, 'Zorya — czuwanie świtu')
    write(f'zorya-lockup-h-tagline-{v}.svg', s); made.append(f'zorya-lockup-h-tagline-{v}.svg')
    # vertical lockup: mark centred over the wordmark, gap 2u; descriptor centred beneath
    W = max(wm_w, MARK_W) + 2 * PAD
    mx = (W - MARK_W) / 2
    y_wm = PAD + MARK_H + 2 * U + CAP
    body = mark_body(c['ink'], c['star'], mx, PAD) + f'\n  <g fill="{c["text"]}" transform="translate({(W - wm_w) / 2:.2f} {y_wm:.2f})"><path d="{wm_d}"/></g>'
    y_desc = y_wm + U + CAP * DESC_SIZE
    body += f'\n  <g fill="{c["desc"]}" transform="translate({(W - desc_w) / 2:.2f} {y_desc:.2f})"><path d="{desc_d}"/></g>'
    s = svg(W, y_desc + PAD, body, 'Zorya — czuwanie świtu')
    write(f'zorya-lockup-v-{v}.svg', s); made.append(f'zorya-lockup-v-{v}.svg')

# level glyphs for the UI (currentColor, 32 × 16 box, mark scaled to 2u = 8 px star)
for level in ['cisza', 'obserwacja', 'ostrzezenie', 'alarm', 'odwolanie']:
    body = f'<g transform="scale(0.2)">{mark_body("currentColor", "currentColor", 0, 0, level)}</g>'
    s = svg(MARK_W * 0.2, MARK_H * 0.2, body, f'poziom: {level}', extra=' fill="currentColor"')
    write(f'level-{level}.svg', s); made.append(f'level-{level}.svg')

# app icon: night square, the mark at 62 % of the width, centred; square corners (the OS masks them)
S = 1024.0
scale = 0.62 * S / MARK_W
ox, oy = (S - MARK_W * scale) / 2, (S - MARK_H * scale) / 2
body = f'<g transform="translate({ox:.2f} {oy:.2f}) scale({scale:.4f})">{mark_body(C["ivory"], C["dawn"])}</g>'
icon = svg(S, S, body, 'Zorya', bg=C['night'])
write('app-icon.svg', icon); made.append('app-icon.svg')
for w in (1024, 512, 192, 180):
    png(icon, f'app-icon-{w}.png', w); made.append(f'app-icon-{w}.png')
# maskable: the mark inside the 80 % safe zone
scale_m = 0.5 * S / MARK_W
ox, oy = (S - MARK_W * scale_m) / 2, (S - MARK_H * scale_m) / 2
body = f'<g transform="translate({ox:.2f} {oy:.2f}) scale({scale_m:.4f})">{mark_body(C["ivory"], C["dawn"])}</g>'
png(svg(S, S, body, 'Zorya', bg=C['night']), 'app-icon-maskable-512.png', 512); made.append('app-icon-maskable-512.png')
# favicon: the mark on night, filling the square
fs = 0.84 * S / MARK_W
ox, oy = (S - MARK_W * fs) / 2, (S - MARK_H * fs) / 2
body = f'<g transform="translate({ox:.2f} {oy:.2f}) scale({fs:.4f})">{mark_body(C["ivory"], C["dawn"])}</g>'
fav = svg(S, S, body, 'Zorya', bg=C['night'])
write('favicon.svg', fav); made.append('favicon.svg')
for w in (32, 16):
    png(fav, f'favicon-{w}.png', w); made.append(f'favicon-{w}.png')
# avatar 1000: night disc-safe square with the horizontal-free mark (the mark centred, 56 %)
scale_a = 0.56 * S / MARK_W
ox, oy = (S - MARK_W * scale_a) / 2, (S - MARK_H * scale_a) / 2
body = f'<g transform="translate({ox:.2f} {oy:.2f}) scale({scale_a:.4f})">{mark_body(C["ivory"], C["dawn"])}</g>'
png(svg(S, S, body, 'Zorya', bg=C['night']), 'avatar-1000.png', 1000); made.append('avatar-1000.png')
# OG image 1200 × 630: lockup with tagline on night, left-aligned in a 80px inset
W, H = 1200.0, 630.0
lock = open(os.path.join(OUT, 'zorya-lockup-h-tagline-night.svg')).read()
inner = lock.split('<title>Zorya — czuwanie świtu</title>')[1].rsplit('</svg>', 1)[0]
lw = float(lock.split('viewBox="0 0 ')[1].split('"')[0].split()[0]); lh = float(lock.split('viewBox="0 0 ')[1].split('"')[0].split()[1])
sc = 720 / lw
body = f'<g transform="translate(80 {(H - lh * sc) / 2:.2f}) scale({sc:.4f})">{inner}</g>'
og = svg(W, H, body, 'Zorya — czuwanie świtu', bg=C['night'])
write('og-image-1200x630.svg', og); png(og, 'og-image-1200x630.png', 1200); made += ['og-image-1200x630.svg', 'og-image-1200x630.png']

# a contact sheet for humans
sheet = []
y = 40
for v, c in VARIANTS.items():
    bg = c['bg'] or C['fog-raised']
    col = C['ivory'] if v == 'night' else C['night']
    for name in [f'zorya-lockup-h-tagline-{v}.svg', f'zorya-lockup-v-{v}.svg', f'zorya-mark-{v}.svg']:
        s = open(os.path.join(OUT, name)).read()
        vb = s.split('viewBox="0 0 ')[1].split('"')[0].split(); w, h = float(vb[0]), float(vb[1])
        inner = s.split('</title>')[1].rsplit('</svg>', 1)[0]
        sc = min(560 / w, 260 / h)
        sheet.append(f'<rect x="20" y="{y}" width="600" height="{h * sc + 40:.0f}" fill="{bg}"/>')
        sheet.append(f'<g fill="{col}" color="{col}" transform="translate(40 {y + 20}) scale({sc:.4f})">{inner}</g>')
        sheet.append(f'<text x="640" y="{y + 24}" font-family="monospace" font-size="16" fill="{C["night"]}">{name}</text>')
        y += h * sc + 60
sh = svg(900, y + 20, '\n  '.join(sheet), 'Zorya logo sheet', bg=C['fog'])
png(sh, 'logo-sheet.png', 1800); made.append('logo-sheet.png')
json.dump({'mark': {'unit': U, 'rule': [RULE_L, RULE_T], 'star': {'r': STAR_R, 'cx': STAR_CX}, 'gap': GAP, 'box': [MARK_W, MARK_H], 'clear_space': PAD},
           'wordmark': {'font': 'Atkinson Hyperlegible Next', 'weight': 800, 'tracking': TRACK_WM, 'cap_height_equals': 'mark height', 'width_at_cap_70': round(wm_w, 2)},
           'descriptor': {'font': 'Atkinson Hyperlegible Mono', 'weight': 500, 'size': f'{DESC_SIZE} × cap', 'tracking': TRACK_DESC},
           'files': made}, open(os.path.join(OUT, 'logo-manifest.json'), 'w'), indent=1, ensure_ascii=False)
print('\n'.join(made))

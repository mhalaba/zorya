# 02-tokens

`tokens.json` is the source of truth; `tokens.css`, `tailwind.tokens.js`, `zorya.gpl` and `contrast.json` are generated from it by `tools/build-tokens.py`.

- Colours: `color.core` are fixed values; `color.semantic` flip between the `noc` and `dzien` themes. Build UI with the semantic ones (`--z-bg`, `--z-text`, `--z-status-alarm`, …).
- `font.style` → `.z-display`, `.z-h1`, `.z-body`, `.z-label`, `.z-mono`, … classes in `tokens.css`.
- `space` (4 px base), `size`, `radius` (0 and full), `border`, `motion`, `shadow` (none).
- `levels` and `confidence` document the five horizon levels and the four confidence rules the UI encodes.
- `contrast.json` lists 56 computed pairs; all pass their target (AA for text, 3:1 for meaningful graphics).

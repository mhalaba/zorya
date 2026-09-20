# Zorya — components

Every component uses tokens from `02-tokens/tokens.css` (the `--z-*` variables). Reference styles: `screens/mock.css`. Square corners, no shadows, 1 px rules.

| Component | Anatomy | Tokens | Rules |
| --- | --- | --- | --- |
| **AppHeader** | 56 px bar: Lockup (mark mono + ZORYA 18 px/800/+0.08em) left, AreaChip right; bottom edge = 2 px horizon rule | `bg-raised`, `text`, `border.horizon`, rule colour = `status-{level}` (`line-strong` at cisza) | Sticky. The rule is the only element that changes colour with the level. |
| **LevelGlyph** | The mark reshaped by level (`03-logo/level-*.svg`), `currentColor` | colour = `status-{level}`; sizes `size.star-inline` 12 px (row), 24 px (card), `size.star-header` 16 px, `size.star-hero` 56 px | Always paired with the level word (visible or `aria-label`). Alarm may breathe (`motion.star-breath`). |
| **StatusBlock** | LevelGlyph 56 px · level word (`h1`, `status-{level}`) · meta line (`small`, `text-2`, times in `mono`) | `space.6` top, `space.5` bottom | `aria-live`. First element under the header, always. |
| **HorizonRule** | 2 px rule with an uppercase `label` at its right end (HORYZONT) | `line-strong`, `text-2` | Separates events (above) from signals (below). |
| **EventCard** | Top row: LevelGlyph 24 px + level `label` + time `mono-small` right · title `h3` · where `small`/`text-2` · SourceChips · ConfidenceRule | border 1 px `status-{level}`, ground `bg-raised`; alarm: ground `fill-alarm`, text `on-status`, border same as ground | Whole card is one link. Never a coloured left border. Alarm card is followed by a primary "Co robić teraz" button. |
| **SignalRow** | text (15/22) · time `mono-small` right · meta line `small`/`text-2` | bottom rule 1 px **dashed** `line-strong` (dotted for unverified reports) | Below the horizon only. Tapping opens the source item. |
| **ConfidenceRule** | 40 px rule + label `small`/`text-2` | potwierdzone 2 px solid · prawdopodobne 1 px solid · pojedynczy 1 px dashed · niezweryfikowane 1 px dotted | Never colour; the rule style and the word carry it. |
| **SourceChip** | 13/18 text in a 1 px `line-strong` border, 1 px 6 px padding | `text-2`; on alarm card `on-status` | Short source names only: RCB, IMGW, PSP, syreny, SDR, zgłoszenia. |
| **AreaChip** | 32 px, pin icon 16 px + area name, 1 px `line-strong` border | `text` | Opens the area list sheet. Suffix "+2" when more areas are selected. |
| **Button** | 44 px, 1 px border `text`, text 17/700; `.primary`: ground `text`, label `bg`; `.block`: full width | no radius | At most one primary per screen. Status colours are not button colours. |
| **BottomNav** | 5 items: 22 px line icon (1.5 px, square caps) + 12 px label | `bg-raised`, top rule `line-strong`; active: `text` + 2 px top rule; inactive `text-2` | Order fixed: Horyzont · Mapa · Sygnały · Zgłoś · Więcej. Labels always visible. |
| **ListRow** | ≥ 56 px, title 17/24, description `small`/`text-2`, right slot (`mono-small` value, Toggle, or HealthDot) | bottom rule 1 px `line` | Used in Ustawienia and Sygnały. |
| **Toggle** | 44 × 24 box, 1 px `line-strong`; knob 16 px circle `text-2` left; on: border `text`, knob `text` right | `radius.full` on the knob only | `role="switch"`, `aria-checked`. Locked toggles (alarm notifications) show the on state with a lock explanation. |
| **HealthDot** | 8 px circle + `mono-small` time | fresh `status-odwolanie`, stale `status-ostrzezenie`, disabled hollow `line-strong` | Not a level; only source health. |
| **Eyebrow** | `label` in `text-2` left, optional link right, `space.4` top, `space.2` bottom | | Section headings in lists and feeds. |
| **Box** | 1 px `line-strong` border, `space.4` padding, `label` heading in `text-2` | | "Co robić", "Skąd to wiemy", "Treść oryginalna". |
| **Timeline** | rows: time `mono-small` 72 px column + text + meta `small`/`text-2`; rows separated by 1 px `line` | | Chronological, oldest first. |
| **KeyValue** | `dl` two columns, 96 px key in `text-2` | | Obszar / Od / Stan / Pewność. |
| **Field** | label `small`/`text-2`; input 44 px min, 1 px `line-strong`, ground `bg-raised`, text 17/24; placeholder `text-2` | focus ring `focus` | Errors: a `small` line in `status-alarm` under the field with the fix, not a red border alone. |
| **SegmentedControl** | equal cells, 1 px `line-strong`, selected cell ground `text` label `bg` | | Wraps to a second row when needed; never scrolls. |
| **Sheet** | bottom sheet on `bg-raised`, top rule 2 px `line-strong`, `space.4` padding; opens in `motion.duration-base` | | For area list, filters, map details. Closable by the handle rule, the close button and swipe. |
| **OfflineBar** | `small` line under the header on `bg-raised` with a 1 px `line-strong` bottom rule | `text-2` | Text from `voice-and-copy.md` §5. |
| **MapLegend** | bordered panel bottom-left, `small` rows with 14 px swatches | `bg-raised`, `line-strong` | Symbols: filled circle = event, bordered box = area, square = sensor, dashed = boundary. |
| **NorthArrow** | "N" + a filled needle (text colour) and a `text-2` tail, 14 × 32 | | Never the Zorya mark. |
| **Lockup (web)** | `03-logo/zorya-lockup-h-*.svg` at 24 px cap in the header; `-tagline` variant in the footer | | Never live-typed on the website. |
| **HorizonDiagram (web)** | SVG: an event row above a 2 px rule labelled HORYZONT, dashed/dotted signal rows below | | The website's only illustration. |

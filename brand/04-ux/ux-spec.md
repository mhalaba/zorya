# Zorya — UX specification

Scope: the public website at zorya.website and the app (a responsive web app / PWA at 390 px and up; the same screens work as a native shell). Mockups in `screens/` (HTML) and `screens/png/`; strings in `ui-strings.pl.json`; data shapes in `content-model.json`; sample data in `sample-data/`.

## 1. Product principles

1. **One number, then the evidence.** The user sees the level for their area first, the events that produced it second, the raw signals third. Never the reverse.
2. **Above / below the horizon.** Fused events (two or more independent sources, or one official source) are above the horizon; single signals and unverified reports are below it. The horizon is a real line on the screen.
3. **Nothing is inferred silently.** Every event shows which signals made it and how sure the fusion is. A user can always get to the original text of an official message in two taps.
4. **Quiet by default.** Level cisza is a hollow star and one line of text. The app earns attention only when the level rises.
5. **Alarm is different in kind.** Only alarm bypasses quiet hours, inverts the card, and puts a "Co robić" button above everything else.
6. **No account.** No login, no phone number, no e-mail. Areas and settings live on the device; the server learns only the commune names the device subscribes to.
7. **Works when things break.** The last fetched state stays visible with its timestamp; official alerts also arrive by SMS independent of the app, and the app says so.

## 2. Information architecture

```
Horyzont (home)          — level for the selected area, events above the horizon, signals below
  └ Zdarzenie            — one event: what, where, since when, confidence, "Co robić", timeline of signals, original text
Mapa                     — full-bleed map: areas, event polygons, sensors; layers: Zdarzenia / Czujniki / Obszary
Sygnały                  — the sources: status, last update, health, how the level is computed
  └ Źródło               — one source: description, recent items, licence
Zgłoś                    — report form (what / where / when / note / attachment), then the report's own state
Więcej                   — Ustawienia (Obszary, Powiadomienia, Źródła, Dostępność), Jak działa, Prywatność, Status, O aplikacji
```

Bottom navigation, five items, in this order: **Horyzont · Mapa · Sygnały · Zgłoś · Więcej.** The active item is the text colour with a 2 px top rule; inactive items are `text-2`. Labels are always visible.

The website (`www-01-landing.html`) is one page: hero, how it works, five levels, sources, privacy, footer with live status; plus three linked pages: Jak działa (long form), Prywatność, Status (source health, same data as Sygnały).

## 3. The horizon level — how it is computed (product rules the UI depends on)

Sources are of four kinds: **official** (RCB, IMGW, PSP), **sensor** (acoustic siren sensors), **radio** (SDR scanner, ADS-B), **reports** (users). Independent means different kinds.

- **cisza**: no active event in the selected areas and every enabled source has reported within its freshness window (15 min default; 6 h for PSP notices).
- **obserwacja**: exactly one source, of any kind except reports, has an item for the area; or an official notice of the lowest grade (IMGW level 1, a PSP planned test).
- **ostrzeżenie**: two independent sources agree on place and time window (±30 min, overlapping area); or an official warning of grade 2+ for the area; or an acoustic sensor detects a real (non-scheduled) siren pattern.
- **alarm**: an RCB alert for the area; or a siren detection confirmed by any second kind of source; or an official message whose text contains an instruction to take shelter.
- **odwołanie**: the event's source cancelled it, or it expired (RCB: 60 min after the last message without renewal; IMGW: its own validity end). Shown for 60 min, then cisza.

Reports never raise the level by themselves; 5+ reports within 10 min in one commune create a signal below the horizon and are shown as a count. A source that is down lowers nothing: the level is computed from the sources that report, and the UI says how many.

The level shown in the header is the **maximum** over the user's areas; the home status block names the area that sets it.

## 4. Screens

### 4.1 Horyzont (home) — `app-01-horyzont.html`, `app-02-horyzont-alarm.html`

Header: lockup (mark + ZORYA at 18 px) left; area chip right (tapping opens the area list; the chip shows the primary area, a "+2" suffix when more are selected). The header's bottom edge is the 2 px horizon rule in the current level's colour (`line-strong` at cisza).

Status block (`aria-live="polite"`, `assertive` at alarm): the level glyph at 56 px, the level word in `h1` and level colour, one line of meta (`small`, `text-2`): count of active events, since when, sources active, last data time in `mono`.

Section *Zdarzenia*: event cards, newest level first, then time. Each card: level glyph + level word (`label`) + time (`mono-small`); title (`h3`); where + validity (`small`); source chips; confidence rule with label. The alarm card is inverted and is followed by a full-width primary button **Co robić teraz**. Tapping a card opens Zdarzenie.

The horizon rule with the label HORYZONT at its right end.

Section *Sygnały pod horyzontem*: single signals as rows separated by dashed rules: text, time, one meta line (source · place · why it is below the horizon). A *Filtruj* link opens a sheet with source-kind toggles. At cisza with no signals: the empty state *Cisza. Nic aktywnego w Twoich obszarach.* and the last data time.

Pull to refresh; background refresh every 60 s while open, push otherwise.

### 4.2 Zdarzenie — `app-03-zdarzenie.html`

Header keeps the level. Then: glyph + level badge + event ID (mono, `YYYY-MMDD-NNN`); title (`h1`); key-value list (Obszar, Od, Stan, Pewność with the rule); box **Co robić** (official instruction verbatim first, then up to three numbered steps); box **Skąd to wiemy**: the timeline of contributing signals, newest last, each with time (`mono-small`), text, and a meta line (source · detail · whether it counted); then **Treść oryginalna** (collapsed; the raw official text and its link); two buttons: **Udostępnij** (share text = the alert line + link), **Wycisz na 1 h** (mutes repeats of this event only; disabled with a note at alarm). Footnote on quiet hours.

### 4.3 Mapa — `app-04-mapa.html`

Full-bleed map under the header. Layer chips top-left: Zdarzenia (on by default), Czujniki, Obszary. North arrow top-right (an N over a filled needle — not the Zorya mark). Legend bottom-left in a bordered panel. Event areas: status colour at `map-area-alpha` with a 1.5 px outline; event point: a 12 px filled circle in the status colour; sensors: 10 px squares with a `line-strong` border; boundaries dashed. Tapping an area or point opens a bottom sheet with the event card; tapping a sensor shows its name, last reading and health. No basemap labels other than communes and towns in the area; the map uses the app's tokens, not a third-party style. Offline: the last tiles, greyed, with the offline note.

### 4.4 Sygnały — `app-05-sygnaly.html`

Title, one-line explanation of the freshness rule, a list of sources: name, description, health dot (calm = fresh, ember = stale or partial, hollow = disabled) with the last update time in mono. Then a short *Jak liczymy poziom* paragraph (the rules in 3, in plain words). Tapping a source opens its page: description, licence/attribution line, the last 20 items, a toggle to disable it (not available for RCB).

### 4.5 Zgłoś — `app-06-zglos.html`

Title, a two-line explanation (what to report: what you hear or see, no interpretation; reports live below the horizon). Fields: **Co** — a two-row segmented control (Syrena · Huk / wybuch · Dron / samolot · Dym / pożar · Brak prądu · Inne); **Gdzie** — filled from the device location, rounded to 500 m, editable; **Kiedy** — now, editable; **Opis** — optional, 200 characters; **Zdjęcie lub nagranie** — optional, EXIF stripped on device. A privacy note (no phone number, anonymous, 10-minute withdrawal). Primary button **Wyślij zgłoszenie**. After sending: a confirmation line with the withdrawal deadline, and the report appears below the horizon with the dotted rule. If five or more reports of the same kind arrive within 10 minutes in the commune, the user sees *Twoje zgłoszenie jest jednym z 14* on the signal row.

### 4.6 Ustawienia — `app-07-ustawienia.html` (shown in the dzień theme)

Grouped lists under `label` eyebrows: **Obszary** (list with role labels — dom, praca; *Dodaj* opens a search of communes/counties); **Powiadomienia** (toggles per level with their sound rule stated in the description; quiet hours with the note that alarm ignores them); **Źródła** (toggles for optional sources); **Dostępność** (Motyw noc / dzień / systemowy; Rozmiar tekstu follows the system up to 200 %; Ogranicz ruch); **O aplikacji** (version, licences, source code, contact).

### 4.7 First run

Three steps, each one screen with the mark top-left and a single question: (1) *Której gminy mam pilnować?* — search with the device location as the first suggestion; (2) *Kiedy Cię budzić?* — the level toggles with the alarm one locked on and explained; (3) the notification permission request, with the sentence *Bez tej zgody Zorya pokaże alarm tylko po otwarciu.* The user lands on Horyzont at whatever the level is.

### 4.8 Website — `www-01-landing.html`

Sections and copy in `site-copy.pl.md`. The hero's right panel is a live rendering of the Horyzont status block and one event, fed by the real status endpoint with a sample fallback; it is labelled *przykład* when sample. The footer shows live source health. The page has no cookies and no third-party scripts; the fonts are self-hosted from `05-fonts/`.

## 5. States every screen must handle

| State | Rule |
| --- | --- |
| Loading | The layout renders with its rules and eyebrows; text areas show *ładowanie…* in `small`. No spinners, no skeleton shimmer. |
| Empty | A sentence that says what is empty and the last data time. |
| Stale (> freshness window) | The status meta line turns to *dane z {time}* in `status-ostrzezenie`; the header keeps the last level. |
| Offline | A `small` bar under the header: *Brak połączenia. Pokazuję dane z {time}.* |
| Source down | Named in the status meta and on Sygnały; the level is computed from the rest and says from how many. |
| Error | The sentence names the thing that failed and the time; a retry link. Never *Coś poszło nie tak*. |
| Alarm | Card inverted, "Co robić teraz" button, star breathing (unless reduced motion), header rule in alarm colour, notification with sound regardless of quiet hours. |

## 6. Notifications

Channels (Android) / categories (iOS): `alarm` (max importance, sound, bypass DND where permitted), `ostrzezenie` (high, sound outside quiet hours), `obserwacja` (default, silent, off by default), `odwolanie` (default, single tone), `zrodla` (low, silent — a source down for more than 30 min). Grouping: one notification per event, updated in place; never a stream. Tapping opens Zdarzenie. A notification's text follows `voice-and-copy.md` §3.

## 7. Accessibility

- Contrast: every pair in `02-tokens/contrast.json` passes AA; text on status fills uses `on-status`.
- Levels carry word + shape + colour; confidence carries a rule style + word.
- Minimum text 14 px (`small`), body 17 px; the app follows system text scaling to 200 % without horizontal scrolling.
- Tap targets ≥ 44 px; list rows ≥ 56 px.
- Focus ring 2 px `focus` colour, offset 2 px, on every interactive element; the bottom navigation is a `nav` with `aria-current`.
- The status block is a live region; the alarm state is announced once, assertively.
- Reduced motion turns off the breathing star; nothing else animates.
- Screen-reader labels for the glyphs: *poziom: alarm* etc.; the mark in the header is labelled *Zorya, strona główna*.
- Both themes; `prefers-color-scheme` respected unless the user chose a theme in Ustawienia.
- Polish diacritics render in the shipped fonts (load `latin-ext`).

## 8. Performance and offline

PWA with a service worker: the shell, fonts and the last state cached; the app opens offline to the last known level with its timestamp. Initial load under 200 KB excluding the map. Map tiles vector, from the foundation's own tile server or a licensed source with attribution shown on the map's page.

## 9. Privacy UX

- No account, no phone number, no analytics.
- The device sends: subscribed area IDs, a push token, reports the user sends (rounded location, EXIF-stripped media).
- Every place data leaves the device is stated in one sentence at the point of action (the report form, the notification permission step).
- The privacy page is written in the same voice, one screen long, and lists exactly the fields above.

## 10. What is out of scope in v1

Accounts, groups and sharing between users, chat, a public map of reports, historical analytics, English UI (strings are keyed so it can come later).

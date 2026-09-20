# Zorya — voice and copy

All user-facing copy is Polish. This file gives the rules and the templates; every string the screens use is in `04-ux/ui-strings.pl.json`, the landing page copy in `04-ux/site-copy.pl.md`.

## 1. Voice

- **Short.** A sentence does one thing. An alert line fits on two lines of a lock screen.
- **Concrete.** A number with a unit and a source beats an adjective. „sygnał ciągły 41 s" not „długi sygnał". „3 statki powietrzne bez identyfikatora" not „podejrzana aktywność".
- **Second person singular, informal:** *Ty, Twoja gmina, wejdź, nie wychodź*. Never *Państwo*, never *użytkownik*.
- **No exclamation marks, no emoji, no capitals for emphasis.** The level word and the layout carry urgency; the text stays level. „Alarm. Wejdź do budynku." — not „ALARM!!! Natychmiast do schronu!".
- **No comfort that is not a fact.** Not „wszystko będzie dobrze", not „nie ma powodu do paniki". Instead: what is known, what is not, what to do.
- **Say what you do not know.** *brak potwierdzenia*, *pojedynczy sygnał*, *niezweryfikowane*, *brak danych od 05:12*. An empty field is described, never hidden.
- **The app speaks as the app, not as a person.** No „my", no „nasz zespół", no „przepraszamy za niedogodności". Passive is fine when the actor is the system: „zgłoszenie zostało wysłane".
- **Verbs for actions, nouns for places.** Buttons: *Otwórz aplikację, Wyślij zgłoszenie, Wycisz na 1 h, Udostępnij*. Navigation: *Horyzont, Mapa, Sygnały, Zgłoś, Więcej*.
- **Plain Polish.** No *eskalacja*, *dedykowany*, *rozwiązanie*, *kompleksowy*, *funkcjonalność*, *w czasie rzeczywistym* (say *na bieżąco*). No English UI words where a Polish one exists (*ustawienia* not *settings*, *zgłoś* not *report*), but keep established technical names as they are: RCB, IMGW, PSP, ADS-B, SDR, AGL, MHz.

## 2. The alert line

Every event, in every place it appears (list, detail title, push, share text), is built the same way:

```
[poziom] · [co] · [gdzie] · [od kiedy] · [źródło] · [pewność]
```

- **poziom** — one of the five words. In a push it is the first word of the title.
- **co** — the official wording where an official source exists (RCB and IMGW texts are quoted, not rewritten; the app may shorten but never paraphrase a sentence that gives an instruction). For sensor events: the measurement — *syrena: sygnał modulowany 3 min*, *statek powietrzny bez identyfikatora, 300 m AGL*.
- **gdzie** — the smallest named area the source supports: *gmina Brzegowo*, *powiat brzegowski*. Coordinates only in the detail view, rounded to 0,01°.
- **od kiedy** — 24-hour time; the date only if not today.
- **źródło** — the source's short name: *RCB, IMGW, PSP, syreny, SDR, zgłoszenia*.
- **pewność** — *potwierdzone, prawdopodobne, pojedynczy sygnał, niezweryfikowane*, plus what makes it so: *RCB + czujnik*, *1 źródło oficjalne*.

Examples:

- *alarm · Alert RCB: zagrożenie powietrzne. Udaj się do schronu · gmina Brzegowo · od 05:37 · RCB, syreny · potwierdzone*
- *ostrzeżenie · IMGW: silny wiatr, 2. stopnia, do 90 km/h · powiat brzegowski · do 21.09, 06:00 · IMGW · prawdopodobne*
- *obserwacja · czujnik nr 3: sygnał ciągły 41 s · Nadwiśle · 05:12 · syreny · pojedynczy sygnał*

## 3. Push notifications

Title ≤ 40 characters, body ≤ 110. The title starts with the level word, capitalised. The body ends with the instruction or the next step. No emoji, no „Uwaga", no „Pilne".

| Level | Title | Body |
| --- | --- | --- |
| alarm | `Alarm · {area}` | `{what}. {instruction}. Od {time}, źródło: {sources}.` |
| ostrzeżenie | `Ostrzeżenie · {area}` | `{what}. {validity}. {sources}.` |
| obserwacja | `Obserwacja · {area}` | `{what}. Pojedynczy sygnał, bez potwierdzenia.` (only when the user opted in) |
| odwołanie | `Odwołanie · {area}` | `{what} — odwołane o {time}. Poziom: cisza.` |
| źródła | `Zorya: brak danych` | `{source} nie odpowiada od {time}. Poziom liczony z {n} źródeł.` |

Examples: **Alarm · Brzegowo** — *Alert RCB: zagrożenie powietrzne. Wejdź do budynku, z dala od okien. Od 05:37, źródło: RCB, syreny.* — **Odwołanie · Brzegowo** — *Zagrożenie powietrzne — odwołane o 06:14. Poziom: cisza.*

Sound: alarm always (system alarm channel, bypasses quiet hours and Do Not Disturb where the platform allows); ostrzeżenie with sound outside quiet hours; obserwacja silent; odwołanie a single tone. Never a repeating siren sound — the app must not be mistaken for the siren.

## 4. Instructions ("Co robić")

Three steps, numbered, imperative, each under 90 characters. Step 1 is the physical action, step 2 the thing not to do, step 3 what the app will do next. Official instructions (RCB text) come first and verbatim; the app's own steps follow, marked *wskazówki Zoryi*. Never invent an instruction for a threat type the app has no template for: show the official text and *Brak wskazówek dla tego typu zdarzenia*.

## 5. Empty, error and loading states

- Empty feed (cisza): *Cisza. Nic aktywnego w Twoich obszarach. Ostatnie dane 05:41.*
- No areas chosen: *Wybierz gminę, żeby Zorya wiedziała, czego pilnować.*
- A source down: *IMGW nie odpowiada od 04:20. Poziom liczony z 5 źródeł.* — never *Coś poszło nie tak*.
- Offline: *Brak połączenia. Pokazuję dane z 05:41. Alarm RCB przyjdzie SMS-em niezależnie od Zoryi.*
- Loading: no spinner copy; the horizon rule and a *ładowanie…* line in `small`.
- Report sent: *Wysłane 05:39. Zgłoszenie jest pod horyzontem. Możesz je wycofać do 05:49.*

## 6. Words

Use: *poziom, horyzont, zdarzenie, sygnał, źródło, obszar, gmina, powiat, czujnik, zgłoszenie, odwołanie, pewność, potwierdzone, na bieżąco, dane z {time}.*

Avoid: *incydent, event, alert (as a Polish noun — use komunikat or alarm), notyfikacja (say powiadomienie), lokalizacja (say miejsce or obszar, unless technical), monitoring, real-time, AI, inteligentny, bezpieczny (as a promise), gwarantujemy.*

## 7. Typography in copy

Polish quotation marks „ ”; a spaced hyphen as a dash in UI copy (the em dash is reserved for the mono metadata separator `—` in timestamps like *05:38—05:44*); the middle dot `·` with spaces as the separator of the alert line; decimal comma; thin no-break space in thousands; `−` for minus; units after a space; 24-hour time without seconds except in the timeline; ISO dates in mono, spelled-out dates in prose.

## 8. Website copy

The landing page is one page in Polish, six sections: hero, how it works, the five levels, sources, privacy, footer with status. Its copy is in `04-ux/site-copy.pl.md` and is written in the same voice — the hero sentence is *Zorya czuwa, kiedy Ty śpisz.* and the only promise on the page is a description of what the app does. No testimonials, no logos of institutions that have not agreed, no download counters.

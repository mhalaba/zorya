# Zorya — flows

## 1. First run

1. Open → screen 1: *Której gminy mam pilnować?* Search field; the device location (if granted) offers the commune as the first suggestion. Add 1–5 areas, each with an optional role (dom, praca, rodzina).
2. Screen 2: *Kiedy Cię budzić?* Four level toggles. Alarm is on and locked, with: *Alarm zawsze budzi. To jedyna rzecz, której nie da się wyłączyć.* Quiet hours default 22:00–06:00.
3. Screen 3: notification permission. If refused: the app continues and Horyzont shows a persistent `small` line *Powiadomienia wyłączone. Alarm zobaczysz tylko po otwarciu.* with a link to system settings.
4. Land on Horyzont at the current level.

## 2. Alarm lifecycle

1. RCB alert (or siren + second source) arrives → level = alarm for the area.
2. Push: title *Alarm · {area}*, body with the instruction; sound on the alarm channel; bypasses quiet hours.
3. Header rule turns alarm; StatusBlock announces once (assertive); the alarm card inverts; the "Co robić teraz" button appears; the star breathes until the event is opened.
4. User opens Zdarzenie → the star stops breathing; "Co robić" shows the official instruction verbatim, then Zorya's three steps.
5. Updates to the same event replace the notification in place; the timeline grows.
6. Cancellation or expiry → level = odwołanie for 60 min; push *Odwołanie · {area}* with a single tone; the card border turns calm and the title gets *— odwołane {time}*.
7. After 60 min → cisza; the event moves to history (reachable from the source page and the area's history).

Mute: *Wycisz na 1 h* on an event silences repeats of that event only; at alarm the button is disabled with *Poziom alarm nie podlega wyciszeniu.*

## 3. Report lifecycle

1. Zgłoś → choose *Co*, confirm *Gdzie* (rounded to 500 m) and *Kiedy*, optional note and media (EXIF stripped on device) → *Wyślij zgłoszenie*.
2. Confirmation: *Wysłane {time}. Zgłoszenie jest pod horyzontem. Możesz je wycofać do {time+10 min}.* A *Wycofaj* link for 10 minutes.
3. The report appears below the horizon as a SignalRow with a dotted rule, labelled *niezweryfikowane*.
4. If ≥ 5 reports of the same kind land in the commune within 10 min, the rows collapse into one: *Zgłoszenia: 14 w ciągu 6 min* — still below the horizon.
5. If another kind of source confirms (a sensor, an official message), the report count is listed in that event's timeline as *nie liczone do poziomu* — reports inform, they never decide.

## 4. Changing area

AreaChip → sheet with the user's areas (radio list) and *Wszystkie obszary*. Choosing one re-renders Horyzont for it; the header level stays the maximum across all areas, and if the chosen area is lower than the maximum the StatusBlock says *W {other area}: {level}* on its meta line.

## 5. Source down

A source misses its freshness window → HealthDot turns ember on Sygnały; the StatusBlock meta says *5 z 6 źródeł · IMGW bez danych od {time}*; after 30 min a silent `zrodla` notification. The level is computed from the remaining sources; nothing is estimated for the missing one.

## 6. Offline

Connection lost → OfflineBar under the header; all data keeps its last timestamps; the map shows cached tiles greyed; the report form queues the report and sends it when back, with *Wyślę, gdy wróci połączenie.* The bar reminds that RCB alerts also come by SMS.

## 7. Notification tap

Any notification opens the corresponding Zdarzenie; the back action returns to Horyzont, not to the previous screen. A `zrodla` notification opens Sygnały.

## 8. Theme and text size

System theme by default; Ustawienia › Dostępność overrides. Text size follows the system (Dynamic Type / font scale) up to 200 %; layouts reflow to one column, no horizontal scrolling, the bottom navigation labels wrap to two lines rather than truncate.

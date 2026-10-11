# Zorya

**czuwanie świtu** — niekomercyjna mapa zagrożeń z powietrza dla Polski z otwartych źródeł: NEPTUN (OSINT z Ukrainy, nie radar), alarmy powietrzne UA, ADS-B (adsb.lol), RSO / Alert RCB (komunikaty.tvp.pl) i media RSS (RMF24, PAP). Ocena co minutę dla każdego województwa. Strona „O projekcie”: `/o-projekcie` (EN: `/en/about`).

**Produkcja:** [https://zorya.website](https://zorya.website) — HTTPS, PWA. Krawędź: Cloudflare Tunnel na `http://127.0.0.1:8787`.

**To nie jest oficjalny system ostrzegania.** Nie zastępuje syren, Alertu RCB ani RSO. W razie realnego zagrożenia kieruj się kanałami oficjalnymi.

Projekt Fundacji Terra Incognita. Wpis do KRS w toku.

Pakiet tożsamości i specyfikacji UX: [`brand/`](brand/) (zaczynaj od `brand/GROK-BRIEF.md`).

## Uruchomienie

```bash
npm install
npm run dev
```

- Strona: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- Aplikacja: [http://127.0.0.1:5173/app](http://127.0.0.1:5173/app) — mapa na żywo: [/app/mapa](http://127.0.0.1:5173/app/mapa)
- Tryb makiety (dane z `brand/04-ux/sample-data/`): [http://127.0.0.1:5173/app?fixture=1](http://127.0.0.1:5173/app?fixture=1)

Scenariusze makiety: `?fixture=1` (alarm), `?fixture=obserwacja`, `?fixture=ostrzezenie`, `?fixture=odwolanie`, `?fixture=cisza`, `?fixture=stale`, `?fixture=offline`. Motyw: Ustawienia → Dostępność, albo `data-theme` na `html` (`noc` / `dzien`).

Produkcja:

```bash
npm run build
npm start
```

API (nowe + zachowane):

- `GET /api/status`, `GET /api/horizon`, `GET /api/events/:id`, `GET /api/sources/:id`, `POST /api/reports`
- `GET /api/state`, `GET /api/history/bundle?hours=12`, `WS /api/ws` (stara fuzja)
- Push: `GET /api/push/key`, `POST /api/push/subscribe`
- `GET /api/local-alerts` — alerty lokalne (woda, prąd, gaz, ćwiczenia), `GET /api/airspace` — NOTAM + strefy stałe
- `GET /api/ua-threats` — warstwa MAPA.UA

Testy serwera: `npm test` (parsery RSO/NOTAM, walidacja, limity; bez sieci).

Serwer od startu czyta źródła na żywo (co 60 s). Nasłuch: `HOST` (domyślnie `0.0.0.0`) i `PORT` (8787). UI trzyma fuzję przez `GET /api/state` i `WS /api/ws` (mapa) oraz mapuje ją na horyzont. Makieta (`?fixture=`) nie zastępuje warstw live.

W produkcji ustaw `VAPID_SUBJECT` (np. `mailto:ty@twojadomena.pl`).

## Docker

```bash
docker compose up -d --build
```

- Aplikacja: [http://127.0.0.1:8787/](http://127.0.0.1:8787/); produkcja (Sietch) wystawia ją przez kontener `zorya-tunnel` (Cloudflare, `CF_TUNNEL_TOKEN` tylko w `.env`).
- Dane (archiwum dronów SQLite, klucze VAPID, subskrypcje push) leżą w `./data` montowanym jako `/app/data` (`ZORYA_DATA_DIR`) — przetrwają rebuild i restart.
- `VAPID_SUBJECT`, `MAPAUA_ENABLED` i token tunelu przekaż przez zmienne środowiskowe lub plik `.env` obok `docker-compose.yml` (nie commitować).
- Pliki Docker z PR #4 (wieloetapowy obraz alpine, użytkownik `node`, healthcheck, wolumen `zorya-data`) są w historii (19183f6); produkcja zostaje przy wersji z `./data` i tunelem, przejście wymaga migracji danych.

## Publikacja (Oracle / Caddy — wariant)

Live **zorya.website** idzie tunelem Cloudflare na Node (`npm start`, port 8787). Skrypty w `deploy/` zostają jako wariant Caddy + Let's Encrypt.

```bash
git clone https://github.com/mhalaba/zorya.git && cd zorya
sudo ZORYA_HOST=zorya.website bash deploy/setup.sh
```

Aktualizacja: `sudo bash /opt/zorya/deploy/update.sh`. Kluczy VAPID w `/opt/zorya/server/vapid.json` nie kasować.

## Prywatność

Brak kont, reklam, ciasteczek i skryptów trzecich. Fonty Atkinson Hyperlegible są self-hostowane (`public/fonts/`). Serwer dostaje nazwy subskrybowanych gmin, token push i zgłoszenia (miejsce zaokrąglone do 500 m).

## Archiwum dronów (180 dni)

Serwer zapisuje każdy dron do SQLite `data/drones.sqlite` (`ZORYA_DATA_DIR`, w Dockerze wolumen `./data:/app/data`):

- `drone_tracks` — jeden wiersz na ślad NEPTUN typu `drone`/`shahed` (`ZORYA_ARCHIVE_TYPES`): pierwsze/ostatnie wykrycie, pozycje, maksima pewności/potwierdzeń, województwa, koniec śladu;
- `drone_points` — pierwsze wykrycie + każda zmiana pozycji ≥ 0,3 km lub typu/tytułu/cyklu życia/jakości lokalizacji/pewności/potwierdzeń (wszystkie pola obiektu + JSON);
- `drone_reports` — zgłoszenia użytkowników `dron_samolot` (`ZORYA_ARCHIVE_REPORT_KINDS`), wycofane zostają ze stanem `withdrawn`.

Retencja `ZORYA_ARCHIVE_DAYS` (domyślnie 180), czyszczenie przy starcie i co 24 h. Klucze VAPID i subskrypcje push też leżą w `data/` (`vapid.json`, `push-subs.json`).

Odczyt tylko z LAN (brak logowania w aplikacji; żądania przez tunel Cloudflare / zorya.website dostają 403):
`GET /api/archive?what=tracks|points|reports&from=&to=&limit=`, `GET /api/archive.csv?...`, `GET /api/archive/stats`. Test: `node --test server/archive.test.mjs`.

## Przestrzeń powietrzna: NOTAM i strefy

Serwer co 30 min (`ZORYA_NOTAM_EVERY_MIN`, nie mniej niż 15) pobiera NOTAM-y dla FIR EPWW z publicznej wyszukiwarki FAA (`notams.aim.faa.gov/notamSearch`, format ICAO) i podaje je pod `GET /api/airspace`. Z każdego NOTAM-u: kod Q (rodzaj: strefa P/R/D, czasowa, TSA/TRA, ćwiczenia, strzelania, drony…), ważność B/C, harmonogram D, wysokości F/G oraz obszar — wielokąt lub okrąg z treści E, a gdy go brak — okrąg z linii Q oznaczony jako przybliżenie. NOTAM-y dezaktywujące/odwołane są na liście, ale nie na mapie; NOTAM bez obszaru (np. cały FIR) nie jest przypisywany do województwa.

Na mapie: obowiązujące strefy wypełnione i obrysowane ciągłą linią, zapowiedziane i przybliżone — linią przerywaną. Przycisk „NOTAM” w lewym górnym rogu otwiera listę; dotknięcie strefy pokazuje wszystkie NOTAM-y w tym miejscu. Warstwa informacyjna: **nie zmienia poziomu województw** i nie służy do planowania lotów.

Zmienne: `ZORYA_NOTAM_ENABLED=0` wyłącza, `ZORYA_NOTAM_LOCATIONS=EPWW,EPWA` (kody ICAO), `ZORYA_NOTAM_URL` (np. lustro/test). Opcjonalnie `OPENAIP_API_KEY` (darmowy klucz openaip.net) włącza warstwę stref stałych P/R/D/TSA/TRA (odświeżana raz na dobę).

## Alerty lokalne: woda, prąd, gaz, ćwiczenia

Z tego samego pobrania RSO (co minutę) serwer wybiera komunikaty o awariach i planowanych wyłączeniach wody, prądu i gazu oraz o ćwiczeniach i testach syren, przypisuje je do województw (pole RSO, a w razie braku — nazwy w treści) i odczytuje z treści okno czasowe („15.10.2026 w godz. 8:00–14:00”, „14–15 października”). Bez daty w treści komunikat jest pokazywany przez 24 h (awaria) lub 3 dni (planowane, ćwiczenia) od publikacji. Komunikaty, które zniknęły z pierwszej strony RSO, zostają do końca swojego okna (`data/local-alerts.json`). Ostrzeżenia IMGW, hydrologiczne, smog i kąpieliska są pomijane.

Na mapie: znaczki pod środkiem województwa (żółty — prąd, niebieski — woda, pomarańczowy — gaz, fioletowy — ćwiczenia; przygaszony = zaplanowane), liczba przy znaczku. Przycisk „Lokalne” otwiera listę z filtrem rodzajów; panel województwa ma sekcje „Lokalne” i „NOTAM nad województwem”. Nie zmieniają poziomu zagrożenia.

Dodatkowe kanały (operatorzy sieci, wodociągi, BIP gmin) przez `ZORYA_LOCAL_FEEDS` — tablica JSON RSS/Atom, czytana co 10 min:

```bash
ZORYA_LOCAL_FEEDS='[{"url":"https://example.pl/wylaczenia.rss","name":"Operator X","category":"power","voivodeships":["wielkopolskie"]}]'
```

`category` (`power|water|gas|exercise`) przypisuje wszystkie wpisy kanału do jednego rodzaju; bez niej wpisy są klasyfikowane jak komunikaty RSO.

## Bezpieczeństwo

- Zapisy (`POST /api/reports`, `DELETE /api/reports/:id`, push) tylko z tej samej domeny (bez nagłówków CORS), z limitami na IP; publiczne odczyty `GET` mają CORS `*`.
- Zgłoszenia: biała lista rodzajów, położenie tylko w Polsce i zaokrąglane do 500 m **na serwerze**, notatka do 500 znaków, losowy identyfikator (128 bit), pamięć ograniczona (2000 / 24 h).
- Push: tylko endpointy usług Web Push, walidacja kluczy i województw, TTL 15–30 min (stary alarm nie dochodzi po godzinach), zapis na dysk tylko przy zmianie.
- Nagłówki: CSP (produkcja), `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`. Błędy jako krótki JSON, bez stosu.
- WebSocket: ramki od klientów ≤ 1 KiB, limit połączeń (`ZORYA_WS_MAX_CLIENTS`), heartbeat co 30 s.
- Źródła zewnętrzne: limit rozmiaru odpowiedzi (8 MB), timeouty, linki tylko `http(s)`.
- Archiwum: dodatkowo `ZORYA_ARCHIVE_TOKEN` (nagłówek `Authorization: Bearer …` lub `?token=`); CSV neutralizuje formuły arkusza.
- Zalecane: w `docker-compose.yml` publikować port tylko w LAN (np. `"192.168.1.10:8787:8787"`), przypiąć wersję obrazu `cloudflared` zamiast `latest`.

## Warstwa rakiet MAPA.UA

Serwer co 30 s (nigdy częściej, z backoffem przy błędach) pobiera `https://mapa.ua/api/v1/current` i podaje przycięte dane pod `GET /api/ua-threats` (obiekty starsze niż 60 min są odrzucane). Nazwy miejscowości z `/api/v1/geo/cities` (cache 1 dzień), liczba naruszeń przestrzeni PL z `/api/v1/countries?hours=12` (co 5 min). Na mapie: warstwa „Rakiety (UA)” (domyślnie włączona) oraz opcjonalnie KAB i drony. Wyłączenie: `MAPAUA_ENABLED=0` w `.env`, potem `docker compose up -d`. Uwaga: robots.txt MAPA.UA ma `Disallow: /api/`; jeśli MAPA.UA zgłosi sprzeciw, wyłączyć flagą.

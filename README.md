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

Serwer od startu czyta źródła na żywo (co 60 s). Nasłuch: `HOST` (domyślnie `0.0.0.0`) i `PORT` (8787). UI trzyma fuzję przez `GET /api/state` i `WS /api/ws` (mapa) oraz mapuje ją na horyzont. Makieta (`?fixture=`) nie zastępuje warstw live.

W produkcji ustaw `VAPID_SUBJECT` (np. `mailto:ty@twojadomena.pl`).

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

## Warstwa rakiet MAPA.UA

Serwer co 30 s (nigdy częściej, z backoffem przy błędach) pobiera `https://mapa.ua/api/v1/current` i podaje przycięte dane pod `GET /api/ua-threats` (obiekty starsze niż 60 min są odrzucane). Nazwy miejscowości z `/api/v1/geo/cities` (cache 1 dzień), liczba naruszeń przestrzeni PL z `/api/v1/countries?hours=12` (co 5 min). Na mapie: warstwa „Rakiety (UA)” (domyślnie włączona) oraz opcjonalnie KAB i drony. Wyłączenie: `MAPAUA_ENABLED=0` w `.env`, potem `docker compose up -d`. Uwaga: robots.txt MAPA.UA ma `Disallow: /api/`; jeśli MAPA.UA zgłosi sprzeciw, wyłączyć flagą.

# Zorya

Nieoficjalna fuzja sygnałów o zagrożeniach powietrznych dla Polski. Czuwanie świtu — nie syrena, nie urząd, nie radar.

**To NIE jest oficjalny system ostrzegania.** Nie zastępuje syren, Alertu RCB ani RSO. W razie realnego zagrożenia kieruj się kanałami oficjalnymi. Zorya może dać dodatkowy, wcześniejszy sygnał — albo nic nie dać.

Nazwa pochodzi od Zorzy: w mitologii słowiańskiej strażniczek świtu i zmierzchu. Aplikacja nie udaje instytucji państwa.

## Uruchomienie

```bash
npm install
npm run dev
```

UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)  
API: `GET /api/state`, `GET /api/history/bundle?hours=12`, `WS /api/ws`

Produkcja:

```bash
npm run build
npm start
```

Serwer od startu czyta źródła na żywo (co 60 s). Źródło, które nie odpowiada dłużej niż 15 minut, gaśnie (czerwona dioda) i przestaje wnosić dane do fuzji.

W produkcji ustaw `VAPID_SUBJECT` (np. `mailto:ty@twojadomena.pl`) — usługa push Apple odrzuca domyślny adres `@localhost`.

## Publikacja (Oracle Cloud Always Free)

Maszyna z Ubuntu 22.04/24.04 (np. `VM.Standard.A1.Flex`), w security list VCN otwarte porty 80 i 443. Na serwerze:

```bash
git clone https://github.com/mhalaba/zorya.git && cd zorya
sudo ZORYA_HOST=<ip-z-kreskami>.sslip.io bash deploy/setup.sh
```

Skrypt instaluje Node 22 i Caddy (HTTPS z Let's Encrypt), buduje aplikację i uruchamia ją jako usługę `zorya`. Aktualizacja: `sudo bash /opt/zorya/deploy/update.sh`. Klucze VAPID powstają w `/opt/zorya/server/vapid.json` — nie kasuj ich, bo wygasną wszystkie subskrypcje push.

## Zasady fuzji

Liczenie per województwo, okno 60 minut. Kolor = poziom, nie ozdoba.

- &lt;2 cisza (navy)
- ≥2 uwaga (bursztyn)
- ≥4 priorytet (czerwień)
- oliwkowy = transfer sąsiada, bez powiadomienia

Pełna tabela: w aplikacji **Więcej → Tabela punktacji**.

## Prywatność

Brak kont, reklam i inwazyjnej analityki. Moje miejsca zostają w `localStorage` tej przeglądarki.

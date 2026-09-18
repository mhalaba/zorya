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
API: `GET /api/state`, `GET /api/history/bundle?hours=12`, `WS /ws/state`

Produkcja:

```bash
npm run build
npm start
```

Domyślny stan mock to spokój: Polska bez progów, 1–2 obiekty NEPTUN daleko na Ukrainie (warstwa obserwacji, 0 pkt), jedna strefa TSA bez punktów. Brak fałszywego ruchu nad Polską.

## Zasady fuzji

Liczenie per województwo, okno 60 minut. Kolor = poziom, nie ozdoba.

- &lt;2 cisza (navy)
- ≥2 uwaga (bursztyn)
- ≥4 priorytet (czerwień)
- oliwkowy = transfer sąsiada, bez powiadomienia

Pełna tabela: w aplikacji **Więcej → Tabela punktacji**.

## Prywatność

Brak kont, reklam i inwazyjnej analityki. Moje miejsca zostają w `localStorage` tej przeglądarki.

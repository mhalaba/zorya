/** "O projekcie" / "About" page copy. Plain data; Site.tsx renders it. **bold** is supported inline. */

export type AboutBlock =
  | { t: "lead"; text: string }
  | { t: "h2"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "warn"; text: string };

export interface AboutCopy {
  title: string;
  switchLabel: string;
  switchHref: string;
  blocks: AboutBlock[];
}

export const ABOUT_PL: AboutCopy = {
  title: "O projekcie",
  switchLabel: "English",
  switchHref: "/en/about",
  blocks: [
    {
      t: "lead",
      text: "**Zorya** („czuwanie świtu”) to bezpłatna, niekomercyjna mapa sytuacyjna zagrożeń z powietrza dla Polski, pokazująca też kontekst z Ukrainy. Zbiera w jednym miejscu publicznie dostępne informacje: obserwacje dronów i pocisków nad Ukrainą, alarmy w obwodach ukraińskich, ruch lotniczy nad Polską oraz polskie komunikaty o zagrożeniach. Na tej podstawie co minutę ocenia, czy coś może dotyczyć Twojego województwa.",
    },
    { t: "h2", text: "Problem" },
    {
      t: "p",
      text: "Kiedy nad wschodnią Polską pojawiają się drony albo pociski, informacje są rozproszone: ukraińskie kanały OSINT, komunikaty RSO i Alert RCB, media, serwisy śledzące samoloty. Trudno szybko ocenić, czy zdarzenie dotyczy mojego regionu, a pojedyncze, niepotwierdzone doniesienia łatwo wywołują niepokój. Zorya ma zebrać te sygnały, uporządkować je i jasno pokazać, skąd pochodzi każda informacja i jak bardzo jest pewna.",
    },
    { t: "h2", text: "Jak to działa" },
    { t: "p", text: "**1. Zbieranie danych.** Co 60 sekund serwer pobiera dane wyłącznie z otwartych, publicznych źródeł:" },
    {
      t: "ul",
      items: [
        "**NEPTUN** (neptun.in.ua): śledzenie zagrożeń powietrznych nad Ukrainą (drony typu Shahed, pociski, lotnictwo) oparte na OSINT. To nie są dane radarowe.",
        "**Alarmy powietrzne w obwodach Ukrainy**, pobierane przez NEPTUN.",
        "**ADS-B** (adsb.lol): samoloty nad Polską, które same nadają swoją pozycję, w tym statki powietrzne oznaczone w tym serwisie jako wojskowe w rejonie wschodniej flanki.",
        "**RSO / Alert RCB** (komunikaty.tvp.pl): oficjalne komunikaty dotyczące zagrożeń z powietrza.",
        "**Media**: kanały RSS RMF24 i PAP, filtrowane pod kątem treści o zagrożeniach powietrznych. Ćwiczenia, smog i informacje drogowe są odrzucane.",
      ],
    },
    { t: "p", text: "Każde źródło ma własny wskaźnik stanu. Dane starsze niż 15 minut nie są brane pod uwagę." },
    {
      t: "p",
      text: "**2. Ocena.** Dla każdego z 16 województw Zorya liczy punkty w oknie 60 minut. Liczą się: typ obiektu, odległość od polskiej granicy, kierunek lotu względem Polski, wiek i jakość lokalizacji, pewność i liczba potwierdzeń podawane przez źródło, alarmy w przygranicznych obwodach Ukrainy oraz doniesienia medialne. Obiekty oddalone o ponad 250 km od granicy są tylko pokazywane i nie wpływają na ocenę. Oficjalny komunikat o zagrożeniu z powietrza dla danego województwa od razu daje najwyższy poziom. Mapa pokazuje trzy stany: spokój, **uwaga** i **priorytet**.",
    },
    {
      t: "p",
      text: "**3. Mapa na żywo.** Pokazuje województwa w kolorach poziomu, obwody Ukrainy z aktywnym alarmem, obiekty z NEPTUN z kołem niepewności położenia i śladem oraz samoloty z ADS-B. Mapę można oddalić i zobaczyć cały region: Polskę, Ukrainę i kraje bałtyckie. Podkład mapy: OpenFreeMap / OpenStreetMap.",
    },
    {
      t: "p",
      text: "**4. Archiwum.** Każdy ślad drona lub Shaheda z NEPTUN jest zapisywany w lokalnym archiwum przez 180 dni, a potem automatycznie usuwany. Archiwum nie jest publiczne i można je odczytać tylko z sieci lokalnej serwera. Służy do analizy wzorców, np. kiedy i gdzie zagrożenia najczęściej zbliżają się do granicy.",
    },
    { t: "h2", text: "Dla kogo" },
    {
      t: "ul",
      items: [
        "Mieszkańcy Polski, zwłaszcza województw wschodnich, którzy chcą szybko sprawdzić, czy coś dzieje się w ich regionie.",
        "Osoby, które mają bliskich w Ukrainie i śledzą sytuację po drugiej stronie granicy.",
        "Dziennikarze, samorządowcy, służby kryzysowe i badacze, którzy potrzebują uporządkowanego obrazu z otwartych źródeł.",
      ],
    },
    { t: "h2", text: "Zasady" },
    {
      t: "ul",
      items: [
        "**Niekomercyjnie.** Bez reklam i bez sprzedaży danych. Projekt Fundacji Terra Incognita (wpis do KRS w toku).",
        "**Tylko otwarte źródła.** Zorya pokazuje wyłącznie informacje, które już są publicznie dostępne, i zawsze podaje ich pochodzenie.",
        "**Prywatność.** Bez kont, ciasteczek i reklam, bez zewnętrznych skryptów. Czcionki są hostowane lokalnie.",
        "**Bezpieczeństwo informacji (OPSEC).** Zorya nie ma własnych czujników i nie publikuje pozycji polskich ani sojuszniczych sił, lokalizacji infrastruktury krytycznej ani danych operacyjnych. Nie dodaje niczego, czego nie ma już w otwartych źródłach.",
        "**Otwarty kod.** Kod źródłowy jest dostępny na GitHubie: github.com/mhalaba/zorya.",
        "**Infrastruktura.** Serwer działa w Polsce. Ruch do strony przechodzi przez Cloudflare.",
      ],
    },
    { t: "h2", text: "Ograniczenia: przeczytaj, zanim zaufasz" },
    {
      t: "warn",
      text: "**Zorya nie jest oficjalnym systemem ostrzegania.** Nie zastępuje syren, Alertu RCB, RSO ani komunikatów służb. W razie zagrożenia stosuj się do poleceń władz, a w nagłej sytuacji dzwoń pod 112.",
    },
    {
      t: "ul",
      items: [
        "Dane NEPTUN pochodzą z OSINT, nie z radaru. Pozycje są przybliżone (stąd koła niepewności), mogą być opóźnione, niepełne albo błędne.",
        "Zorya nie ma dostępu do polskich ani natowskich danych radarowych.",
        "Poziomy uwaga/priorytet wynikają z prostej, jawnej heurystyki, a nie z oceny wojskowej.",
        "Źródło może przestać działać. Wtedy jego wskaźnik gaśnie, a ocena opiera się na pozostałych.",
      ],
    },
    { t: "h2", text: "Autor i kontakt" },
    { t: "p", text: "Projekt tworzy **Matthew Halaba**." },
    { t: "p", text: "Kontakt: **m@zorya.website**" },
    { t: "p", text: "Kod: github.com/mhalaba/zorya" },
  ],
};

export const ABOUT_EN: AboutCopy = {
  title: "About",
  switchLabel: "Polski",
  switchHref: "/o-projekcie",
  blocks: [
    {
      t: "lead",
      text: "**Zorya** (\"watch before dawn\") is a free, non-commercial situational-awareness map of air threats for Poland, with context from Ukraine. It brings publicly available information into one place: sightings of drones and missiles over Ukraine, air-raid alerts in Ukrainian oblasts, air traffic over Poland, and Polish official threat notices. Every minute it uses them to assess whether anything may concern your voivodeship (Polish province).",
    },
    { t: "h2", text: "The problem" },
    {
      t: "p",
      text: "When drones or missiles approach eastern Poland, the information is scattered across Ukrainian OSINT channels, Polish RSO notices and RCB Alerts, the media and flight trackers. It is hard to tell quickly whether an event concerns your region, and single unconfirmed reports easily cause alarm. Zorya collects these signals, puts them in order, and shows clearly where each piece of information comes from and how certain it is.",
    },
    { t: "h2", text: "How it works" },
    { t: "p", text: "**1. Collection.** Every 60 seconds the server pulls data from open, public sources only:" },
    {
      t: "ul",
      items: [
        "**NEPTUN** (neptun.in.ua): OSINT-based tracking of aerial threats over Ukraine (Shahed-type drones, missiles, aircraft). This is not radar data.",
        "**Air-raid alerts in Ukrainian oblasts**, fetched via NEPTUN.",
        "**ADS-B** (adsb.lol): aircraft over Poland that broadcast their own position, including aircraft that service flags as military near the eastern flank.",
        "**RSO / RCB Alert** (komunikaty.tvp.pl): Polish official notices about air threats.",
        "**Media**: RMF24 and PAP RSS feeds, filtered for air-threat content. Drills, smog and traffic news are discarded.",
      ],
    },
    { t: "p", text: "Each source has its own health indicator. Data older than 15 minutes is ignored." },
    {
      t: "p",
      text: "**2. Assessment.** For each of Poland's 16 voivodeships, Zorya scores a rolling 60-minute window. The score takes into account object type, distance from the Polish border, heading relative to Poland, the age and quality of the location, the confidence and confirmation count reported by the source, alerts in Ukrainian oblasts near the border, and media reports. An official air-threat notice for a voivodeship sets the highest level immediately. Objects more than 250 km from the border are displayed but not scored. The map shows three states: calm, **watch** and **priority**.",
    },
    {
      t: "p",
      text: "**3. Live map.** It shows voivodeships coloured by level, Ukrainian oblasts with active alerts, NEPTUN objects with a location-uncertainty circle and track, and ADS-B aircraft. You can zoom out to see the whole region: Poland, Ukraine and the Baltic states. Basemap: OpenFreeMap / OpenStreetMap.",
    },
    {
      t: "p",
      text: "**4. Archive.** Every NEPTUN drone or Shahed track is kept in a local archive for 180 days and then deleted automatically. The archive is not public and can be read only from the server's local network. It is used to analyse patterns, such as when and where threats most often approach the border.",
    },
    { t: "h2", text: "Who it is for" },
    {
      t: "ul",
      items: [
        "People in Poland, especially the eastern voivodeships, who want to check quickly whether something is happening in their region.",
        "People with family in Ukraine who follow the situation across the border.",
        "Journalists, local officials, emergency-management staff and researchers who need an orderly picture from open sources.",
      ],
    },
    { t: "h2", text: "Principles" },
    {
      t: "ul",
      items: [
        "**Non-commercial.** No ads, no selling of data. A project of the Terra Incognita Foundation (registration in the Polish National Court Register, KRS, is in progress).",
        "**Open sources only.** Zorya shows only information that is already public, and always says where it came from.",
        "**Privacy.** No accounts, cookies or ads, and no third-party scripts. Fonts are self-hosted.",
        "**OPSEC.** Zorya has no sensors of its own. It does not publish positions of Polish or allied forces, locations of critical infrastructure, or any operational data. It adds nothing that is not already in open sources.",
        "**Open code.** The source code is on GitHub: github.com/mhalaba/zorya.",
        "**Infrastructure.** The server runs in Poland. Traffic to the site passes through Cloudflare.",
      ],
    },
    { t: "h2", text: "Limitations: read before you rely on it" },
    {
      t: "warn",
      text: "**Zorya is not an official warning system.** It does not replace sirens, RCB Alerts, RSO or official announcements. In a threat, follow the authorities' instructions, and in an emergency call 112.",
    },
    {
      t: "ul",
      items: [
        "NEPTUN data comes from OSINT, not radar. Positions are approximate (hence the uncertainty circles) and may be delayed, incomplete or wrong.",
        "Zorya has no access to Polish or NATO radar data.",
        "The watch and priority levels come from a simple, published heuristic, not a military assessment.",
        "A source may go down. Its indicator then goes dark and the assessment relies on the others.",
      ],
    },
    { t: "h2", text: "Author and contact" },
    { t: "p", text: "Built by **Matthew Halaba**." },
    { t: "p", text: "Contact: **m@zorya.website**" },
    { t: "p", text: "Code: github.com/mhalaba/zorya" },
  ],
};

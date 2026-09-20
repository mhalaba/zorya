#!/usr/bin/env python3
"""build-screens.py — writes the HTML mockups under 04-ux/screens/ (app at 390 px, website at 1280 px).
They are references for the build, not the build: every value comes from 02-tokens/tokens.css and screens/mock.css.
Run from the package root: python3 tools/build-screens.py"""
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '04-ux/screens'); os.makedirs(OUT, exist_ok=True)
LOGO = os.path.join(ROOT, '03-logo')

def inner(name):
    s = open(os.path.join(LOGO, name), encoding='utf-8').read()
    vb = s.split('viewBox="')[1].split('"')[0]
    body = s.split('</title>')[1].rsplit('</svg>', 1)[0].strip()
    return vb, body

def level_svg(level, cls='lv'):
    vb, body = inner(f'level-{level}.svg')
    return f'<svg class="{cls}" viewBox="{vb}" fill="currentColor" aria-hidden="true">{body}</svg>'

def mark_svg(cls=''):
    vb, body = inner('zorya-mark-mono.svg')
    return f'<svg class="{cls}" viewBox="{vb}" fill="currentColor" aria-hidden="true">{body}</svg>'

ICONS = {
    'horyzont': '<path d="M3 15h18M15 8a2.5 2.5 0 1 1-.01 0"/>',
    'mapa': '<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
    'sygnaly': '<path d="M4 18v-5M9 18V6M14 18v-8M19 18V3"/>',
    'zglos': '<path d="M12 5v14M5 12h14"/>',
    'wiecej': '<path d="M4 7h16M4 12h16M4 17h16"/>',
}
def nav(active):
    items = [('horyzont', 'Horyzont'), ('mapa', 'Mapa'), ('sygnaly', 'Sygnały'), ('zglos', 'Zgłoś'), ('wiecej', 'Więcej')]
    return '<nav class="nav" aria-label="Główna nawigacja">' + ''.join(
        f'<a href="#" class="{"on" if k == active else ""}" {"aria-current=page" if k == active else ""}><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[k]}</svg>{lbl}</a>' for k, lbl in items) + '</nav>'

def header(level='cisza', region='Brzegowo'):
    return f'''<header class="hdr lvl-{level}">
  <a class="brand" href="#" aria-label="Zorya, strona główna">{mark_svg()}<span class="wm">Zorya</span></a>
  <button class="chip" aria-haspopup="listbox" aria-label="Obszar: {region}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/></svg>{region}</button>
</header>'''

def page(title, body, theme='noc', width=390, css_extra=''):
    return f'''<!doctype html>
<html lang="pl" data-theme="{theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Zorya (makieta)</title>
<link rel="stylesheet" href="../../02-tokens/tokens.css">
<link rel="stylesheet" href="mock.css">
<style>body {{ background: var(--z-bg); }} {css_extra}</style>
</head>
<body>
{body}
</body>
</html>
'''

def status_bar(): return '<div class="status-bar" aria-hidden="true"><span>05:41</span><span>LTE · 4/4</span></div>'

def card(level, badge, title, where, when, conf, conf_label, sources):
    return f'''<a class="card lvl-{level}" href="#">
  <div class="top">{level_svg(level)}<span class="badge">{badge}</span><span class="when">{when}</span></div>
  <h3>{title}</h3>
  <div class="where">{where}</div>
  <div class="src">{''.join(f'<span class="s">{s}</span>' for s in sources)}</div>
  <div class="conf {conf}"><i></i>{conf_label}</div>
</a>'''

def sig(t, m, k):
    return f'<div class="sig"><span class="t">{t}</span><span class="m">{m}</span><span class="k">{k}</span></div>'

# ---------------------------------------------------------------- 1. Horyzont (home, watch level)
body = f'''<div class="phone">
{status_bar()}
{header('obserwacja')}
<main>
  <section class="status" aria-live="polite">
    <span class="lvl-obserwacja">{level_svg('obserwacja', 'star')}</span>
    <div>
      <div class="word lvl-obserwacja">Obserwacja</div>
      <div class="meta">1 zdarzenie w Twoich obszarach · od <span class="mono">04:52</span><br>Źródła: 6 z 6 aktywnych · ostatnie dane <span class="mono">05:40</span></div>
    </div>
  </section>
  <div class="eyebrow"><span class="z-label">Zdarzenia</span><a href="#">Wszystkie obszary</a></div>
  {card('obserwacja', 'obserwacja', 'Ostrzeżenie IMGW: silny wiatr, 2. stopnia', 'powiat brzegowski · do 21.09, 06:00', '04:52', 'prawdopodobne', 'prawdopodobne · 1 źródło oficjalne', ['IMGW', 'RCB'])}
  <div class="horizon" data-label="Horyzont"></div>
  <div class="eyebrow"><span class="z-label">Sygnały pod horyzontem</span><a href="#">Filtruj</a></div>
  {sig('Czujnik akustyczny nr 3: sygnał ciągły 41 s', '05:12', 'syreny · Nadwiśle · brak drugiego źródła · zgodne z harmonogramem prób: nie')}
  {sig('ADS-B: statek powietrzny bez identyfikatora, 300 m AGL', '05:03', 'SDR · 6 km na wschód od Brzegowa · trwa 4 min')}
  {sig('Zgłoszenie: „huk, drżą szyby"', '04:58', 'zgłoszenie · Zaborów · niezweryfikowane')}
  {sig('Próba syren zapowiedziana na 12:00', '04:00', 'PSP · powiat brzegowski · komunikat planowy')}
</main>
{nav('horyzont')}
</div>'''
open(os.path.join(OUT, 'app-01-horyzont.html'), 'w', encoding='utf-8').write(page('Horyzont', body))

# ---------------------------------------------------------------- 2. Horyzont in alarm
body = f'''<div class="phone">
{status_bar()}
{header('alarm')}
<main>
  <section class="status" aria-live="assertive">
    <span class="lvl-alarm">{level_svg('alarm', 'star')}</span>
    <div>
      <div class="word lvl-alarm">Alarm</div>
      <div class="meta">Alarm RCB dla Twojego obszaru · od <span class="mono">05:37</span><br>Syrena potwierdzona przez czujnik nr 3</div>
    </div>
  </section>
  <div class="eyebrow"><span class="z-label">Zdarzenia</span></div>
  {card('alarm', 'alarm', 'Alert RCB: zagrożenie powietrzne. Udaj się do schronu', 'gmina Brzegowo · trwa', '05:37', 'potwierdzone', 'potwierdzone · RCB + czujnik', ['RCB', 'syreny', 'SDR'])}
  <div class="row"><a class="btn primary block" href="#">Co robić teraz</a></div>
  <div style="height:12px"></div>
  {card('obserwacja', 'obserwacja', 'Ostrzeżenie IMGW: silny wiatr, 2. stopnia', 'powiat brzegowski · do 21.09, 06:00', '04:52', 'prawdopodobne', 'prawdopodobne · 1 źródło oficjalne', ['IMGW'])}
  <div class="horizon" data-label="Horyzont"></div>
  {sig('ADS-B: 3 statki powietrzne bez identyfikatora', '05:36', 'SDR · kurs zachodni · wysokość 200–400 m AGL')}
  {sig('Zgłoszenia: 14 w ciągu 6 min', '05:38', 'zgłoszenia · Brzegowo, Zaborów · „syrena", „huk"')}
</main>
{nav('horyzont')}
</div>'''
open(os.path.join(OUT, 'app-02-horyzont-alarm.html'), 'w', encoding='utf-8').write(page('Horyzont — alarm', body))

# ---------------------------------------------------------------- 3. Event detail
body = f'''<div class="phone">
{status_bar()}
{header('alarm')}
<main class="detail">
  <div class="top" style="display:flex;align-items:center;gap:8px"><span class="lvl-alarm" style="display:inline-flex">{level_svg('alarm')}</span><span class="badge z-label lvl-alarm">alarm</span><span class="when" style="margin-left:auto;font-family:var(--z-font-mono);font-size:13px;color:var(--z-text-2)">ID 2026-0920-017</span></div>
  <h1>Alert RCB: zagrożenie powietrzne</h1>
  <dl class="kv">
    <dt>Obszar</dt><dd>gmina Brzegowo, gmina Nadwiśle</dd>
    <dt>Od</dt><dd class="mono">2026-09-20 05:37</dd>
    <dt>Stan</dt><dd>trwa · ostatnia aktualizacja <span class="mono">05:40</span></dd>
    <dt>Pewność</dt><dd><span class="conf potwierdzone" style="display:inline-flex;align-items:center;gap:8px"><i style="display:inline-block;width:40px;border-top:2px solid currentColor"></i>potwierdzone</span></dd>
  </dl>
  <section class="box">
    <h2>Co robić</h2>
    <ol>
      <li>Wejdź do budynku, najlepiej do piwnicy albo pomieszczenia bez okien.</li>
      <li>Trzymaj się z dala od okien. Nie wychodź, dopóki nie zobaczysz odwołania.</li>
      <li>Telefon w trybie oszczędzania energii. Zorya powiadomi o odwołaniu.</li>
    </ol>
  </section>
  <section class="box">
    <h2>Skąd to wiemy</h2>
    <ul class="tl" style="padding:0;margin:0">
      <li><span class="t">05:37:04</span><span>Alert RCB dla powiatu brzegowskiego<br><span class="s">RCB · SMS cell broadcast · treść oryginalna w źródle</span></span></li>
      <li><span class="t">05:37:31</span><span>Syrena: sygnał modulowany 3 min<br><span class="s">czujnik akustyczny nr 3, Nadwiśle · 96 dB · nie jest próbą planową</span></span></li>
      <li><span class="t">05:36:10</span><span>3 statki powietrzne bez identyfikatora<br><span class="s">SDR/ADS-B · 200–400 m AGL · kurs 270°</span></span></li>
      <li><span class="t">05:38–05:44</span><span>14 zgłoszeń użytkowników<br><span class="s">zgłoszenia · „syrena" ×9, „huk" ×5 · niezweryfikowane, nie liczone do poziomu</span></span></li>
    </ul>
  </section>
  <div class="row" style="padding:0"><a class="btn" href="#" style="flex:1">Udostępnij</a><a class="btn" href="#" style="flex:1">Wycisz na 1 h</a></div>
  <p class="note">Poziom alarm nie podlega cichym godzinom. Wyciszenie dotyczy tylko powtórzeń tego zdarzenia.</p>
</main>
{nav('horyzont')}
</div>'''
open(os.path.join(OUT, 'app-03-zdarzenie.html'), 'w', encoding='utf-8').write(page('Zdarzenie', body))

# ---------------------------------------------------------------- 4. Map
vb, north = inner('level-obserwacja.svg')
body = f'''<div class="phone">
{status_bar()}
{header('obserwacja')}
<main class="map" aria-label="Mapa zdarzeń i czujników">
  <svg class="base" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="390" height="560" fill="var(--z-map-land)"/>
    <path d="M0 380 C 60 350, 120 420, 200 400 S 330 330, 390 360 L390 560 L0 560 Z" fill="var(--z-map-water)"/>
    <g stroke="var(--z-map-roads)" stroke-width="1.5" fill="none">
      <path d="M0 120 L390 90"/><path d="M60 0 L140 560"/><path d="M0 250 C 100 240, 200 300, 390 260"/><path d="M250 0 L300 380"/>
    </g>
    <g stroke="var(--z-map-boundary)" stroke-width="1" stroke-dasharray="4 3" fill="none">
      <path d="M0 200 L90 180 L170 220 L260 170 L390 190"/><path d="M170 220 L190 380"/>
    </g>
    <g fill="var(--z-status-obserwacja)" fill-opacity="{json.load(open(os.path.join(ROOT,'02-tokens/tokens.json')))['color']['semantic']['map-area-alpha']['noc']}" stroke="var(--z-status-obserwacja)" stroke-width="1.5">
      <path d="M40 150 L120 110 L230 140 L240 230 L150 290 L60 250 Z"/>
    </g>
    <g fill="var(--z-status-obserwacja)"><circle cx="150" cy="200" r="6"/></g>
    <g stroke="var(--z-line-strong)" stroke-width="1.5" fill="var(--z-bg-raised)">
      <rect x="292" y="300" width="10" height="10"/><rect x="88" y="330" width="10" height="10"/><rect x="200" y="60" width="10" height="10"/>
    </g>
    <g fill="var(--z-status-alarm)"><circle cx="297" cy="305" r="0"/></g>
    <g font-family="var(--z-font-ui)" font-size="12" fill="var(--z-text-2)">
      <text x="150" y="222" text-anchor="middle" font-weight="700" fill="var(--z-text)">Brzegowo</text>
      <text x="300" y="325" text-anchor="middle">Nadwiśle</text><text x="96" y="356" text-anchor="middle">Zaborów</text>
      <text x="205" y="52" text-anchor="middle">czujnik 1</text>
    </g>
  </svg>
  <div class="map-chips"><button class="chip on">Zdarzenia</button><button class="chip">Czujniki</button><button class="chip">Obszary</button></div>
  <svg class="map-north" viewBox="0 0 14 32" aria-label="Północ"><text x="7" y="9" text-anchor="middle" font-size="9" font-weight="700" fill="var(--z-text)" font-family="var(--z-font-ui)">N</text><path d="M7 12 L10 24 L4 24 Z" fill="var(--z-text)"/><path d="M4 26 L10 26 L7 32 Z" fill="var(--z-text-2)"/></svg>
  <div class="legend" aria-label="Legenda">
    <div><i class="dot" style="background:var(--z-status-obserwacja);border-color:var(--z-status-obserwacja)"></i>zdarzenie · obserwacja</div>
    <div><i style="border-color:var(--z-status-obserwacja);background:color-mix(in srgb, var(--z-status-obserwacja) 18%, transparent)"></i>obszar zdarzenia</div>
    <div><i style="border-color:var(--z-line-strong)"></i>czujnik akustyczny</div>
    <div><i style="border:0;border-top:1px dashed var(--z-line-strong);height:0"></i>granica gminy</div>
  </div>
</main>
{nav('mapa')}
</div>'''
open(os.path.join(OUT, 'app-04-mapa.html'), 'w', encoding='utf-8').write(page('Mapa', body))

# ---------------------------------------------------------------- 5. Sources
def li(t, d, r, health='ok'):
    return f'<div class="li"><span class="t">{t}</span><span class="d">{d}</span><span class="r health {health}"><b></b>{r}</span></div>'
body = f'''<div class="phone">
{status_bar()}
{header('obserwacja')}
<main>
  <h1 class="screen">Sygnały</h1>
  <p class="note" style="padding:0 16px 8px">Sześć źródeł. Poziom horyzontu liczy się z tych, które mają dane nie starsze niż 15 minut.</p>
  <div class="list">
    {li('RCB — Alert RCB', 'komunikaty cell broadcast · region: 2 powiaty', '05:40')}
    {li('IMGW — ostrzeżenia meteo', 'ostrzeżenia 1–3 stopnia · hydro i meteo', '05:30')}
    {li('PSP — komunikaty', 'straż pożarna · próby syren, zdarzenia', '04:00')}
    {li('Syreny — czujniki akustyczne', '3 czujniki · Nadwiśle, Zaborów, Brzegowo', '05:41')}
    {li('SDR / ADS-B', 'odbiornik 1090 MHz + skaner 433 i 868 MHz', '05:41')}
    {li('Zgłoszenia użytkowników', '14 w ostatniej godzinie · 0 zweryfikowanych', '05:38', 'warn')}
    {li('Radio publiczne (RDS/EWS)', 'wyłączone przez Ciebie', 'wył.', 'off')}
  </div>
  <div class="eyebrow"><span class="z-label">Jak liczymy poziom</span></div>
  <p class="note" style="padding:0 16px 16px">Jedno źródło to obserwacja. Dwa niezależne źródła albo oficjalne ostrzeżenie dla Twojego obszaru to ostrzeżenie. Alarm RCB albo syrena potwierdzona drugim źródłem to alarm. Zgłoszenia użytkowników nigdy same nie podnoszą poziomu.</p>
</main>
{nav('sygnaly')}
</div>'''
open(os.path.join(OUT, 'app-05-sygnaly.html'), 'w', encoding='utf-8').write(page('Sygnały', body))

# ---------------------------------------------------------------- 6. Report
body = f'''<div class="phone">
{status_bar()}
{header('obserwacja')}
<main>
  <h1 class="screen">Zgłoś</h1>
  <p class="note" style="padding:0 16px 16px">Co słyszysz albo widzisz. Bez interpretacji. Zgłoszenie trafia pod horyzont i liczy się dopiero po potwierdzeniu innym źródłem.</p>
  <form class="form">
    <div class="field"><label>Co</label><div class="seg"><span class="on">Syrena</span><span>Huk / wybuch</span><span>Dron / samolot</span></div><div class="seg" style="margin-top:-1px"><span>Dym / pożar</span><span>Brak prądu</span><span>Inne</span></div></div>
    <div class="field"><label>Gdzie</label><div class="in">Brzegowo, ul. Polna — z lokalizacji telefonu</div></div>
    <div class="field"><label>Kiedy</label><div class="in mono">2026-09-20 05:39 — teraz</div></div>
    <div class="field"><label>Opis (opcjonalnie)</label><div class="in ph">Np. „sygnał ciągły, około minuty"</div></div>
    <div class="field"><label>Zdjęcie lub nagranie (opcjonalnie)</label><div class="in ph">Dodaj plik · metadane lokalizacji zostaną usunięte</div></div>
    <p class="note">Nie zbieramy numeru telefonu. Zgłoszenie jest anonimowe, a lokalizację zaokrąglamy do 500 m. Możesz je wycofać przez 10 minut.</p>
    <a class="btn primary block" href="#">Wyślij zgłoszenie</a>
  </form>
</main>
{nav('zglos')}
</div>'''
open(os.path.join(OUT, 'app-06-zglos.html'), 'w', encoding='utf-8').write(page('Zgłoś', body))

# ---------------------------------------------------------------- 7. Settings (light theme to show dzień)
def tog(t, d, on=True):
    return f'<div class="li"><span class="t">{t}</span><span class="d">{d}</span><span class="toggle {"on" if on else ""}" role="switch" aria-checked="{"true" if on else "false"}"><i></i></span></div>'
body = f'''<div class="phone">
{status_bar()}
{header('cisza')}
<main>
  <h1 class="screen">Ustawienia</h1>
  <div class="eyebrow"><span class="z-label">Obszary</span><a href="#">Dodaj</a></div>
  <div class="list">
    <div class="li"><span class="t">Brzegowo</span><span class="d">gmina · dom</span><span class="r">główny</span></div>
    <div class="li"><span class="t">powiat brzegowski</span><span class="d">powiat · praca</span><span class="r"></span></div>
  </div>
  <div class="eyebrow"><span class="z-label">Powiadomienia</span></div>
  <div class="list">
    {tog('Alarm', 'zawsze, z dźwiękiem, także w cichych godzinach', True)}
    {tog('Ostrzeżenie', 'z dźwiękiem poza cichymi godzinami', True)}
    {tog('Obserwacja', 'bez dźwięku, tylko na liście', False)}
    {tog('Odwołanie', 'powiadomienie, gdy zdarzenie się kończy', True)}
    <div class="li"><span class="t">Ciche godziny</span><span class="d">nie dotyczy poziomu alarm</span><span class="r">22:00–06:00</span></div>
  </div>
  <div class="eyebrow"><span class="z-label">Źródła</span></div>
  <div class="list">
    {tog('Zgłoszenia użytkowników', 'pokazuj pod horyzontem', True)}
    {tog('Radio publiczne (RDS/EWS)', 'wymaga odbiornika', False)}
  </div>
  <div class="eyebrow"><span class="z-label">Dostępność</span></div>
  <div class="list">
    <div class="li"><span class="t">Motyw</span><span class="d">noc · dzień · systemowy</span><span class="r">dzień</span></div>
    <div class="li"><span class="t">Rozmiar tekstu</span><span class="d">podąża za systemem, do 200 %</span><span class="r">100 %</span></div>
    {tog('Ogranicz ruch', 'wyłącza pulsowanie gwiazdy w alarmie', False)}
  </div>
</main>
{nav('wiecej')}
</div>'''
open(os.path.join(OUT, 'app-07-ustawienia.html'), 'w', encoding='utf-8').write(page('Ustawienia', body, theme='dzien'))

# ---------------------------------------------------------------- 8. Website landing (desktop)
vb_l, lock = inner('zorya-lockup-h-mono.svg')
vb_m, mark_only = inner('zorya-mark-mono.svg')
landing_css = '''
.site { max-width: var(--z-size-site-column); margin: 0 auto; padding: 0 var(--z-space-8); }
.top { height: 72px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--z-line-strong); }
.top .brand svg { height: 24px; }
.top nav { display: flex; gap: var(--z-space-8); font-size: 15px; }
.top nav a { text-decoration: none; }
.hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: var(--z-space-16); padding: var(--z-space-20) 0 var(--z-space-16); align-items: center; }
.hero h1 { margin: 0 0 var(--z-space-6); max-width: 14ch; }
.hero p { font-size: 20px; line-height: 30px; max-width: 42ch; color: var(--z-text-2); margin: 0 0 var(--z-space-8); }
.hero .cta { display: flex; gap: var(--z-space-3); }
.demo { border: 1px solid var(--z-line-strong); background: var(--z-bg-raised); padding: var(--z-space-6); display: grid; gap: var(--z-space-4); }
.demo .st { display: grid; grid-template-columns: 56px 1fr; gap: var(--z-space-4); align-items: center; padding-bottom: var(--z-space-4); border-bottom: 2px solid var(--z-status-obserwacja); }
.demo .st svg { width: 56px; }
.demo .st .w { font-size: 28px; line-height: 34px; font-weight: 700; }
.demo .st .m { color: var(--z-text-2); font-size: 14px; }
.demo .ev { display: grid; gap: 6px; font-size: 15px; line-height: 22px; }
.demo .ev .k { display: flex; gap: 8px; align-items: center; color: var(--z-text-2); font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
.demo .ev .k svg { width: 24px; }
.demo .sub { border-top: 1px dashed var(--z-line-strong); padding-top: var(--z-space-3); color: var(--z-text-2); font-size: 14px; display: grid; gap: 4px; }
.demo .sub .mono { font-family: var(--z-font-mono); font-weight: 500; }
.band { border-top: 2px solid var(--z-line-strong); padding: var(--z-space-16) 0; }
.band h2 { margin: 0 0 var(--z-space-8); font-size: 13px; line-height: 18px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; color: var(--z-text-2); }
.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--z-space-8); }
.three h3 { margin: 0 0 var(--z-space-3); font-size: 22px; line-height: 28px; }
.three p { margin: 0; color: var(--z-text-2); max-width: 36ch; }
.how { display: grid; grid-template-columns: 1fr 1fr; gap: var(--z-space-16); align-items: center; }
.how p { max-width: 48ch; color: var(--z-text-2); }
.levels { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--z-space-4); }
.levels div { border: 1px solid var(--z-line-strong); padding: var(--z-space-4); display: grid; gap: var(--z-space-3); }
.levels svg { width: 48px; }
.levels b { font-size: 17px; }
.levels small { font-size: 14px; line-height: 20px; color: var(--z-text-2); }
.srcs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid var(--z-line-strong); }
.srcs div { padding: var(--z-space-5); border-right: 1px solid var(--z-line-strong); display: grid; gap: 4px; }
.srcs div:last-child { border-right: 0; }
.srcs b { font-size: 17px; } .srcs span { font-size: 14px; line-height: 20px; color: var(--z-text-2); }
footer.site-foot { border-top: 2px solid var(--z-line-strong); padding: var(--z-space-8) 0 var(--z-space-12); display: flex; justify-content: space-between; align-items: flex-start; font-size: 14px; color: var(--z-text-2); gap: var(--z-space-8); }
footer.site-foot .lk { display: grid; gap: 4px; }
footer.site-foot .lk a { text-decoration: none; }
.horizon-diagram { border: 1px solid var(--z-line-strong); padding: var(--z-space-6); }
.horizon-diagram svg { width: 100%; height: auto; display: block; }
'''
body = f'''<div class="site">
<header class="top">
  <a class="brand" href="#" aria-label="Zorya"><svg viewBox="{vb_l}" fill="currentColor" aria-hidden="true">{lock}</svg></a>
  <nav aria-label="Menu"><a href="#jak">Jak działa</a><a href="#zrodla">Źródła</a><a href="#prywatnosc">Prywatność</a><a href="#status">Status</a><a class="btn" href="#" style="height:40px">Otwórz aplikację</a></nav>
</header>
<section class="hero">
  <div>
    <h1 class="z-display">Zorya czuwa, kiedy Ty śpisz.</h1>
    <p>Jedna aplikacja zbiera alerty RCB, ostrzeżenia IMGW, komunikaty straży, czujniki syren, radio i zgłoszenia sąsiadów. Łączy je w jeden poziom dla Twojej gminy i mówi, co robić. Bez chmury dużych firm, bez śledzenia.</p>
    <div class="cta"><a class="btn primary" href="#">Otwórz aplikację</a><a class="btn" href="#jak">Jak liczymy poziom</a></div>
  </div>
  <div class="demo" aria-label="Przykładowy ekran">
    <div class="st"><span class="lvl-obserwacja">{level_svg('obserwacja')}</span><div><div class="w lvl-obserwacja">Obserwacja</div><div class="m">gmina Brzegowo · od 04:52 · 6 z 6 źródeł aktywnych</div></div></div>
    <div class="ev"><div class="k"><span class="lvl-obserwacja">{level_svg('obserwacja')}</span>obserwacja · 04:52</div><b>Ostrzeżenie IMGW: silny wiatr, 2. stopnia</b><span style="color:var(--z-text-2)">powiat brzegowski · do 21.09, 06:00 · prawdopodobne</span></div>
    <div class="sub"><span><span class="mono">05:12</span> czujnik akustyczny nr 3: sygnał ciągły 41 s · brak drugiego źródła</span><span><span class="mono">05:03</span> ADS-B: statek powietrzny bez identyfikatora, 300 m AGL</span></div>
  </div>
</section>
<section class="band" id="jak">
  <h2>Jak działa</h2>
  <div class="three">
    <div><h3>Zbiera</h3><p>Sześć źródeł, każde z własnym znacznikiem czasu i stanem. Oficjalne komunikaty, czujniki, radio, zgłoszenia.</p></div>
    <div><h3>Łączy</h3><p>Dwa niezależne źródła mówiące o tym samym miejscu i czasie to jedno zdarzenie. Jedno źródło zostaje pod horyzontem.</p></div>
    <div><h3>Mówi, co robić</h3><p>Pięć poziomów, jedno słowo każdy. Przy alarmie trzy kroki, nie artykuł. Odwołanie też jest powiadomieniem.</p></div>
  </div>
</section>
<section class="band">
  <h2>Pięć poziomów horyzontu</h2>
  <div class="levels">
    <div><span class="lvl-cisza">{level_svg('cisza')}</span><b>cisza</b><small>Nic się nie dzieje. Wszystkie źródła raportują.</small></div>
    <div><span class="lvl-obserwacja">{level_svg('obserwacja')}</span><b>obserwacja</b><small>Jeden sygnał albo komunikat bez lokalnego potwierdzenia. Przeczytaj.</small></div>
    <div><span class="lvl-ostrzezenie">{level_svg('ostrzezenie')}</span><b>ostrzeżenie</b><small>Dwa źródła się zgadzają albo oficjalne ostrzeżenie dla Twojej gminy. Przygotuj się.</small></div>
    <div><span class="lvl-alarm">{level_svg('alarm')}</span><b>alarm</b><small>Alarm RCB albo syrena potwierdzona drugim źródłem. Działaj.</small></div>
    <div><span class="lvl-odwolanie">{level_svg('odwolanie')}</span><b>odwołanie</b><small>Zdarzenie odwołane lub wygasło. Po godzinie wracamy do ciszy.</small></div>
  </div>
</section>
<section class="band" id="zrodla">
  <h2>Źródła</h2>
  <div class="srcs">
    <div><b>Oficjalne</b><span>Alert RCB, ostrzeżenia IMGW, komunikaty PSP. Treść oryginalna zawsze pod ręką.</span></div>
    <div><b>Syreny</b><span>Czujniki akustyczne rozpoznają sygnał i odróżniają próbę od alarmu.</span></div>
    <div><b>Radio i powietrze</b><span>ADS-B, skaner 433 i 868 MHz, radio publiczne. Sygnał bez identyfikatora to sygnał, nie wyrok.</span></div>
    <div><b>Sąsiedzi</b><span>Anonimowe zgłoszenia, zaokrąglone do 500 m. Same nigdy nie podnoszą poziomu.</span></div>
  </div>
</section>
<section class="band" id="prywatnosc">
  <div class="how">
    <div><h2>Prywatność</h2><p style="font-size:20px;line-height:30px;color:var(--z-text)">Zorya nie ma konta, nie ma numeru telefonu i nie ma reklam. Lokalizacja zostaje na telefonie; serwer dostaje tylko nazwę gminy. Serwer stoi w Polsce, kod jest otwarty.</p></div>
    <div class="horizon-diagram" aria-hidden="true">
      <svg viewBox="0 0 520 200">
        <text x="0" y="16" font-size="12" letter-spacing="1" fill="var(--z-text-2)" font-family="var(--z-font-ui)">NAD HORYZONTEM · ZDARZENIA</text>
        <rect x="0" y="30" width="520" height="44" fill="var(--z-bg-raised)" stroke="var(--z-status-obserwacja)"/>
        <circle cx="24" cy="52" r="6" fill="var(--z-status-obserwacja)"/><text x="40" y="57" font-size="14" fill="var(--z-text)" font-family="var(--z-font-ui)" font-weight="700">Ostrzeżenie IMGW: silny wiatr</text>
        <rect x="0" y="98" width="520" height="2" fill="var(--z-line-strong)"/>
        <text x="520" y="118" text-anchor="end" font-size="12" letter-spacing="1" fill="var(--z-text-2)" font-family="var(--z-font-ui)">HORYZONT</text>
        <g font-size="13" fill="var(--z-text-2)" font-family="var(--z-font-ui)">
          <line x1="0" y1="140" x2="520" y2="140" stroke="var(--z-line-strong)" stroke-dasharray="4 3"/><text x="0" y="135">czujnik nr 3 · sygnał ciągły 41 s</text>
          <line x1="0" y1="170" x2="520" y2="170" stroke="var(--z-line-strong)" stroke-dasharray="4 3"/><text x="0" y="165">ADS-B · bez identyfikatora · 300 m AGL</text>
          <line x1="0" y1="198" x2="520" y2="198" stroke="var(--z-line-strong)" stroke-dasharray="1 3"/><text x="0" y="193">zgłoszenie · „huk" · niezweryfikowane</text>
        </g>
      </svg>
    </div>
  </div>
</section>
<footer class="site-foot" id="status">
  <div><svg viewBox="{vb_m}" fill="currentColor" style="height:28px" aria-hidden="true">{mark_only}</svg><div style="margin-top:12px">Zorya · czuwanie świtu · wersja 0.1 · stan na <span style="font-family:var(--z-font-mono)">2026-09-20</span></div><div>Status źródeł: 6 z 6 · ostatnia aktualizacja <span style="font-family:var(--z-font-mono)">05:41</span></div></div>
  <div class="lk"><a href="#">Jak działa</a><a href="#">Źródła danych i licencje</a><a href="#">Polityka prywatności</a><a href="#">Kod źródłowy</a><a href="#">Kontakt</a></div>
</footer>
</div>'''
open(os.path.join(OUT, 'www-01-landing.html'), 'w', encoding='utf-8').write(page('zorya.website', body, width=1280, css_extra=landing_css))
print('screens written')

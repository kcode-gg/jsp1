# Gym Tracker

Eigenständiges Gym-Tracking-Modul ohne Abhängigkeiten und ohne Build-Schritt.
`index.html` öffnen und es läuft; Daten liegen im `localStorage`.

## Funktionen

- **Heute** – nächstes Training laut Plan, Wochenübersicht, Serie in Wochen, bewegtes Volumen
- **Training** – Sätze mit Gewicht/Wdh (vorbelegt vom letzten Mal), Pausen-Timer, Rekord-Erkennung, Scheibenrechner für Langhantel-Übungen
- **Verlauf** – alle abgeschlossenen Einheiten mit Sätzen
- **Fortschritt** – geschätztes 1RM pro Übung als Kurve
- **Plan** – Trainings und Übungen bearbeiten, Plan als Text einfügen (`Name 3x8-12`), Backup kopieren/einspielen

## In Main Quest einbinden

```html
<link rel="stylesheet" href="gym-tracker/gym-tracker.css">
<div id="gym" style="height: 100%"></div>
<script src="gym-tracker/gym-tracker.js"></script>
<script>
  const gym = GymTracker.mount(document.getElementById('gym'), {
    storageKey: 'mainquest.gym',
    onEvent(type, payload) {
      if (type === 'workout:finish') {
        // payload: { name, durationMin, volume, sets, prs, stats, session }
        // z. B. XP vergeben
      }
    }
  });
</script>
```

Der Container braucht eine feste Höhe (das Modul füllt 100 %).

| Option | Beschreibung |
| --- | --- |
| `storageKey` | Schlüssel für die gespeicherten Daten (Standard `gymtracker.v1`) |
| `storage` | Eigener Speicher `{ get(key), set(key, value) }`, z. B. für ein Backend |
| `onEvent(type, payload)` | `workout:finish`, `set:done`, `pr` |

Die Events werden zusätzlich als DOM-Events auf dem Container ausgelöst
(`gymtracker:workout:finish`, Daten in `event.detail`).

Rückgabe von `mount`: `getStats()` (Einheiten pro Woche, Serie, Volumen),
`getState()`, `setPlanFromText(text)`, `destroy()`.

In Bundler-Projekten: `const GymTracker = require('./gym-tracker.js')`.

## Nachtragen

Auf „Heute" lässt sich die Wochenleiste mit den Pfeilen zurückblättern. Ein Tipp auf einen
vergangenen Tag öffnet die Einträge dieses Tages und erlaubt, ein Training nachzutragen
(ohne Timer, mit frei wählbarer Dauer). Das Event `workout:finish` trägt dann `backfilled: true`.

## Wochenlogik

Der Standardplan zählt Wochen ab dem ersten Training. In Woche 1–2 legt die App
automatisch 2 Sätze pro Übung an und lässt Übungen mit der Markierung „Sprung oder
Wurf" weg; ab Woche 3 gilt der volle Plan. Im Tab „Plan" lässt sich die Zählung
zurücksetzen. Ein per Text eingefügter Plan läuft ohne diese Logik.

## Claude-Artifact

`python3 artifact/build.py out.html` baut eine einzelne Datei inklusive
`artifact/sync.js`, das die Daten im privaten Speicher des Claude-Kontos spiegelt
(Capabilities `db` und `user`).

## Aussehen anpassen

Alle Farben und Schriften sind CSS-Variablen mit Präfix `--gt-` (siehe Anfang von
`gym-tracker.css`) und lassen sich in der Host-App überschreiben. Hell/Dunkel folgt
dem System; `data-theme="dark"` bzw. `"light"` auf `<html>` erzwingt eins.

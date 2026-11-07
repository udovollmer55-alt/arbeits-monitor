# Erklärvideo: Robobert & Sepp – So läuft die Automation

3D-Motion-Graphics-Video für Oliver. Hochformat 9:16 (1080 × 1920), ca. 1:53 Minuten, 30 Bilder pro Sekunde.
Mit dabei: Robobert, Sepp und Papa Udo als gezeichnete 3D-Figuren (kein Foto).

## Dateien

| Datei | Wofür |
|---|---|
| `robobert-sepp-erklaervideo.mp4` | das fertige Video |
| `sprechertext.md` | alle Texte mit Zeitangaben, falls eine Stimme dazukommen soll |
| `index.html` + `main.js` + `chars.js` | die 3D-Szene (Quelltext des Videos) |
| `render.mjs` | baut aus der Szene die MP4-Datei |
| `lib/three.module.js` | 3D-Bibliothek Three.js (lokal abgelegt, braucht kein Internet) |

## Vorschau im Browser (ohne Rendern)

`index.html` über einen kleinen lokalen Server öffnen, z. B. im Ordner `erklaervideo`:

```
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000/` öffnen – das Video läuft in Echtzeit in Schleife.
Ein einzelnes Bild bei Sekunde 45: `http://localhost:8000/?t=45`.

## Video neu bauen

Voraussetzungen: Node.js, Playwright (mit Chromium) und ffmpeg.

```
node render.mjs video robobert-sepp-erklaervideo.mp4
node render.mjs still 45.5 bild.png              # nur ein Einzelbild
node render.mjs video test.mp4 --from 40 --to 46 # nur ein Ausschnitt
```

Das Rendern dauert etwa 15–20 Minuten (4 Prozessorkerne).

## Wo ändere ich was?

- **Texte der Sprechblasen und ihre Zeiten:** `CAPTIONS` in `main.js`.
- **Überschriften und Karten pro Szene:** `addScene({ ... })` in `main.js` (jede Szene = ein Block).
- **Töne (PLING, Wusch, Absturz, Stempel):** `CUES` in `main.js`; die Klänge selbst in `buildAudio` in `render.mjs`.
- **Figuren:** `chars.js`.
- **Farben:** nur Blau, Gelb und Grau – wie die Ampel in der Automation (Rot-Grün-sicher).

## Wichtig zum Inhalt

- Der Ablauf beruht auf der Beschreibung im Skill „Trend-Check Affiliate“ (Kreislauf, Prüfkriterien, Ampel, Status, Regeln, Szenen-Arten).
  Den Ordner `motion` auf Udos Laptop (dort liegt die Videobau-Anleitung) konnte ich nicht einsehen – Details zu Schritt 4 bitte gegenprüfen.
- **Beispieldaten:** Die sechs Kandidaten (Schritt 3) und die Klickzahlen (Schritt 6) sind ausgedachte Beispiele und im Video entsprechend beschriftet.
- Im Video kommen **keine Produktpreise** vor. Die Herstellkosten pro Video (Richtwerte aus dem Skill) sind interne Zahlen.
- Das Video ist eine **private Erklärung** für Oliver und kein Werbevideo. Für eine Veröffentlichung gelten die üblichen Regeln
  (Werbung kennzeichnen, KI-Kennzeichnung).
- Ton: nur Klangteppich und Soundeffekte, **keine gesprochene Stimme**. Die Texte stehen als Untertitel im Bild.

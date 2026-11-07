# Erklärvideo: Robobert & Sepp – So läuft die Automation

3D-Motion-Graphics-Video für Oliver. Hochformat 9:16 (1080 × 1920), 1:53 Minuten, 30 Bilder pro Sekunde.
Mit dabei: Robobert, Sepp und Papa Udo als gezeichnete 3D-Figuren (kein Foto).

## Dateien

| Datei | Wofür |
|---|---|
| `robobert-sepp-erklaervideo.mp4` | das fertige Video |
| `sprechertext.md` | alle Texte mit Zeitangaben, falls eine Stimme dazukommen soll |
| `index.html` + `main.js` + `chars.js` | die 3D-Szene (Quelltext des Videos) |
| `render.mjs` | baut aus der Szene die MP4-Datei (Bild und Ton) |
| `stimmen.py` | erzeugt die gesprochenen Stimmen (offline, deutsche Piper-Stimmen) |
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

## Stimmen (Sprachausgabe)

Die drei Figuren sprechen mit synthetischen deutschen Stimmen (Piper über `sherpa-onnx`, läuft offline):
Papa Udo = ruhige Männerstimme, Robobert = Roboterstimme mit Effekt, Sepp = tiefer, blecherner Toaster.
Einen bayerischen Dialekt kann die Sprachausgabe nicht – Sepp „spricht“ deshalb nur die bayerisch geschriebenen Wörter hochdeutsch aus.

```
pip install "sherpa-onnx==1.12.30" numpy
# Stimmen von https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models laden und entpacken:
#   vits-piper-de_DE-thorsten-medium, -karlsson-low, -pavoque-low  (je in einen Ordner gleichen Namens ohne Präfix)
python3 stimmen.py <modell-ordner> <stimmen-ordner>
node render.mjs video robobert-sepp-erklaervideo.mp4 --voices <stimmen-ordner>
```

Ein fertiges Video lässt sich auch nur neu vertonen: `node render.mjs audio ton.m4a --voices <stimmen-ordner>`, danach
`ffmpeg -i video.mp4 -i ton.m4a -map 0:v -map 1:a -c copy neu.mp4`. (Version 2.x von sherpa-onnx liest die Piper-Stimmen derzeit nicht, daher die feste Version.)

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
- Ton: Klangteppich, Soundeffekte und **synthetische Stimmen**. Die Texte stehen zusätzlich als Untertitel im Bild.
  Bei einer Veröffentlichung gilt die übliche KI-Kennzeichnung (KI-Stimmen und KI-Bilder).

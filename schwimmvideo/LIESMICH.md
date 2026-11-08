# Hendrik schwimmt! – Sportabzeichen im Hallenbad

3D-Motion-Graphics-Video für Hendrik (7) und Niklas (3). Hochformat 9:16 (1080 × 1920), 1:36 Minuten, 30 Bilder pro Sekunde, mit Stimmen.

**Handlung:** Hendrik schwimmt im Hallenbad für das Sportabzeichen – erst 25 m auf Zeit, dann 50 m ohne Zeitlimit,
aber ohne Pause (hin und zurück mit Wende). Niklas steht am Beckenrand und feuert ihn lautstark an.
Der Bademeister gibt das Startsignal und stoppt die Zeit. Zum Schluss gibt es die Medaille.

Alle Figuren sind gezeichnete 3D-Comicfiguren (keine Fotos): Hendrik mit blonden Haaren und Schwimmbrille,
Niklas mit dunklen Haaren, Badeshirt und gelber Badehose, der Bademeister in Weiß mit Stoppuhr und Pfeife.

## Dateien

| Datei | Wofür |
|---|---|
| `hendrik-schwimmt.mp4` | das fertige Video |
| `sprechertext.md` | alle Texte mit Zeitangaben |
| `index.html` + `main.js` | Hallenbad, Ablauf, Kameraschnitte, Anzeigetafel |
| `figuren.js` | Hendrik, Niklas und der Bademeister |
| `render.mjs` | baut aus der Szene die MP4-Datei (Bild und Ton) |
| `stimmen.py` | erzeugt die Stimmen (offline, deutsche Piper-Stimmen) |
| `lib/three.module.js` | 3D-Bibliothek Three.js |

## Neu bauen

Gleiches Verfahren wie beim Erklärvideo (siehe `../erklaervideo/LIESMICH.md`). Stimmen hier: `thorsten-medium` (Bademeister) und `kerstin-low` (Hendrik und Niklas, höher gestimmt).

```
python3 stimmen.py <modell-ordner> <stimmen-ordner>
node render.mjs video hendrik-schwimmt.mp4 --voices <stimmen-ordner>
node render.mjs still 30 bild.png      # nur ein Einzelbild
```

## Wo ändere ich was?

- **Texte und Zeiten:** `CAPTIONS` in `main.js` (danach `stimmen.py` neu laufen lassen).
- **Ablauf des Schwimmens** (Sprung, Bahnen, Wende, Ziel): Zeitwerte oben bei `T_JUMP`, `S1`, `S2`, `TURN`, `S3` in `main.js`.
- **Kameraschnitte:** `SHOTS` in `main.js`.
- **Aussehen der Kinder:** `makeHendrik()` und `makeNiklas()` in `figuren.js` (Haarfarbe, Badehose, Größe).

## Hinweise

- Eine echte Schwimmzeit wird bewusst nicht angezeigt (die Stoppuhr zeigt nur „Zeit läuft“ / „Zeit gestoppt“).
  Soll Hendriks echte Zeit hinein, lässt sie sich leicht ergänzen.
- Angenommen: Hendrik besteht beide Aufgaben.
- Die Stimmen sind synthetisch erzeugt (KI-Stimmen).

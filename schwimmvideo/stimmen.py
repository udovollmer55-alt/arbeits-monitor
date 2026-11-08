#!/usr/bin/env python3
"""
Erzeugt die gesprochenen Stimmen für das Schwimmvideo (offline, ohne Cloud-Dienst).

  python3 stimmen.py <modell-ordner> <ausgabe-ordner>

Erwartet im Modell-Ordner die entpackten deutschen Piper-Stimmen (sherpa-onnx):
  thorsten-medium/  kerstin-low/   (je mit Unterordner vits-piper-de_DE-...)
Quelle: https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models

Die Texte kommen aus CAPTIONS in main.js. Gesprochen wird die Schreibweise aus SPRECH
unten, damit die deutsche Stimme Zahlen und Rufe richtig ausspricht.

Ergebnis: <ausgabe>/NN_sprecher.wav und <ausgabe>/stimmen.json (Startzeit + Dauer je Zeile).
"""
import json, re, subprocess, sys, wave
from pathlib import Path

import numpy as np
import sherpa_onnx

hier = Path(__file__).parent
modelle, ausgabe = Path(sys.argv[1]), Path(sys.argv[2])
ausgabe.mkdir(parents=True, exist_ok=True)

# Stimme, Sprechtempo und Effekt je Figur. "hoch" = Tonhöhe (1.0 = unverändert).
# Kinderstimmen entstehen aus einer Frauenstimme, die höher gestimmt wird.
HALL = "aecho=0.8:0.55:55|90:0.22|0.12"   # Nachhall wie in einer Schwimmhalle
FIGUREN = {
    "bademeister": dict(modell="thorsten-medium", tempo=1.0, hoch=0.97, fx="highpass=f=80"),
    "hendrik": dict(modell="kerstin-low", tempo=1.02, hoch=1.18, fx="highpass=f=140"),
    "niklas": dict(modell="kerstin-low", tempo=1.06, hoch=1.38, fx="highpass=f=160,volume=1.3"),
}

# Aussprache-Anpassungen (Anzeige im Bild bleibt unverändert)
SPRECH = [
    (r"HEN-DRIK", "Hen drik"),
    (r"HURRAAA", "Hurraaa"),
    (r"\bHENDRIK\b", "Hendrik"),
    (r"…", ","),
    (r"’", "'"),
    (r"\b25\b", "fünfundzwanzig"),
    (r"\b50\b", "fünfzig"),
]

def sprechtext(t):
    for muster, ersatz in SPRECH:
        t = re.sub(muster, ersatz, t)
    return t.strip()

# Untertitel aus main.js lesen
quelle = (hier / "main.js").read_text(encoding="utf-8")
block = re.search(r"export const CAPTIONS = \[(.*?)\n\];", quelle, re.S).group(1)
zeilen = re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '(.*?)'\],", block)

engines = {}
def engine(name):
    if name not in engines:
        ordner = next((modelle / name).glob("vits-piper-*"))
        onnx = next(ordner.glob("*.onnx"))
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=str(onnx), tokens=str(ordner / "tokens.txt"),
                                                         data_dir=str(ordner / "espeak-ng-data")),
            num_threads=2, provider="cpu"))
        engines[name] = sherpa_onnx.OfflineTts(cfg)
    return engines[name]

def dauer(pfad):
    with wave.open(str(pfad)) as w:
        return w.getnframes() / w.getframerate()

ergebnis = []
for i, (a, b, wer, text) in enumerate(zeilen):
    f = FIGUREN[wer]
    tts = engine(f["modell"])
    audio = tts.generate(sprechtext(text), sid=0, speed=f["tempo"])
    roh = ausgabe / f"{i:02d}_{wer}_roh.wav"
    samples = np.clip(np.array(audio.samples) * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(roh), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(audio.sample_rate); w.writeframes(samples.tobytes())
    fertig = ausgabe / f"{i:02d}_{wer}.wav"
    sr, k = audio.sample_rate, f["hoch"]
    # Tonhöhe ändern, ohne die Länge zu ändern: schneller abspielen + wieder strecken
    pitch = f"asetrate={int(sr * k)},aresample={sr},atempo={1 / k:.4f}," if k != 1 else ""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(roh),
                    "-af", f"{pitch}{f['fx']},{HALL},loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "44100", "-ac", "1", str(fertig)], check=True)
    roh.unlink()
    d = dauer(fertig)
    ergebnis.append(dict(datei=fertig.name, start=float(a), ende=float(b), dauer=round(d, 2), sprecher=wer, text=text))
    flag = "  <-- zu lang!" if d > float(b) - float(a) else ""
    print(f"{i:02d} {wer:8s} Fenster {float(b)-float(a):4.1f}s  Sprache {d:4.1f}s{flag}")

(ausgabe / "stimmen.json").write_text(json.dumps(ergebnis, ensure_ascii=False, indent=1), encoding="utf-8")

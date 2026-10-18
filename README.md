# Arbeits-Monitor

Eine Mod für Claude Code, die live anzeigt, **was Claude gerade macht**:

- **Ausführliche Ansicht** (`/monitor` oder Knopf „Details“): aktueller Schritt in Klartext, die letzten Schritte, bisherige Laufzeit und – wenn Claude eine Aufgabenliste führt – „x von y Aufgaben erledigt“.
- **Band über dem Eingabefeld** (ab 0.3.0): kompakte Live-Anzeige, solange Claude arbeitet – Laufzeit, Schritte, Kosten, aktueller Schritt, Aufgaben und Helfer. Ohne eigenes Fenster; der Knopf „Details“ öffnet die ausführliche Ansicht. In Ruhe verschwindet das Band.
- **Fertig-Meldung**: „Fertig nach 1:05 min · 12 Schritte“.
- **Kopfzeile** mit Kosten (≈ $), Tokens und Zeit der Sitzung.
- **Helfer-Übersicht**: Startet Claude Helfer (Subagents), bekommt jeder eine eigene Karte –
  getrennt nach „läuft“ und „fertig“ – mit Modell, Aufwand, aktuellem Schritt, Tokens,
  geschätzten Kosten, Kontext-Anteil, Laufzeit und Fortschrittsbalken.

Kosten und Kontext-Anteil pro Helfer sind Schätzungen (die App meldet nur die Gesamtkosten).

Die Mod schaut nur zu: Sie verändert, blockiert oder versendet nichts.
Eine Restzeit wird bewusst nicht geschätzt, weil sie sich nicht verlässlich vorhersagen lässt.

## Installation

**Desktop-App:** Auf **+** neben dem Eingabefeld klicken → **Plugins** → **Add marketplace** mit
`udovollmer55-alt/arbeits-monitor` → danach **Add plugin** → *arbeits-monitor*.

**Terminal-Sitzung:**

```
/plugin install arbeits-monitor --marketplace udovollmer55-alt/arbeits-monitor
```

Danach `y` zum Hinzufügen des Marketplace, dann einen Bereich (z. B. *user*) wählen.

**Aus einer Shell:**

```
claude plugin install arbeits-monitor --marketplace udovollmer55-alt/arbeits-monitor
```

---

# Zweiter Mod: Freundliche Oberfläche

Im selben Marktplatz liegt der Mod **freundliche-oberflaeche** (Ordner `freundliche-oberflaeche/`):

- **Begrüßung über dem Eingabefeld**, passend zur Tageszeit („☀️ Guten Morgen, Chef! Woran arbeiten wir heute?“), mit einem kleinen Tipp und Knopf „Ausblenden“. Während Claude arbeitet, macht sie dem Arbeits-Monitor Platz.
- **Ladeanzeige auf Deutsch** mit Symbolen: „💭 Denke nach“, „🔧 Arbeite daran“, „✍️ Schreibe die Antwort“.
- **Hinweiszeile auf Deutsch**: „✨ Schreib einfach, was du brauchst“, „↵ Enter zum Senden“.
- **Arbeitsschritte als Karten** (ab 0.2.0): Claudes Werkzeug-Zeilen erscheinen als abgerundete Karten mit Symbol, deutschem Klartext und Zustand, z. B. „📄 Liest jarvis.py ✓“. Mehrere Lese- und Suchschritte werden zu einer Karte zusammengefasst.
- Einstellung **Anrede** (Standard „Chef“).

Installation: Marktplatz wie oben hinzufügen (falls noch nicht geschehen), dann **Add plugin** → *freundliche-oberflaeche*.

Tests laufen pro Mod in seinem eigenen Ordner: `claude plugin test freundliche-oberflaeche`.

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

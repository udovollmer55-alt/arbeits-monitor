# Arbeits-Monitor

Eine Mod für Claude Code, die live anzeigt, **was Claude gerade macht**:

- **Seitenfenster** (`/monitor`): aktueller Schritt in Klartext, die letzten Schritte, bisherige Laufzeit und – wenn Claude eine Aufgabenliste führt – „x von y Aufgaben erledigt“.
- **Statuszeile** unter dem Eingabefeld: Kurzfassung mit Laufzeit, solange Claude arbeitet.
- **Fertig-Meldung**: „Fertig nach 1:05 min · 12 Schritte“.

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

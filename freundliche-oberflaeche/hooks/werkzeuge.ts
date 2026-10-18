// Übersetzt Claudes Werkzeug-Aufrufe in ein Symbol und deutschen Klartext.

type Feld = Record<string, unknown>

/** Liest ein Textfeld aus der Eingabe eines Werkzeugs, sonst undefined. */
const text = (input: unknown, key: string): string | undefined => {
  const value = input && typeof input === 'object' ? (input as Feld)[key] : undefined
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Kürzt einen Pfad auf den Dateinamen. */
const datei = (pfad: string | undefined) => (pfad ?? '').split(/[/\\]/).filter(Boolean).pop() ?? 'eine Datei'

const kurz = (t: string, max = 60) => (t.length > max ? `${t.slice(0, max - 1)}…` : t)

/** Symbol und Klartext für einen Werkzeug-Aufruf. */
export function beschreibe(tool: string, input: unknown): { symbol: string; text: string } {
  switch (tool) {
    case 'Read':
      return { symbol: '📄', text: `Liest ${datei(text(input, 'file_path'))}` }
    case 'Write':
      return { symbol: '📝', text: `Schreibt ${datei(text(input, 'file_path'))}` }
    case 'Edit':
    case 'MultiEdit':
      return { symbol: '✏️', text: `Ändert ${datei(text(input, 'file_path'))}` }
    case 'NotebookEdit':
      return { symbol: '📓', text: `Ändert Notizbuch ${datei(text(input, 'notebook_path'))}` }
    case 'Bash':
    case 'PowerShell':
      return { symbol: '⚙️', text: `Führt aus: ${kurz(text(input, 'description') ?? text(input, 'command') ?? 'einen Befehl')}` }
    case 'Grep':
      return { symbol: '🔍', text: `Sucht nach „${kurz(text(input, 'pattern') ?? '…', 40)}“` }
    case 'Glob':
      return { symbol: '🗂️', text: `Sucht Dateien: ${kurz(text(input, 'pattern') ?? '…', 40)}` }
    case 'WebSearch':
      return { symbol: '🌐', text: `Sucht im Web: ${kurz(text(input, 'query') ?? '…', 50)}` }
    case 'WebFetch':
      return { symbol: '🔗', text: `Öffnet Webseite ${kurz(text(input, 'url') ?? '', 50)}` }
    case 'Agent':
    case 'Task':
      return { symbol: '🤖', text: `Startet Helfer: ${kurz(text(input, 'description') ?? 'Teilaufgabe', 50)}` }
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return { symbol: '✅', text: 'Aktualisiert die Aufgabenliste' }
    case 'Skill':
      return { symbol: '🎓', text: `Nutzt Fähigkeit ${text(input, 'skill') ?? ''}`.trim() }
    default: {
      // Werkzeuge von Verbindungen heißen "mcp__dienst__aktion".
      const teile = tool.split('__')
      if (teile[0] === 'mcp' && teile.length >= 3)
        return { symbol: '🔌', text: `${teile[1]}: ${teile.slice(2).join(' ').replace(/_/g, ' ')}` }
      return { symbol: '🧰', text: `Nutzt Werkzeug ${tool}` }
    }
  }
}

/** Zustand eines Schritts als Zeichen und Themenfarbe. */
export function zustand(s: { isRunning: boolean; isErrored: boolean; isInterrupted: boolean }) {
  if (s.isInterrupted) return { zeichen: '⏸ angehalten', farbe: 'warning' } as const
  if (s.isErrored) return { zeichen: '✗ Problem', farbe: 'error' } as const
  if (s.isRunning) return { zeichen: '… läuft', farbe: 'claude' } as const
  return { zeichen: '✓', farbe: 'success' } as const
}

/** Fasst eine Gruppe von Schritten zusammen, z. B. „3 Dateien gelesen · 2 Suchen“. */
export function zusammenfassung(calls: ReadonlyArray<{ tool: string }>): string {
  const zaehle = (namen: string[]) => calls.filter(c => namen.includes(c.tool)).length
  const teile = [
    [zaehle(['Read']), 'Datei gelesen', 'Dateien gelesen'],
    [zaehle(['Grep', 'Glob']), 'Suche', 'Suchen'],
    [zaehle(['Bash', 'PowerShell']), 'Befehl', 'Befehle'],
  ] as const
  const bekannt = teile.reduce((n, [anzahl]) => n + anzahl, 0)
  const rest = calls.length - bekannt
  const text = teile.filter(([anzahl]) => anzahl > 0).map(([a, eins, viele]) => `${a} ${a === 1 ? eins : viele}`)
  if (rest > 0) text.push(`${rest} ${rest === 1 ? 'weiterer Schritt' : 'weitere Schritte'}`)
  return text.join(' · ')
}

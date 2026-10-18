import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { beschreibe, zusammenfassung, zustand } from './werkzeuge'

// Merkt sich pro Sitzung, ob die Begrüßung weggeklickt wurde.
const istAusgeblendet = atom({ plugin: 'freundliche-oberflaeche', key: 'istAusgeblendet' } as const, false)

// Freundliche Statuswörter je nachdem, was Claude gerade tut.
const STATUS = {
  thinking: '💭 Denke nach',
  requesting: '📨 Frage an',
  responding: '✍️ Schreibe die Antwort',
  'tool-input': '🧰 Bereite ein Werkzeug vor',
  'tool-use': '🔧 Arbeite daran',
} as const

// Kleine Tipps, die in der Begrüßung abwechselnd erscheinen.
const TIPPS = [
  'Tipp: Kurze Bitten reichen, ich frage nach, wenn etwas fehlt.',
  'Tipp: Mit Esc kannst du mich jederzeit anhalten.',
  'Tipp: Schreib „erklär mir das einfacher“, wenn etwas unklar ist.',
  'Tipp: Ich kann Dateien lesen, ändern und dir alles Schritt für Schritt zeigen.',
]

/** Liefert Gruß und Symbol passend zur Tageszeit (Stunde 0–23). */
export function gruss(stunde: number): { symbol: string; text: string } {
  if (stunde < 5) return { symbol: '🌙', text: 'Noch wach' }
  if (stunde < 11) return { symbol: '☀️', text: 'Guten Morgen' }
  if (stunde < 17) return { symbol: '🌤️', text: 'Hallo' }
  if (stunde < 22) return { symbol: '🌇', text: 'Guten Abend' }
  return { symbol: '🌙', text: 'Schönen späten Abend' }
}

export const register: Register = (on, options) => {
  const anrede = String(options.anrede ?? 'Chef').trim() || 'Chef'

  // 1) Ladeanzeige: deutsches Wort mit Symbol statt „Sauteing…“.
  //    Eine Statusmeldung des Programms (message) bleibt unangetastet.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.props.message !== null) return next(e)
    return next({ ...e, props: { ...e.props, word: STATUS[e.props.mode] } })
  })

  // 2) Begrüßung über dem Eingabefeld, nur wenn Claude gerade nichts tut.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking || (await read($, istAusgeblendet))) {
      return next(e)
    }

    const jetzt = new Date(await $.clock.now())
    const { symbol, text } = gruss(jetzt.getHours())
    const tipp = TIPPS[jetzt.getDate() % TIPPS.length]
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box>
          <Text color="claude" bold>
            {symbol} {text}, {anrede}!{' '}
          </Text>
          <Text>Woran arbeiten wir heute?  </Text>
          <Button key="ausblenden" label="Ausblenden" onPress={() => update($, istAusgeblendet, () => true)} />
        </Box>
        <Text color="subtle">{tipp}</Text>
      </Box>
    )
  })

  // 3) Hinweiszeile unter dem Eingabefeld auf Deutsch.
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    const hint = e.props.isWorking
      ? '⏳ Ich bin dran … (Esc hält an)'
      : e.props.isDraft
        ? '↵ Enter zum Senden'
        : '✨ Schreib einfach, was du brauchst'
    return next({ ...e, props: { ...e.props, hint } })
  })

  // 4) Claudes Arbeitsschritte als freundliche Karten mit Symbol und Klartext.
  //    Das Ergebnis darunter (z. B. Befehlsausgabe) zeichnet die App weiter selbst.
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { symbol, text } = beschreibe(e.props.tool, e.props.input)
    const { zeichen, farbe } = zustand(e.props)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box borderStyle="round" borderColor={farbe === 'success' ? 'subtle' : farbe} paddingX={1} flexDirection="row">
        <Text>{symbol} {text}  </Text>
        <Text color={farbe}>{zeichen}</Text>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  // 5) Zusammengefasste Schritte (mehrere Lese- oder Suchvorgänge) als eine Karte.
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
    if (e.props.isExpanded) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const laeuft = e.props.calls.some(c => c.isRunning)
    return (
      <Box borderStyle="round" borderColor={laeuft ? 'claude' : 'subtle'} paddingX={1} flexDirection="row">
        <Text>🔎 {zusammenfassung(e.props.calls)}  </Text>
        <Text color={laeuft ? 'claude' : 'success'}>{laeuft ? '… läuft' : '✓'}</Text>
      </Box>
    )
  }).catch(($, e, next) => next(e))
}

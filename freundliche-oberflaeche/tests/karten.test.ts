import { test, expect, mock } from 'claude-code/testing'
import { beschreibe, zusammenfassung } from '../hooks/werkzeuge'

test('Werkzeuge bekommen Symbol und Klartext', () => {
  expect(beschreibe('Read', { file_path: 'C:\\jarvis\\main.py' })).toEqual({ symbol: '📄', text: 'Liest main.py' })
  expect(beschreibe('PowerShell', { command: 'dir', description: 'Ordner auflisten' }).text).toBe('Führt aus: Ordner auflisten')
  expect(beschreibe('mcp__github__get_me', {}).text).toBe('github: get me')
  expect(zusammenfassung([{ tool: 'Read' }, { tool: 'Read' }, { tool: 'Grep' }])).toBe('2 Dateien gelesen · 1 Suche')
})

const ZEILE = {
  tool_use_id: 'a',
  tool: 'Read',
  input: { file_path: '/x/jarvis.py' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
} as const

test('Arbeitsschritt wird als Karte gezeichnet', async ($, on) => {
  mock.clock(on)
  on('ui.render', ($$, e) => $$.ui.resolve(e).Text({}, ''))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'freundliche-oberflaeche', surface, component: 'ToolUse', requestId: 'a', props: ZEILE })
    expect(await ui.find({ type: 'Text', text: /Liest jarvis\.py/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '✓' })).toBeDefined()
    await ui.redraw({ ...ZEILE, isRunning: true })
    expect(await ui.find({ type: 'Text', text: /läuft/ })).toBeDefined()
    await ui.unmount()
  }
})

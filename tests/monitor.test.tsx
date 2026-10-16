import { expect, mock, test } from 'claude-code/testing'

import { formatDuration } from '../hooks/register'

const PANE = {
  title: 'Arbeits-Monitor',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

test('Laufzeit wird lesbar angezeigt', () => {
  expect(formatDuration(12_000)).toBe('12 s')
  expect(formatDuration(65_000)).toBe('1:05 min')
})

test('Panel zeigt Schritte und Aufgaben-Fortschritt', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  // Unter der Mod: ein "Werkzeug", das einfach sofort fertig ist.
  on('tool.call', () => ({ result: {} }) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))

  await $.turn.start({ text: 'Bitte prüfen', turnId: 't1' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x/jarvis.py' } as never)
  await $.tool.call({
    tool: 'TodoWrite',
    tool_use_id: 'b',
    todos: [
      { content: 'Eins', status: 'completed', activeForm: 'Eins' },
      { content: 'Zwei', status: 'in_progress', activeForm: 'Zwei' },
    ],
  } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'arbeits-monitor',
      surface,
      component: 'Pane',
      requestId: 'arbeits-monitor',
      props: PANE,
    })
    expect(await ui.find({ text: /Arbeitet/ })).toBeDefined()
    expect(await ui.find({ text: /Liest jarvis\.py/ })).toBeDefined()
    expect(await ui.find({ text: /1 von 2 erledigt/ })).toBeDefined()
    await ui.unmount()
  }

  await clock.advance(65_000)
  await $.turn.complete({ text: 'ok', turnId: 't1', reason: 'answer' } as never)
  const ui = await $.ui.mount({
    plugin: 'arbeits-monitor',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'arbeits-monitor',
    props: PANE,
  })
  expect(await ui.find({ text: /Fertig · 1:05 min/ })).toBeDefined()
})

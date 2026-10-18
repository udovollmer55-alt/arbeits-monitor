import { expect, mock, test } from 'claude-code/testing'

import { bar, formatDuration, formatTokens, modelName } from '../hooks/register'

const PANE = {
  title: 'Arbeits-Monitor',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

const mountPane = ($: any, surface: 'terminal' | 'desktop' = 'desktop') =>
  $.ui.mount({
    plugin: 'arbeits-monitor',
    surface,
    component: 'Pane',
    requestId: 'arbeits-monitor',
    props: PANE,
  })

/** Die "Welt" unter der Mod: Werkzeuge, Turns und Verbrauch antworten sofort. */
const world = (on: any) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {} }) as never)
  on('turn.start', (_$: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [], cost: { usd: 0.35 } },
  }))
  on('agent.spawn', (_$: unknown, e: { description: string }) => ({
    model: e.description.includes('Recherche') ? 'claude-haiku-5-5' : 'claude-sonnet-5-5',
    agentId: e.description.includes('Recherche') ? 'h1' : 'h2',
  }))
  on('turn.step', async function* (_$: unknown, e: { turnId: string; index: number }) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 20_000,
        cache_creation_input_tokens: 0,
        model: 'claude-haiku-5-5',
      },
    } as never
  })
  return clock
}

/** Eine Modell-Anfrage durchspielen (den Datenstrom ganz lesen, dann ist sie fertig). */
const step = async ($: any, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'x', messageCount: 1, effort: 'low', agentId })
  for await (const _ of stream);
  return stream.result
}

test('Hilfsfunktionen schreiben Zahlen lesbar', () => {
  expect(formatDuration(12_000)).toBe('12 s')
  expect(formatDuration(65_000)).toBe('1:05 min')
  expect(formatTokens(386_400)).toBe('386k')
  expect(modelName('claude-haiku-5-5')).toBe('Haiku 5.5')
  expect(modelName('claude-sonnet-5')).toBe('Sonnet 5')
  expect(bar(1, 2, 4)).toBe('██░░')
})

test('Panel zeigt Schritte und Aufgaben-Fortschritt', async ($, on) => {
  const clock = world(on)
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
    const ui = await mountPane($, surface)
    expect(await ui.find({ text: /Claude arbeitet/ })).toBeDefined()
    expect(await ui.find({ text: /Liest jarvis\.py/ })).toBeDefined()
    expect(await ui.find({ text: /1 von 2 erledigt/ })).toBeDefined()
    await ui.unmount()
  }

  await clock.advance(65_000)
  await $.turn.complete({ text: 'ok', turnId: 't1', reason: 'answer' } as never)
  const ui = await mountPane($)
  expect(await ui.find({ text: /Claude ist fertig/ })).toBeDefined()
  expect(await ui.find({ text: '1:05 min' })).toBeDefined()
  expect(await ui.find({ text: /Gerade/ })).toBeUndefined()
})

test('Helfer bekommen eigene Karten mit Modell, Tokens und Fortschritt', async ($, on) => {
  const clock = world(on)
  await $.turn.start({ text: 'Recherche und Posts', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 's1', description: 'Recherche Bäckereien', prompt: 'p', subagentType: 'general-purpose' } as never)
  await $.agent.spawn({ tool_use_id: 's2', description: 'Posts schreiben', prompt: 'p', subagentType: 'general-purpose' } as never)
  await step($, 'h1')
  await step($)
  await $.tool.call({ tool: 'WebSearch', tool_use_id: 'w', query: 'Bäckerei Hamburg', agentId: 'h1' } as never)
  await $.tool.call({
    tool: 'TodoWrite',
    tool_use_id: 'td',
    agentId: 'h1',
    todos: [
      { content: 'a', status: 'completed', activeForm: 'a' },
      { content: 'b', status: 'pending', activeForm: 'b' },
      { content: 'c', status: 'pending', activeForm: 'c' },
    ],
  } as never)
  await clock.advance(2000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountPane($, surface)
    expect(await ui.find({ text: /Helfer – läuft · 2/ })).toBeDefined()
    expect(await ui.find({ text: /Recherche Bäckereien/ })).toBeDefined()
    expect(await ui.find({ text: /Haiku 5\.5 · low/ })).toBeDefined()
    expect(await ui.find({ text: /1\/3/ })).toBeDefined()
    expect(await ui.find({ text: /≈\$0\.35/ })).toBeDefined()
    await ui.unmount()
  }

  await $.turn.complete({ text: 'fertig', turnId: 'h1t', reason: 'answer', agentId: 'h1' } as never)
  const ui = await mountPane($)
  expect(await ui.find({ text: /Helfer – fertig · 1/ })).toBeDefined()
  expect(await ui.find({ text: /Helfer – läuft · 1/ })).toBeDefined()
  expect(await ui.find({ text: /✓ Recherche Bäckereien/ })).toBeDefined()
})

test('PowerShell wird in Klartext beschrieben', async ($, on) => {
  world(on)
  await $.turn.start({ text: 'x', turnId: 't1' })
  await $.tool.call({
    tool: 'PowerShell',
    tool_use_id: 'p',
    command: 'Get-ChildItem',
    description: 'Ordner auflisten',
  } as never)
  const ui = await mountPane($)
  expect(await ui.find({ text: /Führt aus: Ordner auflisten/ })).toBeDefined()
})

const BAND = {
  hasSurvey: false,
  isWorking: true,
  maxRows: 12,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 11 },
  view: {},
} as const

const mountBand = ($: any, surface: 'terminal' | 'desktop' = 'desktop') =>
  $.ui.mount({ plugin: 'arbeits-monitor', surface, component: 'AbovePrompt', props: BAND })

test('Band über dem Eingabefeld zeigt die Arbeit und verschwindet danach', async ($, on) => {
  const clock = world(on)
  // Was das Band zeigt, wenn der Monitor den Platz freigibt.
  on('ui.render', ($$: any, e: any) => $$.ui.resolve(e).Text({}, ''))
  await $.turn.start({ text: 'Bitte prüfen', turnId: 't1' })
  await $.tool.call({ tool: 'Read', tool_use_id: 'a', file_path: '/x/jarvis.py' } as never)
  await clock.advance(5000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountBand($, surface)
    expect(await ui.find({ text: /Claude arbeitet/ })).toBeDefined()
    expect(await ui.find({ text: /1 Schritte/ })).toBeDefined()
    expect(await ui.find({ key: 'details' })).toBeDefined()
    await ui.unmount()
  }

  await $.turn.complete({ text: 'ok', turnId: 't1', reason: 'answer' } as never)
  const ui = await mountBand($)
  expect(await ui.find({ text: /Claude arbeitet/ })).toBeUndefined()
})

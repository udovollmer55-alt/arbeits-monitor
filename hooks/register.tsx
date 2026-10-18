// Arbeits-Monitor: zeigt live, was Claude gerade macht.
// Die Mod schaut nur zu: Sie verändert und blockiert keine Aktion.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput, TurnUsage } from 'claude-code'

import type { Helper, Run, TaskStatus, Totals, Usage } from '../types'

const PANE = 'arbeits-monitor'
const TITLE = 'Arbeits-Monitor'
const SHOWN_STEPS = 6

const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
const EMPTY: Run = { startedAt: null, endedAt: null, steps: [], stepCount: 0, tasks: {} }

const run = atom({ plugin: 'arbeits-monitor', key: 'run' } as const, EMPTY)
const now = atom({ plugin: 'arbeits-monitor', key: 'now' } as const, 0)
const helpers = atom({ plugin: 'arbeits-monitor', key: 'helpers' } as const, {})
const totals = atom({ plugin: 'arbeits-monitor', key: 'totals' } as const, {
  usage: NO_USAGE,
  costUsd: null,
  window: 0,
} as Totals)

// Uhr, die jede Sekunde Laufzeit und Kosten erneuert, solange etwas arbeitet.
let ticker: { cancel: () => void } | undefined

/** Kürzt einen Pfad auf den Dateinamen, damit die Anzeige übersichtlich bleibt. */
const fileName = (path: string) => path.split(/[/\\]/).filter(Boolean).pop() ?? path

const short = (text: string, max = 50) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** 1:05 oder 12 s – die Laufzeit in leicht lesbarer Form. */
export const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const rest = seconds % 60
  return `${Math.floor(seconds / 60)}:${rest < 10 ? '0' : ''}${rest} min`
}

/** 386k, 1.2M – große Token-Zahlen kurz geschrieben. */
export const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

const formatUsd = (usd: number) => `≈$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`

/** "claude-haiku-5-5" -> "Haiku 5.5": der Modellname so, wie man ihn kennt. */
export const modelName = (id: string) => {
  const m = /(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?/i.exec(id)
  if (!m) return id
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase()
  return m[3] && m[3].length < 3 ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

const total = (u: Usage) => u.input + u.output + u.cacheRead + u.cacheWrite

/**
 * Gewichtete Tokens: grob so, wie sie bezahlt werden (Ausgabe teuer, Cache-Lesen
 * billig). Damit wird der Gesamtpreis fair auf die Helfer verteilt.
 */
const weight = (u: Usage) => u.input + 1.25 * u.cacheWrite + 0.1 * u.cacheRead + 5 * u.output

const addUsage = (a: Usage, u: TurnUsage): Usage => ({
  input: a.input + u.input_tokens,
  output: a.output + u.output_tokens,
  cacheRead: a.cacheRead + u.cache_read_input_tokens,
  cacheWrite: a.cacheWrite + u.cache_creation_input_tokens,
})

/** Übersetzt einen Werkzeug-Aufruf von Claude in einen deutschen Klartext. */
export const describe = (e: ToolCallInput): string => {
  switch (e.tool) {
    case 'Read':
      return `Liest ${fileName(e.file_path)}`
    case 'Write':
      return `Schreibt ${fileName(e.file_path)}`
    case 'Edit':
      return `Ändert ${fileName(e.file_path)}`
    case 'Bash':
      return `Führt aus: ${short(e.description ?? e.command)}`
    case 'Grep':
      return `Sucht nach „${short(e.pattern, 30)}“`
    case 'Glob':
      return `Sucht Dateien: ${short(e.pattern, 30)}`
    case 'WebSearch':
      return `Sucht im Web: ${short(e.query, 40)}`
    case 'WebFetch':
      return `Öffnet Webseite ${short(e.url, 40)}`
    case 'Agent':
      return `Startet Helfer: ${short(e.description, 40)}`
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return 'Aktualisiert die Aufgabenliste'
    default: {
      // Windows nutzt statt "Bash" das Werkzeug "PowerShell" mit denselben Feldern.
      const args = e as unknown as { description?: unknown; command?: unknown }
      const what = typeof args.description === 'string' ? args.description : args.command
      if ((e.tool as string) === 'PowerShell' && typeof what === 'string')
        return `Führt aus: ${short(what)}`
      return `Nutzt Werkzeug ${e.tool}`
    }
  }
}

/** Zählt erledigte und alle Aufgaben einer Aufgabenliste. */
export const taskProgress = (tasks: Record<string, TaskStatus>) => {
  const all = Object.values(tasks)
  return { done: all.filter(s => s === 'completed').length, total: all.length }
}

/**
 * Trägt eine Änderung der Aufgabenliste ein. Claude nutzt zwei Varianten:
 * TodoWrite (ganze Liste auf einmal) und TaskCreate/TaskUpdate (einzeln).
 */
const applyTasks = (
  before: Record<string, TaskStatus>,
  e: ToolCallInput,
  result: unknown,
): Record<string, TaskStatus> => {
  const tasks = { ...before }
  if (e.tool === 'TodoWrite') {
    for (const key of Object.keys(tasks)) delete tasks[key]
    e.todos.forEach((todo, i) => (tasks[`todo-${i}`] = todo.status))
  }
  const created = result as { task?: { id: string } } | undefined
  if (e.tool === 'TaskCreate' && created?.task) tasks[created.task.id] = 'pending'
  if (e.tool === 'TaskUpdate' && e.status !== undefined) {
    if (e.status === 'deleted') delete tasks[e.taskId]
    else tasks[e.taskId] = e.status
  }
  return tasks
}

/** Ein Fortschrittsbalken aus Zeichen, damit er überall gleich aussieht. */
export const bar = (done: number, all: number, width = 16) => {
  const filled = all > 0 ? Math.round((done / all) * width) : 0
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/** Holt Gesamtkosten und Fenstergröße von der App (falls sie sie meldet). */
const refreshTotals = async ($: EngineInterface) => {
  // Meldet die App nichts, bleibt die Anzeige einfach beim letzten Stand.
  const usage = await $.session.usage().catch(() => undefined)
  if (!usage) return
  await update($, totals, t => ({
    ...t,
    costUsd: usage.cost?.usd ?? t.costUsd,
    window: usage.context.window || t.window,
  }))
}

const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()
  await update($, now, () => at)
  await refreshTotals($)
}

const startTicker = ($: EngineInterface) => {
  ticker ??= $.clock.every(1000, () => void tick($))
}

/** Hält die Uhr an, sobald weder Claude noch ein Helfer arbeitet. */
const stopTickerIfIdle = async ($: EngineInterface) => {
  const r = await read($, run)
  const busy = Object.values(await read($, helpers)).some(hp => hp.status === 'running')
  if (r.endedAt !== null && !busy) {
    ticker?.cancel()
    ticker = undefined
    await tick($)
  }
}

const patchHelper = ($: EngineInterface, id: string, fn: (hp: Helper) => Helper) =>
  update($, helpers, all => {
    const hp = all[id]
    return hp ? { ...all, [id]: fn(hp) } : all
  })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'monitor',
      description: 'Öffnet die ausführliche Ansicht des Arbeits-Monitors',
    })
    return next(e)
  })

  on('command.run', { command: 'monitor' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Arbeits-Monitor geöffnet.' }
  })

  // Neue Aufgabe abgeschickt: Uhr starten, alte Schritte und fertige Helfer leeren.
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const at = await $.clock.now()
    await update($, run, () => ({ ...EMPTY, startedAt: at }))
    await update($, helpers, all =>
      Object.fromEntries(Object.entries(all).filter(([, hp]) => hp.status === 'running')),
    )
    await update($, now, () => at)
    startTicker($)
    return next(e)
  })

  // Claude startet einen Helfer: eine neue Karte anlegen.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if ('agentId' in started && started.agentId) {
      const at = await $.clock.now()
      const id = started.agentId
      await update($, helpers, all => ({
        ...all,
        [id]: {
          id,
          title: e.description || e.subagentType,
          model: started.model,
          effort: null,
          startedAt: at,
          endedAt: null,
          status: 'running' as const,
          current: null,
          stepCount: 0,
          tasks: {},
          usage: NO_USAGE,
          lastContext: 0,
        },
      }))
      startTicker($)
    }
    return started
  }).catch(($, e, next) => next(e))

  // Jede Anfrage an das Modell: Tokens zählen (für Claude und jeden Helfer).
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const u = result.usage
    if (u) {
      await update($, totals, t => ({ ...t, usage: addUsage(t.usage, u) }))
      if (e.agentId !== undefined)
        await patchHelper($, e.agentId, hp => ({
          ...hp,
          model: u.model || hp.model,
          effort: e.effort === undefined ? hp.effort : String(e.effort),
          usage: addUsage(hp.usage, u),
          lastContext: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
        }))
    }
    return result
  })

  // Jeder Arbeitsschritt: vorher eintragen, danach als erledigt markieren.
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id
    const text = describe(e)
    const helperId = e.agentId

    if (helperId !== undefined) {
      await patchHelper($, helperId, hp => ({ ...hp, current: text, stepCount: hp.stepCount + 1 }))
      const ran = await next(e)
      await patchHelper($, helperId, hp => ({ ...hp, tasks: applyTasks(hp.tasks, e, ran.result) }))
      return ran
    }

    await update($, run, r => ({
      ...r,
      steps: [...r.steps, { id, text, isDone: false }].slice(-50),
      stepCount: r.stepCount + 1,
    }))
    const ran = await next(e)
    await update($, run, r => ({
      ...r,
      steps: r.steps.map(s => (s.id === id ? { ...s, isDone: true } : s)),
      tasks: applyTasks(r.tasks, e, ran.result),
    }))
    return ran
    // Falls die Anzeige einmal hakt, läuft Claudes Arbeit trotzdem normal weiter.
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()

    // Ein Helfer ist fertig: Karte nach "Fertig" verschieben.
    if (e.agentId !== undefined) {
      await patchHelper($, e.agentId, hp => ({
        ...hp,
        endedAt: at,
        status: e.reason === 'answer' ? 'done' : 'failed',
        current: null,
      }))
      await stopTickerIfIdle($)
      return next(e)
    }

    // Claude ist fertig: Uhr anhalten (wenn kein Helfer mehr läuft), Meldung zeigen.
    const r = await update($, run, r => ({ ...r, endedAt: at }))
    await update($, now, () => at)
    await stopTickerIfIdle($)
    if (r.startedAt !== null) {
      const how = e.reason === 'answer' ? 'Fertig' : 'Abgebrochen'
      $.ui.toast(`${how} nach ${formatDuration(at - r.startedAt)} · ${r.stepCount} Schritte`)
    }
    return next(e)
  })

  // Das Band direkt über dem Eingabefeld: kompakt, nur solange gearbeitet wird.
  // In Ruhe gibt es den Platz frei (z. B. für die Begrüßung anderer Mods).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.view.agentId !== undefined) return next(e)
    const r = await read($, run)
    const running = Object.values(await read($, helpers)).filter(hp => hp.status === 'running')
    const isRunning = r.startedAt !== null && r.endedAt === null
    if (!isRunning && running.length === 0) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const at = await read($, now)
    const t = await read($, totals)
    const current = r.steps.findLast(s => !s.isDone) ?? r.steps.at(-1)
    const { done, total: taskCount } = taskProgress(r.tasks)
    const facts = [
      r.startedAt === null ? undefined : `⏱ ${formatDuration(Math.max(at, r.startedAt) - r.startedAt)}`,
      `${r.stepCount} Schritte`,
      t.costUsd === null ? undefined : formatUsd(t.costUsd),
    ]

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text bold color="claude">
            {isRunning ? '● Claude arbeitet' : '● Helfer arbeiten'}
          </Text>
          <Text dimColor> · {facts.filter(Boolean).join(' · ')}  </Text>
          <Button key="details" label="Details" onPress={() => $.ui.open({ id: PANE, title: TITLE })} />
        </Box>
        {isRunning && (
          <Text>
            <Text bold>Gerade: </Text>
            {short(current && !current.isDone ? current.text : 'Denkt nach…', Math.max(20, e.props.bodyColumns - 10))}
          </Text>
        )}
        {taskCount > 0 && (
          <Text>
            <Text color="yellow">{bar(done, taskCount, 12)}</Text> {done} von {taskCount} Aufgaben
          </Text>
        )}
        {running.length > 0 && (
          <Text dimColor>
            🤖 {running.length} Helfer: {short(running.map(hp => hp.title).join(', '), Math.max(20, e.props.bodyColumns - 16))}
          </Text>
        )}
      </Box>
    )
  })

  // Das Seitenfenster selbst.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, run)
    const at = await read($, now)
    const all = Object.values(await read($, helpers))
    const t = await read($, totals)

    if (r.startedAt === null && all.length === 0)
      return <Text dimColor>Noch nichts passiert. Schick Claude eine Aufgabe.</Text>

    const isRunning = r.startedAt !== null && r.endedAt === null
    const elapsed = r.startedAt === null ? 0 : (r.endedAt ?? at) - r.startedAt
    const current = r.steps.findLast(s => !s.isDone)
    const earlier = r.steps.filter(s => s !== current).slice(-SHOWN_STEPS).reverse()
    const { done, total: taskCount } = taskProgress(r.tasks)
    const running = all.filter(hp => hp.status === 'running')
    const finished = all.filter(hp => hp.status !== 'running')
    const allWeight = weight(t.usage)

    /** Eine Kachel der Kopfzeile: Überschrift klein, Wert groß. */
    const tile = (label: string, value: string) => (
      <Box key={label} flexDirection="column" flexGrow={1} borderStyle="round" paddingX={1}>
        <Text dimColor>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

    /** Eine Karte pro Helfer: Titel, Modell, aktueller Schritt, Zahlen, Balken. */
    const card = (helper: Helper) => {
      const tasks = taskProgress(helper.tasks)
      const isDone = helper.status !== 'running'
      const cost =
        t.costUsd !== null && allWeight > 0 ? formatUsd((t.costUsd * weight(helper.usage)) / allWeight) : null
      const ctx = t.window > 0 && helper.lastContext > 0 ? `ctx ${Math.round((helper.lastContext / t.window) * 100)}%` : null
      const numbers = [ctx, `${formatTokens(total(helper.usage))} Tokens`, cost, formatDuration((helper.endedAt ?? at) - helper.startedAt)]
      const doing = isDone
        ? helper.status === 'done' ? 'Erledigt' : 'Abgebrochen'
        : helper.current ?? 'Denkt nach…'
      return (
        <Box key={helper.id} flexDirection="column" marginTop={1}>
          <Text bold>
            {isDone ? (helper.status === 'done' ? '✓ ' : '✗ ') : '● '}
            {helper.title}
          </Text>
          <Text dimColor>
            🤖 {modelName(helper.model)}
            {helper.effort ? ` · ${helper.effort}` : ''}
          </Text>
          <Text>
            {tasks.total > 0 ? `${tasks.done}/${tasks.total} · ` : ''}
            {short(doing, 60)}
          </Text>
          <Text dimColor>{numbers.filter(Boolean).join(' · ')}</Text>
          {tasks.total > 0 && (
            <Text color={isDone ? 'green' : 'yellow'}>{bar(tasks.done, tasks.total)}</Text>
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {tile('Kosten', t.costUsd === null ? '–' : formatUsd(t.costUsd))}
          {tile('Tokens', formatTokens(total(t.usage)))}
          {tile('Zeit', formatDuration(elapsed))}
        </Box>

        {r.startedAt !== null && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={isRunning ? 'yellow' : 'green'}>
              {isRunning ? '● Claude arbeitet' : '✓ Claude ist fertig'} · {r.stepCount} Schritte
            </Text>
            {isRunning && (
              <Text>
                <Text bold>Gerade: </Text>
                {current ? current.text : 'Denkt nach…'}
              </Text>
            )}
            {taskCount > 0 && (
              <Text>
                <Text bold>Aufgaben: </Text>
                {done} von {taskCount} erledigt
              </Text>
            )}
          </Box>
        )}

        {running.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Helfer – läuft · {running.length}</Text>
            {running.map(card)}
          </Box>
        )}
        {finished.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Helfer – fertig · {finished.length}</Text>
            {finished.map(card)}
          </Box>
        )}

        {earlier.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{isRunning ? 'Davor:' : 'Erledigt:'}</Text>
            {earlier.map(s => (
              <Text key={s.id} dimColor>
                ✓ {s.text}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}

// Arbeits-Monitor: zeigt live, was Claude gerade macht.
// Die Mod schaut nur zu: Sie verändert und blockiert keine Aktion.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallInput } from 'claude-code'

import type { Run } from '../types'

const PANE = 'arbeits-monitor'
const TITLE = 'Arbeits-Monitor'
const SHOWN_STEPS = 6

const EMPTY: Run = { startedAt: null, endedAt: null, steps: [], stepCount: 0, tasks: {} }
const run = atom({ plugin: 'arbeits-monitor', key: 'run' } as const, EMPTY)
const now = atom({ plugin: 'arbeits-monitor', key: 'now' } as const, 0)

// Uhr, die während eines Durchlaufs jede Sekunde die Laufzeit erneuert.
let ticker: { cancel: () => void } | undefined

/** Kürzt einen Pfad auf den Dateinamen, damit die Anzeige übersichtlich bleibt. */
const fileName = (path: string) => path.split('/').filter(Boolean).pop() ?? path

const short = (text: string, max = 50) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

/** 1:05 oder 12 s – die Laufzeit in leicht lesbarer Form. */
export const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const rest = seconds % 60
  return `${Math.floor(seconds / 60)}:${rest < 10 ? '0' : ''}${rest} min`
}

/** Übersetzt einen Werkzeug-Aufruf von Claude in einen deutschen Klartext. */
export const describe = (e: ToolCallInput): string => {
  const helper = e.agentId === undefined ? '' : '(Helfer) '
  const text = (() => {
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
  })()
  return helper + text
}

/** Zählt erledigte und alle Aufgaben aus Claudes Aufgabenliste. */
export const taskProgress = (r: Run) => {
  const all = Object.values(r.tasks)
  return { done: all.filter(s => s === 'completed').length, total: all.length }
}

/** Die Kurzfassung für die Statuszeile unter dem Eingabefeld. */
const statusLine = (r: Run, at: number) => {
  if (r.startedAt === null || r.endedAt !== null) return undefined
  const current = r.steps.findLast(s => !s.isDone) ?? r.steps.at(-1)
  const { done, total } = taskProgress(r)
  const parts = [
    `⏱ ${formatDuration(at - r.startedAt)}`,
    current ? current.text : 'Denkt nach…',
    total > 0 ? `${done}/${total} Aufgaben` : undefined,
  ]
  return parts.filter(Boolean).join(' · ')
}

const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()
  await update($, now, () => at)
  $.ui.status(statusLine(await read($, run), at))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'monitor',
      description: 'Öffnet den Arbeits-Monitor (was Claude gerade macht)',
    })
    return next(e)
  })

  on('command.run', { command: 'monitor' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Arbeits-Monitor geöffnet.' }
  })

  // Neue Aufgabe abgeschickt: Uhr starten, alte Schritte leeren.
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const at = await $.clock.now()
    await update($, run, () => ({ ...EMPTY, startedAt: at }))
    await update($, now, () => at)
    ticker?.cancel()
    ticker = $.clock.every(1000, () => void tick($))
    $.ui.status(statusLine(await read($, run), at))
    return next(e)
  })

  // Jeder Arbeitsschritt: vorher eintragen, danach als erledigt markieren.
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id
    await update($, run, r => ({
      ...r,
      steps: [...r.steps, { id, text: describe(e), isDone: false }].slice(-50),
      stepCount: r.stepCount + 1,
    }))
    const ran = await next(e)

    await update($, run, r => {
      const steps = r.steps.map(s => (s.id === id ? { ...s, isDone: true } : s))
      const tasks = { ...r.tasks }
      // Aufgabenliste mitzählen (beide Varianten, die Claude benutzt).
      if (e.tool === 'TodoWrite') {
        for (const key of Object.keys(tasks)) delete tasks[key]
        e.todos.forEach((todo, i) => (tasks[`todo-${i}`] = todo.status))
      }
      const created = ran.result as { task?: { id: string } } | undefined
      if (e.tool === 'TaskCreate' && created?.task) tasks[created.task.id] = 'pending'
      if (e.tool === 'TaskUpdate' && e.status !== undefined) {
        if (e.status === 'deleted') delete tasks[e.taskId]
        else tasks[e.taskId] = e.status
      }
      return { ...r, steps, tasks }
    })
    return ran
    // Falls die Anzeige einmal hakt, läuft Claudes Arbeit trotzdem normal weiter.
  }).catch(($, e, next) => next(e))

  // Fertig: Uhr anhalten, Statuszeile leeren, kurze Meldung zeigen.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    ticker?.cancel()
    ticker = undefined
    const at = await $.clock.now()
    const r = await update($, run, r => ({ ...r, endedAt: at }))
    await update($, now, () => at)
    $.ui.status(undefined)
    if (r.startedAt !== null) {
      const how = e.reason === 'answer' ? 'Fertig' : 'Abgebrochen'
      $.ui.toast(
        `${how} nach ${formatDuration(at - r.startedAt)} · ${r.stepCount} Schritte`,
      )
    }
    return next(e)
  })

  // Das Seitenfenster selbst.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, run)
    const at = await read($, now)

    if (r.startedAt === null)
      return <Text dimColor>Noch nichts passiert. Schick Claude eine Aufgabe.</Text>

    const isRunning = r.endedAt === null
    const elapsed = (r.endedAt ?? at) - r.startedAt
    const current = r.steps.findLast(s => !s.isDone)
    const earlier = r.steps.filter(s => s !== current).slice(-SHOWN_STEPS).reverse()
    const { done, total } = taskProgress(r)

    return (
      <Box flexDirection="column">
        <Text bold color={isRunning ? 'yellow' : 'green'}>
          {isRunning ? '● Arbeitet' : '✓ Fertig'} · {formatDuration(elapsed)}
        </Text>
        {isRunning && (
          <Text>
            <Text bold>Gerade: </Text>
            {current ? current.text : 'Denkt nach…'}
          </Text>
        )}
        {total > 0 && (
          <Text>
            <Text bold>Aufgaben: </Text>
            {done} von {total} erledigt
          </Text>
        )}
        <Text dimColor>Schritte bisher: {r.stepCount}</Text>
        {earlier.length > 0 && <Text bold>{isRunning ? 'Davor:' : 'Erledigt:'}</Text>}
        {earlier.map(s => (
          <Text key={s.id} dimColor>
            ✓ {s.text}
          </Text>
        ))}
      </Box>
    )
  })
}

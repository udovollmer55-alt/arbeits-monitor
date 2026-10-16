/** Ein Arbeitsschritt von Claude, in Klartext beschrieben. */
export type Step = { id: string; text: string; isDone: boolean }

/** Status einer Aufgabe aus Claudes Aufgabenliste. */
export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/** Der aktuelle (oder letzte) Durchlauf: vom Abschicken bis zur Antwort. */
export type Run = {
  startedAt: number | null
  endedAt: number | null
  steps: Step[]
  stepCount: number
  /** Aufgabenliste von Claude: Aufgaben-ID -> Status */
  tasks: Record<string, TaskStatus>
}

/** Verbrauchte Tokens, aufgeteilt wie die API sie meldet. */
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }

/** Ein Helfer (Subagent), den Claude für eine Teilaufgabe gestartet hat. */
export type Helper = {
  id: string
  title: string
  model: string
  effort: string | null
  startedAt: number
  endedAt: number | null
  status: 'running' | 'done' | 'failed'
  current: string | null
  stepCount: number
  tasks: Record<string, TaskStatus>
  usage: Usage
  /** Größe des Gesprächs beim letzten Schritt (für den Kontext-Anteil). */
  lastContext: number
}

/** Summen der ganzen Sitzung für die Kopfzeile. */
export type Totals = { usage: Usage; costUsd: number | null; window: number }

declare module 'claude-code' {
  interface PluginState {
    'arbeits-monitor': {
      run: Run
      now: number
      helpers: Record<string, Helper>
      totals: Totals
    }
  }
}

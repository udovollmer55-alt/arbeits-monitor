/** Ein Arbeitsschritt von Claude, in Klartext beschrieben. */
export type Step = { id: string; text: string; isDone: boolean }

/** Der aktuelle (oder letzte) Durchlauf: vom Abschicken bis zur Antwort. */
export type Run = {
  startedAt: number | null
  endedAt: number | null
  steps: Step[]
  stepCount: number
  /** Aufgabenliste von Claude: Aufgaben-ID -> Status */
  tasks: Record<string, 'pending' | 'in_progress' | 'completed'>
}

declare module 'claude-code' {
  interface PluginState {
    'arbeits-monitor': { run: Run; now: number }
  }
}

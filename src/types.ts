export type GameEntry = {
  name: string
  path: string
  icon: string
  lastSave?: number
  type?: 'steam' | 'userdata'
}

export type AppConfig = {
  settings: Record<string, unknown>
  games: GameEntry[]
  version: number
}

export type PathState = {
  exists: boolean
  resolved: string
}

export type Level = 'novice' | 'medium' | 'pro'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'done'

export type Seat = {
  name: string
  isHuman: boolean
  chips: number
  hand: number[]
  bet: number
  total: number
  isFolded: boolean
  isAllIn: boolean
  isOut: boolean
  hasActed: boolean
  lastAction: string
}

export type Reads = { hands: number; raises: number; calls: number; folds: number }

export type Game = {
  level: Level
  seats: Seat[]
  deck: number[]
  board: number[]
  dealer: number
  toAct: number
  street: Street
  currentBet: number
  minRaise: number
  sb: number
  bb: number
  handNo: number
  log: string[]
  isShowdown: boolean
  isOver: boolean
  reads: Reads
}

export type Menu = { level: Level | null }

export type LevelStats = { games: number; wins: number; hands: number; handsWon: number; best: number }

export type Stats = Record<Level, LevelStats>

declare module 'claude-code' {
  interface PluginState {
    poker: { game: Game | null; menu: Menu; stats: Stats }
  }
}

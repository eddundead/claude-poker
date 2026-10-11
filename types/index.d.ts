export type Level = 'novice' | 'medium' | 'pro'

export type Lang = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'pt' | 'ru' | 'ko' | 'it'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'done'

/** A move as the table shows it under a seat; words come from the language at draw time. */
export type Act =
  | { k: 'fold' }
  | { k: 'check' }
  | { k: 'call'; n: number }
  | { k: 'allin'; n: number }
  | { k: 'bet'; n: number }
  | { k: 'raise'; n: number }
  | { k: 'sb'; n: number }
  | { k: 'bb'; n: number }

/** One line of the hand's log, put into words at draw time. */
export type Entry =
  | { k: 'hand'; n: number }
  | { k: 'blinds'; sb: number; bb: number }
  | { k: 'street'; street: Street; cards: number[] }
  | { k: 'act'; seat: number; act: Act }
  | { k: 'takes'; seat: number; n: number }
  | { k: 'wins'; seat: number; n: number }
  | { k: 'shows'; seat: number; value: number; cards?: number[] }
  | { k: 'out'; seat: number }
  | { k: 'over'; isWon: boolean }

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
  lastAction: Act | null
}

export type Reads = { hands: number; raises: number; calls: number; folds: number }

export type Outcome = {
  byFold: boolean
  winners: { seat: number; amount: number }[]
  shown: { seat: number; value: number }[]
}

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
  log: Entry[]
  /** Entries ever said, so a scrolled log can hold its place while lines come and go. */
  logCount: number
  isShowdown: boolean
  isOver: boolean
  reads: Reads
  startChips: number
  outcome: Outcome | null
  isResultShown: boolean
  buyIn: number
  blindBase: number
}

export type Menu = { level: Level | null; isPickingLang?: boolean; isConfirmingQuit?: boolean; logFrom?: number | null; bet?: number | null }

/** The person's table setup, kept across sessions. */
export type Settings = { lang: Lang; name: string; buyIn: number; sb: number }

export type LevelStats = { games: number; wins: number; hands: number; handsWon: number; best: number }

export type Stats = Record<Level, LevelStats>

declare module 'claude-code' {
  interface PluginState {
    poker: { table: Game | null; menu: Menu; stats: Stats; setup: Settings }
  }
}

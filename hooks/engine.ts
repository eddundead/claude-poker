import type { Game, Level, Seat } from '../types'

// A card is rank * 4 + suit: rank 0..12 is 2..A, suit 0..3 is ♠♥♦♣.
export const RANKS = '23456789TJQKA'
export const SUITS = '♠♥♦♣'

export const LEVEL_NAMES: Record<Level, string> = {
  novice: 'Новичок',
  medium: 'Средний',
  pro: 'Профи',
}

export const STARTING_CHIPS = 1000
const HANDS_PER_LEVEL = 10
const BLINDS = [10, 15, 25, 40, 60, 100, 150, 250, 400, 600, 1000]
const BOT_NAMES = ['Боб', 'Ева', 'Макс', 'Лиза', 'Гоша', 'Ника']
const LOG_SIZE = 12

export type Action =
  | { kind: 'fold' }
  | { kind: 'call' }
  | { kind: 'raise'; to: number }

export function cardText(card: number): string {
  return RANKS[card >> 2]! + SUITS[card & 3]!
}

export function isRed(card: number): boolean {
  return (card & 3) === 1 || (card & 3) === 2
}

// ---------- hand evaluation ----------

const CATEGORY_NAMES = [
  'Старшая карта',
  'Пара',
  'Две пары',
  'Сет',
  'Стрит',
  'Флеш',
  'Фулл-хаус',
  'Каре',
  'Стрит-флеш',
]
const BASE = 13 ** 5

function score(category: number, ranks: number[]): number {
  let value = category
  for (let i = 0; i < 5; i++) value = value * 13 + (ranks[i] ?? 0)
  return value
}

function straightTop(mask: number): number {
  for (let top = 12; top >= 4; top--) {
    const run = 0b11111 << (top - 4)
    if ((mask & run) === run) return top
  }
  const wheel = (1 << 12) | 0b1111
  return (mask & wheel) === wheel ? 3 : -1
}

function topRanks(mask: number, count: number, skip: number[] = []): number[] {
  const out: number[] = []
  for (let r = 12; r >= 0 && out.length < count; r--) {
    if (mask & (1 << r) && !skip.includes(r)) out.push(r)
  }
  return out
}

/** Best five-card value of 5–7 cards; a higher number is a better hand. */
export function evaluate(cards: number[]): number {
  const counts = new Array<number>(13).fill(0)
  const suitMasks = [0, 0, 0, 0]
  const suitCounts = [0, 0, 0, 0]
  let mask = 0
  for (const c of cards) {
    const r = c >> 2
    const s = c & 3
    counts[r]!++
    suitMasks[s]! |= 1 << r
    suitCounts[s]!++
    mask |= 1 << r
  }
  const flushSuit = suitCounts.findIndex(n => n >= 5)
  if (flushSuit >= 0) {
    const top = straightTop(suitMasks[flushSuit]!)
    if (top >= 0) return score(8, [top])
  }
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
  }
  if (quads.length > 0) {
    const q = quads[0]!
    return score(7, [q, ...topRanks(mask, 1, [q])])
  }
  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    const t = trips[0]!
    return score(6, [t, Math.max(trips[1] ?? -1, pairs[0] ?? -1)])
  }
  if (flushSuit >= 0) return score(5, topRanks(suitMasks[flushSuit]!, 5))
  const straight = straightTop(mask)
  if (straight >= 0) return score(4, [straight])
  if (trips.length > 0) {
    const t = trips[0]!
    return score(3, [t, ...topRanks(mask, 2, [t])])
  }
  if (pairs.length >= 2) {
    const [a, b] = [pairs[0]!, pairs[1]!]
    return score(2, [a, b, ...topRanks(mask, 1, [a, b])])
  }
  if (pairs.length === 1) {
    const p = pairs[0]!
    return score(1, [p, ...topRanks(mask, 3, [p])])
  }
  return score(0, topRanks(mask, 5))
}

export function category(value: number): number {
  return Math.floor(value / BASE)
}

export function describe(value: number): string {
  const cat = category(value)
  const main = RANKS[Math.floor(value / 13 ** 4) % 13]!
  const second = RANKS[Math.floor(value / 13 ** 3) % 13]!
  switch (cat) {
    case 0:
    case 1:
    case 3:
    case 7:
      return `${CATEGORY_NAMES[cat]} ${main}`
    case 2:
      return `Две пары ${main} и ${second}`
    case 6:
      return `Фулл-хаус ${main} на ${second}`
    case 4:
    case 8:
      return `${CATEGORY_NAMES[cat]} до ${main}`
    default:
      return `Флеш, старшая ${main}`
  }
}

function shuffled<T>(cards: T[]): T[] {
  const out = cards.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Monte Carlo share of the pot against `opponents` random hands. */
export function equity(hand: number[], board: number[], opponents: number, sims: number): number {
  const used = new Set([...hand, ...board])
  const rest: number[] = []
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c)
  const need = opponents * 2 + (5 - board.length)
  let total = 0
  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (rest.length - i))
      ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
    }
    const full = board.concat(rest.slice(opponents * 2, need))
    const mine = evaluate(hand.concat(full))
    let ties = 1
    let isBeaten = false
    for (let o = 0; o < opponents; o++) {
      const theirs = evaluate([rest[o * 2]!, rest[o * 2 + 1]!, ...full])
      if (theirs > mine) {
        isBeaten = true
        break
      }
      if (theirs === mine) ties++
    }
    if (!isBeaten) total += 1 / ties
  }
  return total / sims
}

/** Chen formula, roughly 0..20, for the beginner bots' preflop sense. */
function chen(hand: number[]): number {
  const [a, b] = [hand[0]!, hand[1]!]
  const hi = Math.max(a >> 2, b >> 2)
  const lo = Math.min(a >> 2, b >> 2)
  const points = (r: number) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2)
  let value = points(hi)
  if (hi === lo) return Math.max(5, value * 2)
  if ((a & 3) === (b & 3)) value += 2
  const gap = hi - lo - 1
  value -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 10) value += 1
  return Math.ceil(value)
}

// ---------- table flow ----------

const canAct = (s: Seat) => !s.isOut && !s.isFolded && !s.isAllIn
const inHand = (s: Seat) => !s.isOut && !s.isFolded

export function pot(g: Game): number {
  return g.seats.reduce((sum, s) => sum + s.total, 0)
}

function say(g: Game, line: string) {
  g.log.push(line)
  if (g.log.length > LOG_SIZE) g.log.splice(0, g.log.length - LOG_SIZE)
}

function nextAlive(g: Game, from: number): number {
  const n = g.seats.length
  for (let k = 1; k <= n; k++) {
    const j = (from + k) % n
    if (!g.seats[j]!.isOut) return j
  }
  return from
}

function nextActor(g: Game, from: number): number {
  const n = g.seats.length
  for (let k = 1; k <= n; k++) {
    const j = (from + k) % n
    if (canAct(g.seats[j]!)) return j
  }
  return -1
}

function put(s: Seat, amount: number): number {
  const paid = Math.min(amount, s.chips)
  s.chips -= paid
  s.bet += paid
  s.total += paid
  if (s.chips === 0) s.isAllIn = true
  return paid
}

export function newGame(level: Level, bots: number): Game {
  const seat = (name: string, isHuman: boolean): Seat => ({
    name,
    isHuman,
    chips: STARTING_CHIPS,
    hand: [],
    bet: 0,
    total: 0,
    isFolded: false,
    isAllIn: false,
    isOut: false,
    hasActed: false,
    lastAction: '',
  })
  const names = shuffled(BOT_NAMES).slice(0, Math.max(1, Math.min(6, bots)))
  const g: Game = {
    level,
    seats: [seat('Вы', true), ...names.map(name => seat(name, false))],
    deck: [],
    board: [],
    dealer: 0,
    toAct: -1,
    street: 'done',
    currentBet: 0,
    minRaise: 0,
    sb: BLINDS[0]!,
    bb: BLINDS[0]! * 2,
    handNo: 0,
    log: [],
    isShowdown: false,
    isOver: false,
    reads: { hands: 0, raises: 0, calls: 0, folds: 0 },
  }
  g.dealer = Math.floor(Math.random() * g.seats.length)
  return startHand(g)
}

/** Deals the next hand and plays the bots up to the person's turn. */
export function startHand(g: Game): Game {
  if (g.isOver) return g
  for (const s of g.seats) {
    if (!s.isOut && s.chips === 0) {
      s.isOut = true
      if (g.handNo > 0) say(g, `${s.name} выбывает`)
    }
  }
  const me = g.seats[0]!
  const alive = g.seats.filter(s => !s.isOut)
  if (me.isOut || alive.length === 1) {
    g.isOver = true
    g.street = 'done'
    say(g, me.isOut ? 'Фишки закончились — игра окончена' : 'Все соперники разорены — победа!')
    return g
  }
  g.handNo++
  const step = Math.min(BLINDS.length - 1, Math.floor((g.handNo - 1) / HANDS_PER_LEVEL))
  if (BLINDS[step]! !== g.sb && g.handNo > 1) say(g, `Блайнды растут: ${BLINDS[step]}/${BLINDS[step]! * 2}`)
  g.sb = BLINDS[step]!
  g.bb = g.sb * 2
  for (const s of g.seats) {
    s.hand = []
    s.bet = 0
    s.total = 0
    s.isFolded = s.isOut
    s.isAllIn = false
    s.hasActed = false
    s.lastAction = ''
  }
  g.deck = shuffled(Array.from({ length: 52 }, (_, i) => i))
  g.board = []
  g.isShowdown = false
  g.street = 'preflop'
  g.log = g.log.slice(-2)
  say(g, `— Раздача #${g.handNo} —`)
  g.dealer = nextAlive(g, g.dealer)
  const sbSeat = alive.length === 2 ? g.dealer : nextAlive(g, g.dealer)
  const bbSeat = nextAlive(g, sbSeat)
  put(g.seats[sbSeat]!, g.sb)
  put(g.seats[bbSeat]!, g.bb)
  g.seats[sbSeat]!.lastAction = `SB ${g.seats[sbSeat]!.bet}`
  g.seats[bbSeat]!.lastAction = `BB ${g.seats[bbSeat]!.bet}`
  g.currentBet = g.bb
  g.minRaise = g.bb
  for (let round = 0; round < 2; round++) {
    let j = sbSeat
    for (let k = 0; k < alive.length; k++) {
      g.seats[j]!.hand.push(g.deck.pop()!)
      j = nextAlive(g, j)
    }
  }
  g.reads.hands++
  g.toAct = nextActor(g, bbSeat)
  if (g.toAct < 0) advance(g)
  return runBots(g)
}

/** The person's move: applies it and plays the bots up to their next turn. */
export function play(g: Game, action: Action): Game {
  if (g.street === 'done' || g.toAct !== 0) return g
  const me = g.seats[0]!
  const toCall = g.currentBet - me.bet
  if (action.kind === 'fold') g.reads.folds++
  else if (action.kind === 'raise') g.reads.raises++
  else if (toCall > 0) g.reads.calls++
  act(g, 0, action)
  return runBots(g)
}

function runBots(g: Game): Game {
  for (let guard = 0; guard < 500 && g.street !== 'done'; guard++) {
    if (g.toAct < 0) {
      advance(g)
      continue
    }
    if (g.seats[g.toAct]!.isHuman) break
    act(g, g.toAct, decide(g, g.toAct))
  }
  return g
}

function act(g: Game, i: number, action: Action) {
  const s = g.seats[i]!
  const toCall = g.currentBet - s.bet
  let label: string
  if (action.kind === 'fold') {
    s.isFolded = true
    label = 'фолд'
  } else if (action.kind === 'call' || action.to <= g.currentBet) {
    if (toCall <= 0) label = 'чек'
    else {
      const paid = put(s, toCall)
      label = s.isAllIn ? `олл-ин ${s.bet}` : `колл ${paid}`
    }
  } else {
    const most = s.bet + s.chips
    const least = Math.min(most, g.currentBet + g.minRaise)
    const to = Math.min(most, Math.max(least, Math.round(action.to)))
    if (to <= g.currentBet) {
      act(g, i, { kind: 'call' })
      return
    }
    const wasOpen = g.currentBet === 0
    if (to - g.currentBet >= g.minRaise) g.minRaise = to - g.currentBet
    g.currentBet = to
    put(s, to - s.bet)
    for (const other of g.seats) if (other !== s && canAct(other)) other.hasActed = false
    label = s.isAllIn ? `олл-ин ${to}` : wasOpen ? `бет ${to}` : `рейз до ${to}`
  }
  s.hasActed = true
  s.lastAction = label
  say(g, `${s.name}: ${label}`)
  advance(g)
}

function advance(g: Game) {
  const live = g.seats.filter(inHand)
  if (live.length === 1) {
    const winner = live[0]!
    const amount = pot(g)
    winner.chips += amount
    for (const s of g.seats) s.total = 0
    say(g, `${winner.name} забирает банк ${amount}`)
    g.street = 'done'
    g.toAct = -1
    return
  }
  const actors = g.seats.filter(canAct)
  const isRoundDone =
    actors.length === 0 ||
    (actors.length === 1 && actors[0]!.bet >= g.currentBet) ||
    actors.every(s => s.hasActed && s.bet === g.currentBet)
  if (!isRoundDone) {
    g.toAct = nextActor(g, g.toAct)
    return
  }
  for (const s of g.seats) {
    s.bet = 0
    s.hasActed = false
    if (!s.isFolded && !s.isAllIn) s.lastAction = ''
  }
  g.currentBet = 0
  g.minRaise = g.bb
  if (actors.length <= 1 || g.street === 'river') {
    showdown(g)
    return
  }
  const deal = g.street === 'preflop' ? 3 : 1
  for (let k = 0; k < deal; k++) g.board.push(g.deck.pop()!)
  g.street = g.street === 'preflop' ? 'flop' : g.street === 'flop' ? 'turn' : 'river'
  say(g, `${g.street === 'flop' ? 'Флоп' : g.street === 'turn' ? 'Тёрн' : 'Ривер'}: ${g.board.map(cardText).join(' ')}`)
  g.toAct = nextActor(g, g.dealer)
}

function showdown(g: Game) {
  while (g.board.length < 5) g.board.push(g.deck.pop()!)
  g.isShowdown = true
  g.street = 'done'
  g.toAct = -1
  const values = g.seats.map(s => (inHand(s) ? evaluate(s.hand.concat(g.board)) : -1))
  const levels = [...new Set(g.seats.filter(inHand).map(s => s.total))].sort((a, b) => a - b)
  const won = new Array<number>(g.seats.length).fill(0)
  let floor = 0
  levels.forEach((level, index) => {
    let slice = 0
    for (const s of g.seats) slice += Math.max(0, Math.min(s.total, level) - floor)
    if (index === levels.length - 1) {
      for (const s of g.seats) slice += Math.max(0, s.total - level)
    }
    const eligible = g.seats.map((s, i) => i).filter(i => inHand(g.seats[i]!) && g.seats[i]!.total >= level)
    const best = Math.max(...eligible.map(i => values[i]!))
    const winners = eligible.filter(i => values[i] === best)
    const share = Math.floor(slice / winners.length)
    winners.forEach((i, k) => (won[i]! += share + (k === 0 ? slice - share * winners.length : 0)))
    floor = level
  })
  g.seats.forEach((s, i) => {
    if (inHand(s)) say(g, `${s.name}: ${s.hand.map(cardText).join(' ')} — ${describe(values[i]!)}`)
  })
  g.seats.forEach((s, i) => {
    s.total = 0
    if (won[i]! > 0) {
      s.chips += won[i]!
      say(g, `${s.name} выигрывает ${won[i]}`)
    }
  })
}

// ---------- bots ----------

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step)
}

/** A bet or raise sized as a share of the pot after calling. */
function sized(g: Game, s: Seat, share: number): Action {
  const toCall = g.currentBet - s.bet
  const extra = Math.max(g.minRaise, roundTo(share * (pot(g) + toCall), 5))
  return { kind: 'raise', to: g.currentBet + extra }
}

function decide(g: Game, i: number): Action {
  if (g.level === 'novice') return decideNovice(g, i)
  if (g.level === 'medium') return decideMedium(g, i)
  return decidePro(g, i)
}

/** Loose and passive: calls too much, raises at random, sometimes tilts all-in. */
function decideNovice(g: Game, i: number): Action {
  const s = g.seats[i]!
  const toCall = g.currentBet - s.bet
  const r = Math.random()
  const made = [0.2, 0.5, 0.65, 0.75, 0.82, 0.86, 0.92, 0.97, 1]
  const strength =
    g.board.length === 0 ? chen(s.hand) / 20 : made[category(evaluate(s.hand.concat(g.board)))]!
  if (toCall === 0) {
    if ((strength > 0.7 && r < 0.35) || r < 0.07) return sized(g, s, 0.5)
    return { kind: 'call' }
  }
  if (strength > 0.85 && r < 0.3) return { kind: 'raise', to: g.currentBet * 2 }
  if (r < 0.02) return { kind: 'raise', to: s.bet + s.chips }
  if ((strength < 0.3 && toCall > g.bb * 4 && r < 0.6) || (strength < 0.15 && r < 0.4)) {
    return { kind: 'fold' }
  }
  return { kind: 'call' }
}

/** Solid but readable: plays its equity and pot odds, bluffs rarely. */
function decideMedium(g: Game, i: number): Action {
  const s = g.seats[i]!
  const toCall = g.currentBet - s.bet
  const opponents = g.seats.filter(inHand).length - 1
  const eq = equity(s.hand, g.board, opponents, 150)
  const rel = eq * (opponents + 1)
  const r = Math.random()
  if (toCall === 0) {
    if (rel > 1.5 && r < 0.85) return sized(g, s, 0.6)
    if (rel > 1.1 && r < 0.3) return sized(g, s, 0.5)
    if (r < 0.06) return sized(g, s, 0.5)
    return { kind: 'call' }
  }
  const odds = toCall / (pot(g) + toCall)
  if (rel > 2 && r < 0.7) return sized(g, s, 0.75)
  if (eq > odds + 0.05) return { kind: 'call' }
  if (g.street === 'preflop' && toCall <= g.bb && rel > 0.8) return { kind: 'call' }
  return { kind: 'fold' }
}

/** Sharp: Monte Carlo equity, traps, semi-bluffs, and reads the person's aggression. */
function decidePro(g: Game, i: number): Action {
  const s = g.seats[i]!
  const toCall = g.currentBet - s.bet
  const opponents = g.seats.filter(inHand).length - 1
  const eq = equity(s.hand, g.board, opponents, 400)
  const rel = eq * (opponents + 1)
  const r = Math.random()
  const total = pot(g)
  const me = g.seats[0]!
  const { raises, calls, folds } = g.reads
  const aggression = (raises + 1) / (raises + calls + folds + 3)
  const versusPerson = inHand(me) && me.bet === g.currentBet && g.currentBet > 0
  const bonus = !versusPerson ? 0 : aggression > 0.45 ? 0.07 : aggression < 0.2 ? -0.05 : 0
  const isShort = s.chips < total * 1.2
  if (toCall === 0) {
    if (rel > 1.7) {
      if (r < 0.2 && g.street !== 'river' && g.street !== 'preflop') return { kind: 'call' }
      return sized(g, s, 0.65 + r * 0.2)
    }
    if (rel > 1.15 && r < 0.55) return sized(g, s, 0.5)
    if (g.street !== 'river' && g.street !== 'preflop' && rel > 0.75 && r < 0.3) return sized(g, s, 0.6)
    if (opponents <= 2 && r < 0.15) return sized(g, s, 0.6)
    return { kind: 'call' }
  }
  const need = toCall / (total + toCall) - bonus
  if (rel > 2.1 || eq > 0.8) {
    if (isShort) return { kind: 'raise', to: s.bet + s.chips }
    return { kind: 'raise', to: Math.max(g.currentBet * 3, g.currentBet + roundTo(total, 5)) }
  }
  if (eq > need + 0.12 && rel > 1.4 && r < 0.35) return { kind: 'raise', to: g.currentBet * 2.5 }
  if (eq >= need) return { kind: 'call' }
  if (opponents === 1 && r < 0.06 && g.street !== 'river') return { kind: 'raise', to: g.currentBet * 2.5 }
  if (g.street === 'preflop' && toCall <= g.bb && eq > need * 0.8) return { kind: 'call' }
  return { kind: 'fold' }
}

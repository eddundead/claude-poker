import type { Act, Entry, Game, Level, Seat } from '../types'

// A card is rank * 4 + suit: rank 0..12 is 2..A, suit 0..3 is ♠♥♦♣.
export const RANKS = '23456789TJQKA'
export const SUITS = '♠♥♦♣'

export const STARTING_CHIPS = 1000
const HANDS_PER_LEVEL = 10
/** How the small blind grows every HANDS_PER_LEVEL hands, as multiples of the starting one. */
const BLIND_STEPS = [1, 1.5, 2.5, 4, 6, 10, 15, 25, 40, 60, 100]
export const BUY_INS = [500, 1000, 2000, 5000, 10000]
export const SMALL_BLINDS = [5, 10, 25, 50, 100]
const LOG_SIZE = 60

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

const BASE = 13 ** 5

// The evaluator runs thousands of times per equity estimate, so it allocates nothing:
// it counts into these buffers and packs the value as it goes.
const counts = new Uint8Array(13)
const suitMasks = new Int32Array(4)
const suitCounts = new Uint8Array(4)

function straightTop(mask: number): number {
  for (let top = 12; top >= 4; top--) {
    const run = 0b11111 << (top - 4)
    if ((mask & run) === run) return top
  }
  const wheel = (1 << 12) | 0b1111
  return (mask & wheel) === wheel ? 3 : -1
}

/** Appends the `count` highest ranks of `mask`, outside `skip`, to a packed value (zeros past the last). */
function kickers(value: number, mask: number, count: number, skip = 0): number {
  for (let r = 12; r >= 0 && count > 0; r--) {
    if ((mask >> r) & 1 && !((skip >> r) & 1)) {
      value = value * 13 + r
      count--
    }
  }
  for (; count > 0; count--) value *= 13
  return value
}

/** Pads a packed value to its five rank digits. */
function pad(value: number, digits: number): number {
  for (let k = digits; k < 5; k++) value *= 13
  return value
}

/**
 * Best five-card value of the first `length` cards (5–7); a higher number is a
 * better hand: the category, then five ranks, as base-13 digits.
 */
export function evaluate(cards: ArrayLike<number>, length = cards.length): number {
  counts.fill(0)
  suitMasks.fill(0)
  suitCounts.fill(0)
  let mask = 0
  for (let i = 0; i < length; i++) {
    const c = cards[i]!
    const r = c >> 2
    counts[r]!++
    suitMasks[c & 3]! |= 1 << r
    suitCounts[c & 3]!++
    mask |= 1 << r
  }
  let flush = -1
  for (let su = 0; su < 4; su++) if (suitCounts[su]! >= 5) flush = su
  if (flush >= 0) {
    const top = straightTop(suitMasks[flush]!)
    if (top >= 0) return pad(8 * 13 + top, 1)
  }
  let quad = -1
  let trip = -1
  let trip2 = -1
  let pair = -1
  let pair2 = -1
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]!
    if (n === 4) quad = quad < 0 ? r : quad
    else if (n === 3) {
      if (trip < 0) trip = r
      else if (trip2 < 0) trip2 = r
    } else if (n === 2) {
      if (pair < 0) pair = r
      else if (pair2 < 0) pair2 = r
    }
  }
  if (quad >= 0) return pad(kickers(7 * 13 + quad, mask, 1, 1 << quad), 2)
  if (trip >= 0 && (trip2 >= 0 || pair >= 0)) return pad((6 * 13 + trip) * 13 + Math.max(trip2, pair), 2)
  if (flush >= 0) return kickers(5, suitMasks[flush]!, 5)
  const straight = straightTop(mask)
  if (straight >= 0) return pad(4 * 13 + straight, 1)
  if (trip >= 0) return pad(kickers(3 * 13 + trip, mask, 2, 1 << trip), 3)
  if (pair2 >= 0) return pad(kickers((2 * 13 + pair) * 13 + pair2, mask, 1, (1 << pair) | (1 << pair2)), 3)
  if (pair >= 0) return pad(kickers(1 * 13 + pair, mask, 3, 1 << pair), 4)
  return kickers(0, mask, 5)
}

export function category(value: number): number {
  return Math.floor(value / BASE)
}

/** The ranks a hand's value is built from, highest first, for putting it into words. */
export function ranksOf(value: number): number[] {
  return [4, 3, 2, 1, 0].map(k => Math.floor(value / 13 ** k) % 13)
}

function shuffled<T>(cards: T[]): T[] {
  const out = cards.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

// Scratch space for equity: the unseen deck and the two seven-card hands compared.
const rest = new Uint8Array(52)
const mine = new Uint8Array(7)
const theirs = new Uint8Array(7)

/** Monte Carlo share of the pot against `opponents` random hands. */
export function equity(hand: number[], board: number[], opponents: number, sims: number): number {
  let seen = 0n
  for (const c of hand) seen |= 1n << BigInt(c)
  for (const c of board) seen |= 1n << BigInt(c)
  let left = 0
  for (let c = 0; c < 52; c++) if (!((seen >> BigInt(c)) & 1n)) rest[left++] = c
  const runout = 5 - board.length
  const need = opponents * 2 + runout
  mine[0] = hand[0]!
  mine[1] = hand[1]!
  for (let k = 0; k < board.length; k++) mine[2 + k] = theirs[2 + k] = board[k]!
  let total = 0
  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (left - i))
      const swap = rest[i]!
      rest[i] = rest[j]!
      rest[j] = swap
    }
    for (let k = 0; k < runout; k++) mine[2 + board.length + k] = theirs[2 + board.length + k] = rest[opponents * 2 + k]!
    const me = evaluate(mine, 7)
    let ties = 1
    let isBeaten = false
    for (let o = 0; o < opponents; o++) {
      theirs[0] = rest[o * 2]!
      theirs[1] = rest[o * 2 + 1]!
      const value = evaluate(theirs, 7)
      if (value > me) {
        isBeaten = true
        break
      }
      if (value === me) ties++
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

function say(g: Game, entry: Entry) {
  g.logCount = (g.logCount ?? g.log.length) + 1
  g.log.push(entry)
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

/** A new table; `names` are the bots' names in the person's language, shuffled here. */
export function newGame(
  level: Level,
  bots: number,
  names: string[],
  setup: { you: string; buyIn: number; sb: number } = { you: '', buyIn: STARTING_CHIPS, sb: 10 },
): Game {
  const seat = (name: string, isHuman: boolean): Seat => ({
    name,
    isHuman,
    chips: setup.buyIn,
    hand: [],
    bet: 0,
    total: 0,
    isFolded: false,
    isAllIn: false,
    isOut: false,
    hasActed: false,
    lastAction: null,
  })
  const picked = shuffled(names).slice(0, Math.max(1, Math.min(6, bots)))
  const g: Game = {
    level,
    seats: [seat(setup.you.trim().slice(0, 12), true), ...picked.map(name => seat(name, false))],
    deck: [],
    board: [],
    dealer: 0,
    toAct: -1,
    street: 'done',
    currentBet: 0,
    minRaise: 0,
    sb: setup.sb,
    bb: setup.sb * 2,
    handNo: 0,
    log: [],
    logCount: 0,
    isShowdown: false,
    isOver: false,
    reads: { hands: 0, raises: 0, calls: 0, folds: 0 },
    startChips: setup.buyIn,
    buyIn: setup.buyIn,
    blindBase: setup.sb,
    outcome: null,
    isResultShown: false,
  }
  g.dealer = Math.floor(Math.random() * g.seats.length)
  return startHand(g)
}

/** Deals the next hand; the bots then move one `stepBot` at a time. */
export function startHand(g: Game): Game {
  if (g.isOver) return g
  for (const s of g.seats) {
    if (!s.isOut && s.chips === 0) {
      s.isOut = true
      if (g.handNo > 0) say(g, { k: 'out', seat: g.seats.indexOf(s) })
    }
  }
  const me = g.seats[0]!
  const alive = g.seats.filter(s => !s.isOut)
  if (me.isOut || alive.length === 1) {
    g.isOver = true
    g.street = 'done'
    say(g, { k: 'over', isWon: !me.isOut })
    return g
  }
  g.handNo++
  g.startChips = me.chips
  g.outcome = null
  g.isResultShown = false
  const step = Math.min(BLIND_STEPS.length - 1, Math.floor((g.handNo - 1) / HANDS_PER_LEVEL))
  const sb = Math.round((g.blindBase ?? 10) * BLIND_STEPS[step]!)
  if (sb !== g.sb && g.handNo > 1) say(g, { k: 'blinds', sb, bb: sb * 2 })
  g.sb = sb
  g.bb = g.sb * 2
  for (const s of g.seats) {
    s.hand = []
    s.bet = 0
    s.total = 0
    s.isFolded = s.isOut
    s.isAllIn = false
    s.hasActed = false
    s.lastAction = null
  }
  g.deck = shuffled(Array.from({ length: 52 }, (_, i) => i))
  g.board = []
  g.isShowdown = false
  g.street = 'preflop'
  say(g, { k: 'hand', n: g.handNo })
  g.dealer = nextAlive(g, g.dealer)
  const sbSeat = alive.length === 2 ? g.dealer : nextAlive(g, g.dealer)
  const bbSeat = nextAlive(g, sbSeat)
  put(g.seats[sbSeat]!, g.sb)
  put(g.seats[bbSeat]!, g.bb)
  g.seats[sbSeat]!.lastAction = { k: 'sb', n: g.seats[sbSeat]!.bet }
  g.seats[bbSeat]!.lastAction = { k: 'bb', n: g.seats[bbSeat]!.bet }
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
  return g
}

/** The person's move. */
export function play(g: Game, action: Action): Game {
  if (g.street === 'done' || g.toAct !== 0) return g
  const me = g.seats[0]!
  const toCall = g.currentBet - me.bet
  if (action.kind === 'fold') g.reads.folds++
  else if (action.kind === 'raise') g.reads.raises++
  else if (toCall > 0) g.reads.calls++
  act(g, 0, action)
  return g
}

/** Whether the hand waits on a bot rather than on the person. */
export function needsBots(g: Game): boolean {
  return g.street !== 'done' && (g.toAct < 0 || !g.seats[g.toAct]!.isHuman)
}

/** One bot's move, so the table can show each one in turn. */
export function stepBot(g: Game): Game {
  if (!needsBots(g)) return g
  if (g.toAct < 0) advance(g)
  else act(g, g.toAct, decide(g, g.toAct))
  return g
}

function act(g: Game, i: number, action: Action) {
  const s = g.seats[i]!
  const toCall = g.currentBet - s.bet
  let label: Act
  if (action.kind === 'fold') {
    s.isFolded = true
    label = { k: 'fold' }
  } else if (action.kind === 'call' || action.to <= g.currentBet) {
    if (toCall <= 0) label = { k: 'check' }
    else {
      const paid = put(s, toCall)
      label = s.isAllIn ? { k: 'allin', n: s.bet } : { k: 'call', n: paid }
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
    label = s.isAllIn ? { k: 'allin', n: to } : wasOpen ? { k: 'bet', n: to } : { k: 'raise', n: to }
  }
  s.hasActed = true
  s.lastAction = label
  say(g, { k: 'act', seat: i, act: label })
  advance(g)
}

function advance(g: Game) {
  const live = g.seats.filter(inHand)
  if (live.length === 1) {
    const winner = live[0]!
    const amount = pot(g)
    winner.chips += amount
    for (const s of g.seats) s.total = 0
    say(g, { k: 'takes', seat: g.seats.indexOf(winner), n: amount })
    g.street = 'done'
    g.toAct = -1
    g.outcome = { byFold: true, winners: [{ seat: g.seats.indexOf(winner), amount }], shown: [] }
    finishHand(g)
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
    if (!s.isFolded && !s.isAllIn) s.lastAction = null
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
  say(g, { k: 'street', street: g.street, cards: g.board.slice() })
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
  g.outcome = {
    byFold: false,
    winners: won.flatMap((amount, seat) => (amount > 0 ? [{ seat, amount }] : [])),
    shown: g.seats.flatMap((s, seat) => (inHand(s) ? [{ seat, value: values[seat]! }] : [])),
  }
  g.seats.forEach((s, i) => {
    if (inHand(s)) say(g, { k: 'shows', seat: i, value: values[i]!, cards: s.hand.slice() })
  })
  g.seats.forEach((s, i) => {
    s.total = 0
    if (won[i]! > 0) {
      s.chips += won[i]!
      say(g, { k: 'wins', seat: i, n: won[i]! })
    }
  })
  finishHand(g)
}

/** Ends the game the moment the person or every bot is out of chips. */
function finishHand(g: Game) {
  const me = g.seats[0]!
  if (me.chips === 0) {
    g.isOver = true
    say(g, { k: 'over', isWon: false })
  } else if (g.seats.slice(1).every(s => s.chips === 0)) {
    g.isOver = true
    say(g, { k: 'over', isWon: true })
  }
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

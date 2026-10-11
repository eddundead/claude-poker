import type { Game, Seat } from '../types'
import { RANKS, SUITS, isRed, pot } from './engine'
import { type Dict, actText, describe, seatName } from './i18n'

// The table is painted cell by cell onto a canvas, then cut into runs of one style.

export type Style = { color?: string; bg?: string; bold?: boolean; dim?: boolean }
export type Run = { text: string; style: Style }

export const TABLE_WIDTH = 66
/** Where the result banner's button row sits on the table, in cells. */
export const BANNER_BUTTONS = { top: 15, left: 14, width: 37 }
const TABLE_HEIGHT = 22
const SEAT_WIDTH = 15
/** A card's width in cells, and the step from one card to the next. */
const CARD_WIDTH = 5
const CARD_STEP = CARD_WIDTH + 1

const FELT = '#0e6b2d'
const FELT_TEXT = '#a5d6a7'
const RAIL = '#6b3f1d'
const GOLD = '#ffd54f'
const CARD = '#f5f5f5'
const INK = '#111111'
const RED = '#d32f2f'
const BACK = '#1e3a8a'
const BACK_PATTERN = '#4f7be8'

/** Terminal cells a character takes: two for CJK and other wide scripts, one otherwise. */
export function charWidth(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0
  const isWide =
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  return isWide ? 2 : 1
}

export function textWidth(text: string): number {
  let w = 0
  for (const ch of text) w += charWidth(ch)
  return w
}

/** Cuts `text` to `width` cells, ending in an ellipsis when it had to cut. */
export function fit(text: string, width: number): string {
  if (textWidth(text) <= width) return text
  let out = ''
  let w = 0
  for (const ch of text) {
    if (w + charWidth(ch) > width - 1) break
    out += ch
    w += charWidth(ch)
  }
  return out + '…'
}

export const padCells = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - textWidth(text)))

// Colors are interned to small ids, so a cell's style is three bytes rather than an object.
const palette: string[] = ['']
const colorIds = new Map<string, number>()

function colorId(color: string): number {
  let id = colorIds.get(color)
  if (id === undefined) {
    id = palette.length
    palette.push(color)
    colorIds.set(color, id)
  }
  return id
}

const BOLD = 1
const DIM = 2

// A wide character fills its cell and leaves '' in the next, which `rows` skips.
class Canvas {
  private chars: string[]
  private fg: Uint8Array
  private bgs: Uint8Array
  private flags: Uint8Array

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.chars = new Array<string>(w * h).fill(' ')
    this.fg = new Uint8Array(w * h)
    this.bgs = new Uint8Array(w * h)
    this.flags = new Uint8Array(w * h)
  }

  /** Writes `text` from (x, y), laying `style` over what the cells had: a field left out keeps theirs. */
  put(x: number, y: number, text: string, style: Style = {}) {
    if (y < 0 || y >= this.h) return
    const fg = style.color === undefined ? -1 : colorId(style.color)
    const bg = style.bg === undefined ? -1 : colorId(style.bg)
    const set = (style.bold ? BOLD : 0) | (style.dim ? DIM : 0)
    const keep = ~((style.bold === undefined ? 0 : BOLD) | (style.dim === undefined ? 0 : DIM))
    const row = y * this.w
    let at = x
    for (const ch of text) {
      const cw = charWidth(ch)
      if (at >= 0 && at + cw <= this.w) {
        const i = row + at
        if (this.chars[i] === '' && at > 0) this.chars[i - 1] = ' '
        if (charWidth(this.chars[i] || ' ') === 2 && at + 1 < this.w) this.chars[i + 1] = ' '
        this.chars[i] = ch
        if (fg >= 0) this.fg[i] = fg
        if (bg >= 0) this.bgs[i] = bg
        this.flags[i] = (this.flags[i]! & keep) | set
        if (cw === 2) {
          if (charWidth(this.chars[i + 1] || ' ') === 2 && at + 2 < this.w) this.chars[i + 2] = ' '
          this.chars[i + 1] = ''
          this.fg[i + 1] = this.fg[i]!
          this.bgs[i + 1] = this.bgs[i]!
          this.flags[i + 1] = this.flags[i]!
        }
      }
      at += cw
    }
  }

  bg(x: number, y: number, color: string) {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return
    this.bgs[y * this.w + x] = colorId(color)
  }

  /**
   * Cuts each row into runs of one look. A space shows only its background, so it
   * joins whatever run it sits in: far fewer elements for the surface to draw.
   */
  rows(): Run[][] {
    const out: Run[][] = []
    for (let y = 0; y < this.h; y++) {
      const runs: Run[] = []
      let text = ''
      let bg = -1
      let fg = 0
      let flags = 0
      let hasInk = false
      const flush = () => {
        if (!text) return
        const style: Style = {}
        if (hasInk && fg) style.color = palette[fg]!
        if (bg > 0) style.bg = palette[bg]!
        if (hasInk && flags & BOLD) style.bold = true
        if (hasInk && flags & DIM) style.dim = true
        runs.push({ text, style })
      }
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x
        const ch = this.chars[i]!
        if (ch === '') continue
        const cellBg = this.bgs[i]!
        const isInk = ch !== ' '
        const fits =
          text !== '' &&
          cellBg === bg &&
          (!isInk || !hasInk || (this.fg[i] === fg && this.flags[i] === flags))
        if (!fits) {
          flush()
          text = ''
          bg = cellBg
          hasInk = false
        }
        if (isInk && !hasInk) {
          fg = this.fg[i]!
          flags = this.flags[i]!
          hasInk = true
        }
        text += ch
      }
      flush()
      out.push(runs)
    }
    return out
  }
}

const rankLabel = (card: number) => (RANKS[card >> 2] === 'T' ? '10' : RANKS[card >> 2]!)

/** A 5×3 pixel card: rank top-left, suit dead centre, rank bottom-right. */
function card(c: Canvas, x: number, y: number, value: number) {
  const style: Style = { bg: CARD, color: isRed(value) ? RED : INK, bold: true }
  const rank = rankLabel(value)
  const suit = SUITS[value & 3]!
  const side = (CARD_WIDTH - 1) / 2
  c.put(x, y, rank.padEnd(CARD_WIDTH), style)
  c.put(x, y + 1, ' '.repeat(side) + suit + ' '.repeat(side), style)
  c.put(x, y + 2, rank.padStart(CARD_WIDTH), style)
}

function cardBack(c: Canvas, x: number, y: number) {
  for (let k = 0; k < 3; k++) c.put(x, y + k, '▚'.repeat(CARD_WIDTH), { bg: BACK, color: BACK_PATTERN })
}

function cardSlot(c: Canvas, x: number, y: number) {
  for (let k = 0; k < 3; k++) c.put(x, y + k, '░'.repeat(CARD_WIDTH), { color: '#2f8f4f' })
}

function felt(c: Canvas, left: number, top: number, width: number, height: number) {
  const cx = left + width / 2
  const cy = top + height / 2
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const dx = (x + 0.5 - cx) / (width / 2)
      const dy = (y + 0.5 - cy) / (height / 2)
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= 1) c.bg(x, y, d > 0.86 ? RAIL : FELT)
    }
  }
}

function centered(c: Canvas, y: number, text: string, style: Style) {
  c.put(Math.floor((c.w - textWidth(text)) / 2), y, text, style)
}

const THINKING = '#3d3400'
const WINNER = '#163d20'
const WIN = '#66bb6a'
const SCREEN = '#101820'
const MUTED = '#9e9e9e'

/** Left offset that centers `cells` of content in a seat. */
const inSeat = (cells: number) => Math.max(0, Math.floor((SEAT_WIDTH - cells) / 2))

function seat(c: Canvas, x: number, y: number, g: Game, i: number, t: Dict) {
  const s: Seat = g.seats[i]!
  const isTurn = g.street !== 'done' && g.toAct === i
  const prize = g.street === 'done' ? (g.outcome?.winners.find(w => w.seat === i)?.amount ?? 0) : 0
  const tint = isTurn ? THINKING : prize > 0 ? WINNER : undefined
  if (tint) for (let k = 0; k < 5; k++) c.put(x, y + k, ' '.repeat(SEAT_WIDTH), { bg: tint })
  const mark = isTurn ? '▶ ' : prize > 0 ? '★ ' : ''
  const name = fit(`${mark}${seatName(t, g, i)}${i === g.dealer ? ' Ⓓ' : ''}`, SEAT_WIDTH)
  const nameStyle: Style = isTurn
    ? { bg: GOLD, color: INK, bold: true }
    : prize > 0
      ? { bg: WIN, color: INK, bold: true }
      : { bold: s.isHuman, dim: s.isFolded || s.isOut }
  const nameAt = inSeat(textWidth(name))
  c.put(x, y, padCells(' '.repeat(nameAt) + name, SEAT_WIDTH), nameStyle)
  if (s.isOut) {
    const out = fit(t.out, SEAT_WIDTH)
    c.put(x + inSeat(textWidth(out)), y + 2, out, { dim: true })
    return
  }
  const showCards = s.isHuman || (g.isShowdown && !s.isFolded)
  const cardsAt = x + inSeat(CARD_STEP + CARD_WIDTH)
  if (s.hand.length === 2 && !s.isFolded) {
    s.hand.forEach((value, k) =>
      showCards ? card(c, cardsAt + k * CARD_STEP, y + 1, value) : cardBack(c, cardsAt + k * CARD_STEP, y + 1),
    )
  } else if (s.isFolded && s.hand.length === 2) {
    const folded = fit(t.folded, SEAT_WIDTH)
    c.put(x + inSeat(textWidth(folded)), y + 2, folded, { dim: true })
  }
  const chips = `◉${s.chips}`
  const note = isTurn
    ? { text: s.isHuman ? t.yourTurnSeat : t.thinking, style: { color: GOLD, bold: true } }
    : prize > 0
      ? { text: `+${prize}`, style: { color: WIN, bold: true } }
      : { text: s.isFolded ? '' : actText(t, s.lastAction), style: { dim: true } }
  const text = fit(note.text, SEAT_WIDTH - chips.length - 1)
  const width = chips.length + (text ? 1 + textWidth(text) : 0)
  const chipsAt = x + inSeat(width)
  c.put(chipsAt, y + 4, chips, { color: GOLD, bold: true })
  if (text) c.put(chipsAt + chips.length + 1, y + 4, text, note.style)
}

type Slot = 'bl' | 'l' | 'tl' | 't' | 'tr' | 'r' | 'br'
const SLOTS: Record<Slot | 'me', [number, number]> = {
  me: [26, 17],
  bl: [4, 17],
  l: [0, 8],
  tl: [3, 0],
  t: [26, 0],
  tr: [49, 0],
  r: [51, 8],
  br: [48, 17],
}
// Clockwise from the person at the bottom, as play goes round.
const LAYOUTS: Record<number, Slot[]> = {
  1: ['t'],
  2: ['tl', 'tr'],
  3: ['l', 't', 'r'],
  4: ['l', 'tl', 'tr', 'r'],
  5: ['l', 'tl', 't', 'tr', 'r'],
  6: ['bl', 'l', 'tl', 'tr', 'r', 'br'],
}

/** Who took the pot, in the words the felt shows once a hand ends. */
function headline(g: Game, t: Dict): { top: string; bottom: string } {
  const winners = g.outcome?.winners ?? []
  if (winners.length === 0) return { top: t.handOver, bottom: '' }
  const first = winners[0]!
  const who = g.seats[first.seat]!
  const total = winners.reduce((sum, w) => sum + w.amount, 0)
  const top =
    winners.length > 1
      ? t.split(`◉${total}`)
      : who.isHuman
        ? t.youTake(`◉${first.amount}`)
        : t.takes(who.name, `◉${first.amount}`)
  const bottom = g.outcome?.byFold
    ? t.othersFolded
    : (() => {
        const shown = g.outcome?.shown.find(s => s.seat === first.seat)
        return shown ? describe(t, shown.value) : ''
      })()
  return { top, bottom }
}

export function drawTable(g: Game, t: Dict): Run[][] {
  const c = new Canvas(TABLE_WIDTH, TABLE_HEIGHT)
  felt(c, 15, 5, 36, 12)
  const isDone = g.street === 'done'
  const words = isDone ? headline(g, t) : undefined
  const amount = pot(g)
  centered(c, 7, words ? ` ${fit(words.top, 32)} ` : amount > 0 ? ` ${t.pot} ◉${amount} ` : ' ♠ ♥ ♦ ♣ ', {
    color: words ? WIN : GOLD,
    bold: true,
  })
  const boardX = Math.floor((TABLE_WIDTH - (CARD_STEP * 4 + CARD_WIDTH)) / 2)
  for (let k = 0; k < 5; k++) {
    const value = g.board[k]
    if (value === undefined) cardSlot(c, boardX + k * CARD_STEP, 9)
    else card(c, boardX + k * CARD_STEP, 9, value)
  }
  centered(c, 13, words ? fit(words.bottom, 30) : t.streets[g.street], { color: FELT_TEXT, bold: Boolean(words) })
  const layout = LAYOUTS[g.seats.length - 1] ?? LAYOUTS[6]!
  seat(c, ...SLOTS.me, g, 0, t)
  layout.forEach((slot, k) => seat(c, ...SLOTS[slot], g, k + 1, t))
  if (isDone && g.isResultShown) banner(c, g, t, 13, 5, 39, 12)
  return c.rows()
}

/** The menu's banner: CLAUDE POKER in block letters, the author's mark, a row of pixel cards. */
export function drawLogo(): Run[][] {
  const c = new Canvas(CARD_STEP * 4 + CARD_WIDTH, 9)
  const word = (text: string, y: number, style: Style) => {
    const rows = bigText(text, 0)
    rows.forEach((row, k) => c.put(Math.floor((c.w - textWidth(row)) / 2), y + k, row, style))
    return Math.floor((c.w + textWidth(rows[0]!)) / 2)
  }
  word('CLAUDE', 0, { color: RED, bold: true })
  const right = word('POKER', 2, { color: '#2e7d32', bold: true })
  c.put(right - 6, 4, 'by Edd', { color: RED, dim: true })
  ;[49, 45, 41, 37, 33].forEach((value, k) => card(c, k * CARD_STEP, 6, value))
  return c.rows()
}

// ---------- the result of a hand ----------

const FONT: Record<string, [string, string]> = {
  A: ['█▀█', '█▀█'],
  C: ['█▀▀', '█▄▄'],
  D: ['█▀▄', '█▄▀'],
  E: ['█▀▀', '██▄'],
  G: ['█▀▀', '█▄█'],
  H: ['█ █', '█▀█'],
  I: ['█', '█'],
  K: ['█▄▀', '█ █'],
  L: ['█  ', '█▄▄'],
  M: ['█▀▄▀█', '█ ▀ █'],
  N: ['█▄ █', '█ ▀█'],
  O: ['█▀█', '█▄█'],
  P: ['█▀█', '█▀▀'],
  R: ['█▀█', '█▀▄'],
  S: ['█▀▀', '▄▄█'],
  T: ['▀█▀', ' █ '],
  U: ['█ █', '█▄█'],
  V: ['█ █', '▀▄▀'],
  W: ['█ █ █', '▀▄▀▄▀'],
  Y: ['█▄█', ' █ '],
  '!': ['█', '▄'],
  ' ': [' ', ' '],
}

/** Block letters two rows tall, or four with every half-block doubled when there is room. */
function bigText(text: string, width: number): string[] {
  const rows = ['', '']
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[' ']!
    rows[0] += glyph[0] + ' '
    rows[1] += glyph[1] + ' '
  }
  const small = rows.map(r => r.slice(0, -1))
  if (small[0]!.length * 2 > width) return small
  const big = ['', '', '', '']
  small.forEach((row, r) => {
    for (const ch of row) {
      big[r * 2] += ch === '█' || ch === '▀' ? '██' : '  '
      big[r * 2 + 1] += ch === '█' || ch === '▄' ? '██' : '  '
    }
  })
  return big
}

type Verdict = { title: string; color: string; line: string; isWin?: boolean }

function verdict(g: Game, t: Dict): Verdict {
  const me = g.seats[0]!
  const delta = me.chips - (g.startChips ?? me.chips)
  if (g.isOver && me.chips === 0) return { title: 'GAME OVER', color: RED, line: t.lostAll(g.handNo) }
  if (g.isOver) return { title: 'CHAMPION!', color: GOLD, line: t.champion(`◉${me.chips}`), isWin: true }
  if (delta > 0) return { title: 'YOU WIN', color: WIN, line: t.won(`◉${delta}`, `◉${me.chips}`), isWin: true }
  if (me.isFolded) {
    return { title: 'FOLD', color: MUTED, line: delta < 0 ? t.foldLoss(`◉${-delta}`) : t.foldedYou }
  }
  if (delta === 0) return { title: 'SPLIT', color: GOLD, line: t.even }
  return { title: 'YOU LOSE', color: RED, line: t.lost(`◉${-delta}`, `◉${me.chips}`) }
}

/** The players worth a line: the winners first, then whoever else showed down. */
function details(g: Game, t: Dict): { seat: number; hand: string; amount: number }[] {
  const outcome = g.outcome ?? null
  if (!outcome) return []
  if (outcome.byFold) {
    return outcome.winners.map(w => ({ seat: w.seat, hand: t.othersFolded, amount: w.amount }))
  }
  const amountOf = (seat: number) => outcome.winners.find(w => w.seat === seat)?.amount ?? 0
  return outcome.shown
    .map(s => ({ seat: s.seat, hand: describe(t, s.value), amount: amountOf(s.seat) }))
    .sort((a, b) => b.amount - a.amount)
}

function frame(c: Canvas, x: number, y: number, w: number, h: number, color: string) {
  for (let k = 0; k < h; k++) c.put(x, y + k, ' '.repeat(w), { bg: SCREEN })
  const style: Style = { color, bg: SCREEN, bold: true }
  c.put(x, y, '╔' + '═'.repeat(w - 2) + '╗', style)
  c.put(x, y + h - 1, '╚' + '═'.repeat(w - 2) + '╝', style)
  for (let k = 1; k < h - 1; k++) {
    c.put(x, y + k, '║', style)
    c.put(x + w - 1, y + k, '║', style)
  }
}

function detailLine(
  c: Canvas,
  x0: number,
  y: number,
  w: number,
  g: Game,
  t: Dict,
  d: { seat: number; hand: string; amount: number },
) {
  const s = g.seats[d.seat]!
  let x = x0 + 2
  c.put(x, y, padCells(fit(seatName(t, g, d.seat), 6), 7), { color: s.isHuman ? GOLD : 'white', bold: true })
  x += 7
  if (!g.outcome?.byFold) {
    for (const value of s.hand) {
      const label = (rankLabel(value) + SUITS[value & 3]).padStart(3) + ' '
      c.put(x, y, label, { bg: CARD, color: isRed(value) ? RED : INK, bold: true })
      x += 5
    }
  }
  const prize = d.amount > 0 ? `+◉${d.amount}` : ''
  const right = x0 + w - 2
  c.put(x, y, fit(d.hand, right - x - prize.length - 1), { color: d.amount > 0 ? 'white' : MUTED })
  c.put(right - prize.length, y, prize, { color: GOLD, bold: true })
}

const CONFETTI = ['✦', '✧', '★', '✺', '♪', '❖', '✶']
const CONFETTI_COLORS = ['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff', '#e040fb', '#ffab40']

/** Sprinkles party glyphs along a banner's frame, the same pattern on every redraw. */
function confetti(c: Canvas, x: number, y: number, w: number, h: number) {
  const spot = (cx: number, cy: number, k: number) =>
    c.put(cx, cy, CONFETTI[k % CONFETTI.length]!, { color: CONFETTI_COLORS[(k * 5) % CONFETTI_COLORS.length]!, bold: true })
  for (let k = 0, cx = x + 2; cx < x + w - 2; k++, cx += 3) {
    spot(cx, y, k)
    spot(cx + 1, y + h - 1, k + 3)
  }
  for (let k = 0, cy = y + 2; cy < y + h - 2; k++, cy += 3) {
    spot(x, cy, k + 1)
    spot(x + w - 1, cy + 1, k + 4)
  }
}

/** The result laid over the middle of the table, the seats still in view around it. */
function banner(c: Canvas, g: Game, t: Dict, x: number, y: number, w: number, h: number) {
  const v = verdict(g, t)
  frame(c, x, y, w, h, v.color)
  if (v.isWin) confetti(c, x, y, w, h)
  const title = bigText(v.title, w - 4)
  let row = y + 1
  for (const line of title) {
    c.put(x + Math.floor((w - Array.from(line).length) / 2), row++, line, { color: v.color, bold: true })
  }
  if (title.length < 4) row++
  const line = v.isWin ? `🎉 ${fit(v.line, w - 10)} 🏆` : fit(v.line, w - 4)
  c.put(x + Math.floor((w - textWidth(line)) / 2), row++, line, { color: 'white', bold: true })
  row++
  for (const d of details(g, t)) {
    if (row >= y + h - 2) break
    detailLine(c, x, row++, w, g, t, d)
  }
}

/** The result on its own, for a pane too narrow for the table. */
export function drawResult(g: Game, width: number, t: Dict): Run[][] {
  const lines = details(g, t).length
  const height = Math.max(10, 9 + lines)
  const c = new Canvas(width, height)
  banner(c, g, t, 0, 0, width, height)
  return c.rows()
}

import { expect, test } from 'claude-code/testing'

import type { Game, Level } from '../types'
import {
    evaluate,
  needsBots,
  newGame,
  play,
  pot,
  startHand,
  stepBot,
  type Action,
} from '../hooks/engine'
import { DICTS, describe, entryText, holding } from '../hooks/i18n'
import { charWidth, fit, textWidth } from '../hooks/table'

const name = (value: number) => describe(DICTS.ru, value)
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

const card = (text: string) => '23456789TJQKA'.indexOf(text[0]!) * 4 + '♠♥♦♣'.indexOf(text[1]!)
const hand = (text: string) => text.split(' ').map(card)
const chips = (g: Game) => g.seats.reduce((sum, s) => sum + s.chips, 0) + pot(g)

function randomMove(g: Game): Action {
  const r = Math.random()
  if (r < 0.15) return { kind: 'fold' }
  if (r < 0.75) return { kind: 'call' }
  return { kind: 'raise', to: g.currentBet * (r < 0.95 ? 2 : 100) }
}

test('hands rank in poker order', () => {
  const order = [
    'A♠ K♦ 9♣ 7♥ 4♦ 3♠ 2♣',
    'A♠ A♦ 9♣ 7♥ 4♦ 3♠ 2♣',
    'A♠ A♦ 9♣ 9♥ 4♦ 3♠ 2♣',
    'Q♠ Q♦ Q♣ 9♥ 4♦ 3♠ 2♣',
    'A♠ 2♦ 3♣ 4♥ 5♦ 9♠ K♣',
    '9♠ T♦ J♣ Q♥ K♦ 2♠ 2♣',
    'A♥ 9♥ 7♥ 4♥ 2♥ K♠ K♣',
    'K♠ K♦ K♣ 4♥ 4♦ 3♠ 2♣',
    '7♠ 7♦ 7♣ 7♥ 4♦ 3♠ 2♣',
    '5♥ 6♥ 7♥ 8♥ 9♥ K♠ K♣',
  ].map(h => evaluate(hand(h)))
  for (let i = 1; i < order.length; i++) expect(order[i]! > order[i - 1]!).toBe(true)
  expect(name(order[7]!)).toBe('Фулл-хаус K на 4')
  expect(name(order[4]!)).toBe('Стрит до 5')
  expect(name(evaluate(hand('T♠ T♦ 9♣ 7♥ 4♦ 3♠ 2♣')))).toBe('Пара 10')
})

test('chips are never created or lost, at every level and table size', () => {
  for (const level of ['novice', 'medium', 'pro'] as Level[]) {
    for (let bots = 1; bots <= 6; bots++) {
      let g = newGame(level, bots, NAMES, { you: 'Эд', buyIn: 2000, sb: 25 })
      const total = 2000 * (bots + 1)
      expect(g.sb).toBe(25)
      for (let step = 0; step < 400 && !g.isOver; step++) {
        expect(chips(g)).toBe(total)
        g = g.street === 'done' ? startHand(g) : play(g, randomMove(g))
        for (let guard = 0; guard < 200 && needsBots(g); guard++) {
          g = stepBot(g)
          expect(chips(g)).toBe(total)
        }
        expect(needsBots(g)).toBe(false)
        if (g.street !== 'done') expect(g.toAct).toBe(0)
      }
      expect(chips(g)).toBe(total)
      for (const s of g.seats) expect(s.chips >= 0).toBe(true)
    }
  }
})

test('every language words the log, the hands and the hint', () => {
  const g = newGame('pro', 3, NAMES)
  for (const t of Object.values(DICTS)) {
    for (const entry of g.log) expect(entryText(t, g, entry).length > 0).toBe(true)
    expect(holding(t, hand('A♠ K♠'), [], evaluate)).toContain(t.suited)
    expect(holding(t, hand('9♠ 9♦'), [], evaluate)).toBe(t.hands.pair('9'))
    expect(t.odds(42, 3)).toContain('42')
  }
  expect(holding(DICTS.en, hand('A♠ K♦'), hand('A♥ 7♣ 2♦'), evaluate)).toBe('Pair of A')
})

test('wide characters take two cells', () => {
  expect(charWidth('中')).toBe(2)
  expect(charWidth('🎉')).toBe(2)
  expect(textWidth('小明 A')).toBe(6)
  expect(textWidth(fit('ストレートフラッシュ', 9))).toBe(9)
})

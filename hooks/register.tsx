import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Game, Level, LevelStats, Menu, Stats } from '../types'
import {
  LEVEL_NAMES,
  STARTING_CHIPS,
  cardText,
  describe,
  evaluate,
  isRed,
  newGame,
  play,
  pot,
  startHand,
  type Action,
} from './engine'

const PANE = 'poker'
const LEVELS: Level[] = ['novice', 'medium', 'pro']
const blank = (): LevelStats => ({ games: 0, wins: 0, hands: 0, handsWon: 0, best: STARTING_CHIPS })
const emptyStats = (): Stats => ({ novice: blank(), medium: blank(), pro: blank() })

const game = atom({ plugin: 'poker', key: 'game' } as const, null)
const menu = atom({ plugin: 'poker', key: 'menu' } as const, { level: null })
const stats = atom({ plugin: 'poker', key: 'stats' } as const, emptyStats())

const clone = (g: Game): Game => JSON.parse(JSON.stringify(g))

function parseLevel(word: string): Level | undefined {
  const w = word.toLowerCase()
  if (['новичок', 'новичек', 'novice', 'easy', 'n'].includes(w)) return 'novice'
  if (['средний', 'medium', 'mid', 'm'].includes(w)) return 'medium'
  if (['профи', 'про', 'pro', 'hard', 'p'].includes(w)) return 'pro'
  return undefined
}

async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: '♠ Покер', focus: true })
}

/** Applies a change to the game, then saves it and books any finished hand into the stats. */
async function change($: EngineInterface, fn: (g: Game) => Game) {
  let before: Game | null = null
  const after = await update($, game, g => {
    before = g
    return g ? fn(clone(g)) : g
  })
  await $.store.set('game', after)
  const prev = before as Game | null
  if (!after || !prev) return
  const isHandOver = after.street === 'done' && (prev.street !== 'done' || prev.handNo !== after.handNo)
  const isGameOver = after.isOver && !prev.isOver
  if (!isHandOver && !isGameOver) return
  const me = after.seats[0]!
  const stack = prev.street === 'done' ? prev.seats[0]!.chips : prev.seats[0]!.chips + prev.seats[0]!.total
  const saved = await update($, stats, all => {
    const one = { ...all[after.level] }
    if (isHandOver && !isGameOver) {
      one.hands++
      if (me.chips > stack) one.handsWon++
    }
    if (isGameOver) {
      one.games++
      if (!me.isOut) one.wins++
    }
    one.best = Math.max(one.best, me.chips)
    return { ...all, [after.level]: one }
  })
  await $.store.set('stats', saved)
}

async function start($: EngineInterface, level: Level, bots: number) {
  const fresh = newGame(level, bots)
  await update($, game, () => fresh)
  await update($, menu, () => ({ level: null }))
  await $.store.set('game', fresh)
}

async function toMenu($: EngineInterface) {
  await update($, game, () => null)
  await update($, menu, () => ({ level: null }))
  await $.store.set('game', null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'poker',
      description: 'Техасский холдем в панели: играйте, пока Claude работает',
      argumentHint: '[новичок|средний|профи] [1-6]',
    })
    const loaded = await $.state.get({ plugin: 'poker', key: 'game' })
    if (loaded.version === 0) {
      const savedGame = (await $.store.get('game')) as Game | null | undefined
      const savedStats = (await $.store.get('stats')) as Stats | undefined
      if (savedGame) await update($, game, () => savedGame)
      if (savedStats) await update($, stats, () => ({ ...emptyStats(), ...savedStats }))
    }

    return next(e)
  })

  on('command.run', { command: 'poker' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)
    const level = words.map(parseLevel).find(Boolean)
    const count = words.map(Number).find(n => Number.isInteger(n) && n >= 1 && n <= 6)
    if (level && count) await start($, level, count)
    else if (level) await update($, menu, () => ({ level }))
    await openPane($)

    return { text: 'Покер открыт в панели. ctrl+x tab — переключиться в панель, Esc — вернуться к промпту.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const g = await read($, game)
    const m: Menu = await read($, menu)
    const all = await read($, stats)
    const width = e.props.bodyColumns

    const Card = ({ card }: { card: number }) => (
      <Text bold color={isRed(card) ? 'red' : 'text'}>
        {cardText(card)}
      </Text>
    )
    const Back = () => <Text dimColor>▮▮</Text>

    if (!g) {
      if (!m.level) {
        return (
          <Box flexDirection="column">
            <Text bold>♠♥ Техасский холдем ♦♣</Text>
            <Text dimColor>Выберите уровень соперников:</Text>
            <Box flexDirection="column" marginY={1}>
              {LEVELS.map((level, k) => (
                <Button
                  key={level}
                  plain
                  hotkey={String(k + 1)}
                  label={LEVEL_NAMES[level]}
                  onPress={() => update($, menu, () => ({ level }))}
                />
              ))}
            </Box>
            <Text dimColor>Статистика (партии · победы · раздачи · лучший стек):</Text>
            {LEVELS.map(level => {
              const s = all[level]
              return (
                <Text dimColor>
                  {LEVEL_NAMES[level].padEnd(8)} {s.games} · {s.wins} · {s.handsWon}/{s.hands} · {s.best}
                </Text>
              )
            })}
          </Box>
        )
      }
      const chosen = m.level
      return (
        <Box flexDirection="column">
          <Text bold>Уровень: {LEVEL_NAMES[chosen]}</Text>
          <Text dimColor>Сколько соперников за столом?</Text>
          <Box flexWrap="wrap" columnGap={2} marginY={1}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <Button key={`bots-${n}`} plain hotkey={String(n)} label={`${n}`} onPress={() => start($, chosen, n)} />
            ))}
          </Box>
          <Button key="back" plain hotkey="b" label="Назад" onPress={() => update($, menu, () => ({ level: null }))} />
        </Box>
      )
    }

    const me = g.seats[0]!
    const isMyTurn = g.street !== 'done' && g.toAct === 0
    const toCall = Math.max(0, g.currentBet - me.bet)
    const potNow = pot(g)
    const most = me.bet + me.chips
    const minTo = Math.min(most, g.currentBet + g.minRaise)
    const halfTo = Math.min(most, g.currentBet + Math.max(g.minRaise, Math.round((potNow + toCall) / 2)))
    const potTo = Math.min(most, g.currentBet + Math.max(g.minRaise, potNow + toCall))
    const canRaise = me.chips > toCall
    const go = (action: Action) => change($, s => play(s, action))
    const logRoom = Math.max(3, (e.viewport?.rows ?? 30) - g.seats.length - 14)

    return (
      <Box flexDirection="column" width={width}>
        <Text>
          <Text bold>♠ {LEVEL_NAMES[g.level]}</Text>
          <Text dimColor>
            {' '}· раздача #{g.handNo} · блайнды {g.sb}/{g.bb}
          </Text>
        </Text>
        <Box columnGap={1} marginTop={1}>
          <Text>Борд:</Text>
          {g.board.map(c => (
            <Card card={c} />
          ))}
          {Array.from({ length: 5 - g.board.length }, () => (
            <Text dimColor>··</Text>
          ))}
          <Text>
            {'  '}Банк: <Text bold color="warning">{potNow}</Text>
          </Text>
        </Box>
        <Box flexDirection="column" marginY={1}>
          {g.seats.map((s, i) => {
            const isTurn = g.street !== 'done' && g.toAct === i
            const showCards = s.isHuman || (g.isShowdown && !s.isFolded && !s.isOut)
            return (
              <Box columnGap={1}>
                <Text color={isTurn ? 'claude' : undefined}>{isTurn ? '▶' : ' '}</Text>
                <Text bold={s.isHuman} dimColor={s.isFolded || s.isOut} wrap="truncate">
                  {(s.name + (i === g.dealer ? ' Ⓓ' : '')).padEnd(7)}
                </Text>
                <Text dimColor={s.isOut}>{String(s.chips).padStart(5)}</Text>
                {s.isOut ? (
                  <Text dimColor>выбыл</Text>
                ) : s.hand.length === 0 || s.isFolded ? (
                  <Text dimColor>    </Text>
                ) : showCards ? (
                  <Box columnGap={1}>
                    {s.hand.map(c => (
                      <Card card={c} />
                    ))}
                  </Box>
                ) : (
                  <Box columnGap={1}>
                    <Back />
                    <Back />
                  </Box>
                )}
                <Text dimColor wrap="truncate">
                  {s.lastAction}
                </Text>
              </Box>
            )
          })}
        </Box>
        {me.hand.length > 0 && g.board.length >= 3 && !me.isFolded && (
          <Text>
            Ваша рука: <Text bold>{describe(evaluate(me.hand.concat(g.board)))}</Text>
          </Text>
        )}
        <Box flexDirection="column" marginY={1}>
          {g.log.slice(-logRoom).map(line => (
            <Text dimColor wrap="truncate">
              {line}
            </Text>
          ))}
        </Box>
        {isMyTurn && (
          <Box flexWrap="wrap" columnGap={2}>
            <Button key="fold" plain hotkey="f" label="Фолд" onPress={() => go({ kind: 'fold' })} />
            <Button
              key="call"
              plain
              hotkey="c"
              label={toCall === 0 ? 'Чек' : toCall >= me.chips ? `Колл олл-ин ${me.chips}` : `Колл ${toCall}`}
              onPress={() => go({ kind: 'call' })}
            />
            {canRaise && minTo < most && (
              <Button key="raise" plain hotkey="r" label={`Рейз ${minTo}`} onPress={() => go({ kind: 'raise', to: minTo })} />
            )}
            {canRaise && halfTo > minTo && halfTo < most && (
              <Button key="half" plain hotkey="h" label={`½ банка ${halfTo}`} onPress={() => go({ kind: 'raise', to: halfTo })} />
            )}
            {canRaise && potTo > halfTo && potTo < most && (
              <Button key="pot" plain hotkey="p" label={`Банк ${potTo}`} onPress={() => go({ kind: 'raise', to: potTo })} />
            )}
            {canRaise && (
              <Button key="allin" plain hotkey="a" label={`Олл-ин ${most}`} onPress={() => go({ kind: 'raise', to: most })} />
            )}
          </Box>
        )}
        {g.street === 'done' && (
          <Box flexWrap="wrap" columnGap={2}>
            {g.isOver ? (
              <Button
                key="again"
                plain
                hotkey="n"
                variant="primary"
                label="Новая игра"
                onPress={() => start($, g.level, g.seats.length - 1)}
              />
            ) : (
              <Button key="next" plain hotkey="n" label="Следующая раздача" onPress={() => change($, startHand)} />
            )}
            <Button key="menu" plain hotkey="m" label="Меню" onPress={() => toMenu($)} />
          </Box>
        )}
        {!isMyTurn && g.street !== 'done' && <Text dimColor>Ход соперников…</Text>}
      </Box>
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { Atom, EngineInterface, Register } from 'claude-code'

import type { Game, Lang, Level, LevelStats, Menu, Settings, Stats } from '../types'
import {
  BUY_INS,
  SMALL_BLINDS,
  STARTING_CHIPS,
  cardText,
  equity,
  evaluate,
  isRed,
  needsBots,
  newGame,
  play,
  pot,
  startHand,
  stepBot,
  type Action,
} from './engine'
import { DICTS, LANGS, type Dict, actText, entryText, holding, isLang, langOf, seatName } from './i18n'
import { BANNER_BUTTONS, TABLE_WIDTH, drawLogo, drawResult, drawTable, fit, type Run } from './table'

const PANE = 'poker'
const LEVELS: Level[] = ['novice', 'medium', 'pro']
const blank = (): LevelStats => ({ games: 0, wins: 0, hands: 0, handsWon: 0, best: STARTING_CHIPS })
const emptyStats = (): Stats => ({ novice: blank(), medium: blank(), pro: blank() })
const defaults = (): Settings => ({ lang: 'en', name: '', buyIn: STARTING_CHIPS, sb: 10 })

const table = atom({ plugin: 'poker', key: 'table' } as const, null)
const menu = atom({ plugin: 'poker', key: 'menu' } as const, { level: null })
const stats = atom({ plugin: 'poker', key: 'stats' } as const, emptyStats())
// Typed by hand: this build infers the contract's object values as a plain record here.
const settings = atom({ plugin: 'poker', key: 'setup' } as const, defaults()) as unknown as Atom<Settings>

const clone = (g: Game): Game => JSON.parse(JSON.stringify(g))
const next = <T,>(list: T[], value: T): T => list[(list.indexOf(value) + 1) % list.length]!

const BOT_PAUSE_MS = 700
const BOT_JITTER_MS = 500
const REVEAL_MS = 2200
const ODDS_SIMS = 800
const LOG_ROWS = 5

// The one pending pause of the table: a bot about to move, or the result about to show.
let pending: { cancel: () => void } | undefined

/** Schedules the table's next beat, unless one is already waiting. */
function pump($: EngineInterface) {
  if (pending) return
  void Promise.all([read($, table), read($, menu)])
    .then(([g, m]) => {
      if (pending || !g || m.isConfirmingQuit) return
      if (needsBots(g)) {
        const pause = g.toAct < 0 ? BOT_PAUSE_MS / 2 : BOT_PAUSE_MS + Math.random() * BOT_JITTER_MS
        beat($, pause, () => change($, stepBot))
      } else if (g.street === 'done' && !g.isResultShown) {
        const hand = g.handNo
        beat($, REVEAL_MS, () =>
          change($, s => (s.street === 'done' && s.handNo === hand ? { ...s, isResultShown: true } : s)),
        )
      }
    })
    .catch(() => {})
}

function beat($: EngineInterface, ms: number, fn: () => Promise<void>) {
  pending = $.clock.after(ms, () => {
    pending = undefined
    void fn().then(() => pump($))
  })
}

// The person's chance to win, worked out once per spot rather than on every redraw.
let odds: { key: string; value: number } | undefined

function chance(g: Game): { pct: number; opponents: number } | undefined {
  const me = g.seats[0]!
  if (g.street === 'done' || me.isFolded || me.hand.length !== 2) return undefined
  const opponents = g.seats.filter(s => !s.isOut && !s.isFolded).length - 1
  if (opponents < 1) return undefined
  const key = `${g.handNo}|${me.hand.join()}|${g.board.join()}|${opponents}`
  if (odds?.key !== key) odds = { key, value: equity(me.hand, g.board, opponents, ODDS_SIMS) }
  return { pct: Math.round(odds.value * 100), opponents }
}

function parseLevel(word: string): Level | undefined {
  const w = word.toLowerCase()
  const aliases: Record<Level, string[]> = {
    novice: ['novice', 'easy', 'новичок', 'новичек'],
    medium: ['medium', 'mid', 'средний'],
    pro: ['pro', 'hard', 'профи', 'про'],
  }
  return LEVELS.find(
    level => aliases[level].includes(w) || LANGS.some(lang => DICTS[lang].levels[level].toLowerCase() === w),
  )
}

async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: '♠ Claude Poker', focus: true, columns: TABLE_WIDTH + 4, rows: 42 })
}

async function save($: EngineInterface, fn: (s: Settings) => Settings) {
  const value = await update($, settings, fn)
  await $.store.set('settings', value)
}

/** Applies a change to the game, then saves it and books any finished hand into the stats. */
async function change($: EngineInterface, fn: (g: Game) => Game) {
  let before: Game | null = null
  const after = await update($, table, g => {
    before = g
    return g ? fn(clone(g)) : g
  })
  // Bot moves come one a second; the store is a file, so save only where the table waits on
  // the person (their turn, a finished hand). A restart mid-sequence resumes from there.
  if (!after || !needsBots(after)) await $.store.set('table', after)
  pump($)
  const prev = before as Game | null
  if (!after || !prev) return
  const isHandOver = after.street === 'done' && (prev.street !== 'done' || prev.handNo !== after.handNo)
  const isGameOver = after.isOver && !prev.isOver
  if (!isHandOver && !isGameOver) return
  const me = after.seats[0]!
  const stack = prev.street === 'done' ? prev.seats[0]!.chips : prev.seats[0]!.chips + prev.seats[0]!.total
  const saved = await update($, stats, all => {
    const one = { ...all[after.level] }
    if (isHandOver) {
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
  const s = await read($, settings)
  const fresh = newGame(level, bots, DICTS[s.lang].bots, { you: s.name, buyIn: s.buyIn, sb: s.sb })
  await update($, table, () => fresh)
  await update($, menu, () => ({ level: null }))
  await $.store.set('table', fresh)
  pump($)
}

async function toMenu($: EngineInterface) {
  pending?.cancel()
  pending = undefined
  await update($, table, () => null)
  await update($, menu, () => ({ level: null }))
  await $.store.set('table', null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const loaded = await $.state.get({ plugin: 'poker', key: 'setup' })
    if (loaded.version === 0) {
      const savedSettings = (await $.store.get('settings')) as Partial<Settings> | undefined
      const fromEnv = langOf(await $.env.get('LANG')) ?? langOf(await $.env.get('LC_ALL'))
      const lang = isLang(savedSettings?.lang) ? savedSettings.lang : (fromEnv ?? 'en')
      await update($, settings, () => ({ ...defaults(), ...savedSettings, lang }))
      const savedTable = (await $.store.get('table')) as Game | null | undefined
      const savedStats = (await $.store.get('stats')) as Stats | undefined
      if (savedTable) await update($, table, () => savedTable)
      if (savedStats) await update($, stats, () => ({ ...emptyStats(), ...savedStats }))
    }
    const t = DICTS[(await read($, settings)).lang]
    await $.command.register({
      name: 'poker',
      description: t.description,
      argumentHint: '[novice|medium|pro] [1-6] [en|ru|zh|es|fr|de|ja|pt|ko|it]',
    })
    pump($)

    return next(e)
  })

  on('command.run', { command: 'poker' }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(Boolean)
    const lang = words.map(w => w.toLowerCase()).find(isLang)
    if (lang) await save($, s => ({ ...s, lang }))
    const level = words.map(parseLevel).find(Boolean)
    const count = words.map(Number).find(n => Number.isInteger(n) && n >= 1 && n <= 6)
    if (level && count) await start($, level, count)
    else if (level) await update($, menu, () => ({ level }))
    await openPane($)

    return { text: DICTS[(await read($, settings)).lang].opened }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements ? elements.Input : undefined
    const g = await read($, table)
    const m: Menu = await read($, menu)
    const all = await read($, stats)
    const setup = await read($, settings)
    const t: Dict = DICTS[setup.lang] ?? DICTS.en
    const width = e.props.bodyColumns
    const height = e.props.scroll.bodyRows
    pump($)

    const Picture = ({ rows }: { rows: Run[][] }) => (
      <Box flexDirection="column">
        {rows.map(runs => (
          <Text wrap="truncate">
            {runs.map(run => (
              <Text
                {...(run.style.color ? { color: run.style.color } : {})}
                {...(run.style.bg ? { backgroundColor: run.style.bg } : {})}
                {...(run.style.bold ? { bold: true } : {})}
                {...(run.style.dim ? { dimColor: true } : {})}
              >
                {run.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    )
    const CardText = ({ card }: { card: number }) => (
      <Text bold backgroundColor="#f5f5f5" color={isRed(card) ? '#d32f2f' : '#111111'}>
        {' ' + cardText(card).replace('T', '10') + ' '}
      </Text>
    )

    if (!g && m.isPickingLang) {
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" width={width} minHeight={height}>
          <Box marginBottom={1}>
            <Picture rows={drawLogo()} />
          </Box>
          <Text bold>{t.language}</Text>
          <Box borderStyle="round" flexDirection="column" paddingX={2} marginY={1}>
            {LANGS.map((lang, k) => (
              <Button
                key={`lang-${lang}`}
                plain
                hotkey={String((k + 1) % 10)}
                label={`${DICTS[lang].flag}  ${DICTS[lang].name}${lang === setup.lang ? '  ✓' : ''}`}
                onPress={async () => {
                  await save($, s => ({ ...s, lang }))
                  await update($, menu, () => ({ level: null }))
                }}
              />
            ))}
          </Box>
          <Button key="back" plain hotkey="b" label={t.back} onPress={() => update($, menu, () => ({ level: null }))} />
        </Box>
      )
    }

    if (!g && !m.level) {
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" width={width} minHeight={height}>
          <Box marginBottom={1}>
            <Picture rows={drawLogo()} />
          </Box>
          <Box borderStyle="round" flexDirection="column" paddingX={1} marginTop={1} width={Math.min(width, 60)}>
            <Text bold>{t.setup}</Text>
            {Input && (
            <Input
              key="name"
              label={t.nameLabel}
              placeholder={t.namePlaceholder}
              value={setup.name}
              onInput={(value: string) => save($, s => ({ ...s, name: value.slice(0, 12) }))}
              onSubmit={(value: string) => save($, s => ({ ...s, name: value.trim().slice(0, 12) }))}
            />
            )}
            <Box flexWrap="wrap" columnGap={3}>
              <Button
                key="lang"
                plain
                hotkey="l"
                label={`${t.language}: ${t.flag} ${t.name}`}
                onPress={() => update($, menu, () => ({ level: null, isPickingLang: true }))}
              />
              <Button
                key="buyin"
                plain
                hotkey="i"
                label={`${t.buyIn}: ◉${setup.buyIn}`}
                onPress={() => save($, s => ({ ...s, buyIn: next(BUY_INS, s.buyIn) }))}
              >
                {`${t.buyIn}: `}
                <Text color="#ffd54f" bold>
                  ◉{setup.buyIn}
                </Text>
              </Button>
              <Button
                key="stakes"
                plain
                hotkey="s"
                label={`${t.stakes}: ${setup.sb}/${setup.sb * 2}`}
                onPress={() => save($, s => ({ ...s, sb: next(SMALL_BLINDS, s.sb) }))}
              />
            </Box>
          </Box>
          <Text dimColor>{t.choose}</Text>
          <Box borderStyle="round" flexDirection="column" paddingX={1} width={Math.min(width, 60)}>
            {LEVELS.map((level, k) => (
              <Button
                key={level}
                plain
                hotkey={String(k + 1)}
                label={t.levels[level]}
                onPress={() => update($, menu, () => ({ level }))}
              />
            ))}
          </Box>
          <Text dimColor>{t.stats}</Text>
          {LEVELS.map(level => {
            const s = all[level]
            return (
              <Text dimColor>
                {t.levels[level]}: {s.games} · {s.wins} · {s.handsWon}/{s.hands} · ◉{s.best}
              </Text>
            )
          })}
        </Box>
      )
    }

    if (!g) {
      const chosen = m.level!
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" width={width} minHeight={height}>
          <Box marginBottom={1}>
            <Picture rows={drawLogo()} />
          </Box>
          <Text bold>
            {t.level}: {t.levels[chosen]} · {t.howMany}
          </Text>
          <Text dimColor>
            {t.buyIn} ◉{setup.buyIn} · {t.stakes} {setup.sb}/{setup.sb * 2}
          </Text>
          <Box borderStyle="round" flexWrap="wrap" columnGap={3} paddingX={1} marginY={1}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <Button key={`bots-${n}`} plain hotkey={String(n)} label={`${n}`} onPress={() => start($, chosen, n)} />
            ))}
            <Button key="back" plain hotkey="b" label={t.back} onPress={() => update($, menu, () => ({ level: null }))} />
          </Box>
        </Box>
      )
    }

    const me = g.seats[0]!
    const isDone = g.street === 'done'
    const isMyTurn = !isDone && g.toAct === 0
    const toCall = Math.max(0, g.currentBet - me.bet)
    const potNow = pot(g)
    const most = me.bet + me.chips
    const minTo = Math.min(most, g.currentBet + g.minRaise)
    const halfTo = Math.min(most, g.currentBet + Math.max(g.minRaise, Math.round((potNow + toCall) / 2)))
    const potTo = Math.min(most, g.currentBet + Math.max(g.minRaise, potNow + toCall))
    const canRaise = me.chips > toCall
    const go = async (action: Action) => {
      await update($, menu, v => ({ ...v, bet: null }))
      await change($, s => play(s, action))
    }
    // The custom bet: a pending "raise to" amount, kept between minTo and the whole stack.
    const clampBet = (n: number) => Math.min(most, Math.max(minTo, Math.round(n)))
    const bet = clampBet(m.bet ?? minTo)
    const setBet = (n: number) => update($, menu, v => ({ ...v, bet: clampBet(n) }))
    const isWide = width >= TABLE_WIDTH
    const boxWidth = isWide ? TABLE_WIDTH : width
    const odds = chance(g)
    const held = !isDone && !me.isFolded && me.hand.length === 2 ? holding(t, me.hand, g.board, evaluate) : ''

    const compact = (
      <Box flexDirection="column">
        <Box columnGap={1}>
          {g.board.map(c => (
            <CardText card={c} />
          ))}
          <Text color="#ffd54f" bold>
            {' '}◉{potNow}
          </Text>
        </Box>
        {g.seats.map((s, i) => (
          <Box columnGap={1}>
            <Text color={!isDone && g.toAct === i ? '#ffd54f' : 'text'}>{!isDone && g.toAct === i ? '▶' : ' '}</Text>
            <Text bold={s.isHuman} dimColor={s.isFolded || s.isOut}>
              {fit(seatName(t, g, i) + (i === g.dealer ? ' Ⓓ' : ''), 10)}
            </Text>
            <Text color="#ffd54f">◉{s.chips}</Text>
            {!s.isOut && !s.isFolded && s.hand.length === 2 && (s.isHuman || g.isShowdown) ? (
              s.hand.map(c => <CardText card={c} />)
            ) : (
              <Text dimColor>{s.isOut ? t.out : s.isFolded ? t.folded : '▚▚ ▚▚'}</Text>
            )}
            <Text dimColor wrap="truncate">
              {actText(t, s.lastAction)}
            </Text>
          </Box>
        ))}
      </Box>
    )

    const status = isDone
      ? g.isOver
        ? t.gameOver
        : t.handOver
      : isMyTurn
        ? `${t.yourTurn}${toCall > 0 ? ` · ${t.toCall} ◉${toCall}` : ''}`
        : t.turnOf(seatName(t, g, g.toAct))

    const isBanner = isWide && isDone && g.isResultShown
    // The log is a window of LOG_ROWS lines; `logFrom` pins it by entry number, null follows the end.
    const logCount = g.logCount ?? g.log.length
    const logFirst = logCount - g.log.length
    const logBottom = Math.max(logFirst, logCount - LOG_ROWS)
    const logFrom = Math.min(logBottom, Math.max(logFirst, m.logFrom ?? logBottom))
    const scrollLog = (to: number) =>
      update($, menu, v => ({ ...v, logFrom: to >= logBottom ? null : Math.max(logFirst, to) }))
    const nextButton = g.isOver ? (
      <Button key="again" plain hotkey="n" label={t.newGame} onPress={() => start($, g.level, g.seats.length - 1)} />
    ) : (
      <Button key="next" plain hotkey="n" label={t.next} onPress={() => change($, startHand)} />
    )
    const menuButton = <Button key="menu" plain hotkey="m" label={t.menu} onPress={() => toMenu($)} />
    const isAsking = !isDone && Boolean(m.isConfirmingQuit)
    const ask = (isConfirmingQuit: boolean) => update($, menu, v => ({ ...v, isConfirmingQuit })).then(() => pump($))
    const bar = odds ? '█'.repeat(Math.round(odds.pct / 10)) + '░'.repeat(10 - Math.round(odds.pct / 10)) : ''
    const oddsColor = !odds ? 'text' : odds.pct >= 50 ? '#66bb6a' : odds.pct >= 25 ? '#ffd54f' : '#ef5350'

    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" width={width} minHeight={height}>
        <Box flexDirection="column" width={boxWidth}>
          <Text wrap="truncate">
            <Text bold>♠ {t.levels[g.level]}</Text>
            <Text dimColor>
              {' '}· {t.hand} #{g.handNo} · {t.blinds} {g.sb}/{g.bb}
            </Text>
          </Text>
          {isDone && !isWide && g.isResultShown ? (
            <Picture rows={drawResult(g, Math.max(40, width), t)} />
          ) : (
            <Box flexDirection="column">
              {isWide ? <Picture rows={drawTable(g, t)} /> : compact}
              {isBanner && (
                <Box
                  position="absolute"
                  top={BANNER_BUTTONS.top}
                  left={BANNER_BUTTONS.left}
                  width={BANNER_BUTTONS.width}
                  justifyContent="center"
                  columnGap={4}
                  backgroundColor="#101820"
                >
                  {nextButton}
                  {menuButton}
                </Box>
              )}
            </Box>
          )}
          <Text wrap="truncate">
            {held
              ? [
                  <Text dimColor>{t.hint}: </Text>,
                  <Text bold>{held}</Text>,
                  ...(odds
                    ? [
                        <Text dimColor> · </Text>,
                        <Text color={oddsColor}>{bar}</Text>,
                        <Text color={oddsColor} bold>
                          {' ' + t.odds(odds.pct, odds.opponents)}
                        </Text>,
                      ]
                    : []),
                ]
              : ' '}
          </Text>
          <Box
            borderStyle="round"
            borderColor={isMyTurn ? '#ffd54f' : isDone ? 'claude' : 'subtle'}
            flexDirection="column"
            paddingX={1}
          >
            <Text bold={isMyTurn || isAsking} dimColor={!isMyTurn && !isDone && !isAsking} {...(isAsking ? { color: '#ef5350' } : {})} wrap="truncate">
              {isAsking ? t.quitAsk : status}
            </Text>
            {isAsking ? (
              <Box columnGap={3}>
                <Button key="quit-yes" plain hotkey="y" variant="primary" label={t.yes} onPress={() => toMenu($)} />
                <Button key="quit-no" plain hotkey="n" label={t.no} onPress={() => ask(false)} />
              </Box>
            ) : (
            <Box flexWrap="wrap" columnGap={2}>
              {isMyTurn && <Button key="fold" plain hotkey="f" label={t.fold} onPress={() => go({ kind: 'fold' })} />}
              {isMyTurn && (
                <Button
                  key="call"
                  plain
                  hotkey="c"
                  label={toCall === 0 ? t.check : toCall >= me.chips ? `${t.call} ${t.allIn} ${me.chips}` : `${t.call} ${toCall}`}
                  onPress={() => go({ kind: 'call' })}
                />
              )}
              {isMyTurn && canRaise && minTo < most && (
                <Button key="raise" plain hotkey="r" label={`${t.raise} ${minTo}`} onPress={() => go({ kind: 'raise', to: minTo })} />
              )}
              {isMyTurn && canRaise && halfTo > minTo && halfTo < most && (
                <Button key="half" plain hotkey="h" label={`${t.halfPot} ${halfTo}`} onPress={() => go({ kind: 'raise', to: halfTo })} />
              )}
              {isMyTurn && canRaise && potTo > halfTo && potTo < most && (
                <Button key="pot" plain hotkey="p" label={`${t.potButton} ${potTo}`} onPress={() => go({ kind: 'raise', to: potTo })} />
              )}
              {isMyTurn && canRaise && (
                <Button key="allin" plain hotkey="a" label={`${t.allIn} ${most}`} onPress={() => go({ kind: 'raise', to: most })} />
              )}
              {isDone && !isBanner && nextButton}
              {isDone && !isBanner && menuButton}
              {isBanner && (
                <Text dimColor>
                  n — {g.isOver ? t.newGame : t.next} · m — {t.menu}
                </Text>
              )}
              {!isMyTurn && !isDone && <Text dimColor>{t.waiting}</Text>}
              {!isDone && <Button key="quit" plain hotkey="q" dimColor label={t.quit} onPress={() => ask(true)} />}
            </Box>
            )}
            {isMyTurn && !isAsking && canRaise && minTo < most && (
              <Box flexWrap="wrap" columnGap={2} alignItems="center">
                {Input && (
                  <Input
                    key="bet"
                    label={t.betTo}
                    placeholder={`${minTo}–${most}`}
                    value={String(bet)}
                    onInput={(value: string) => {
                      const n = Number(value.replace(/\D/g, ''))
                      if (n > 0) void setBet(n)
                    }}
                    onSubmit={(value: string) => {
                      const n = Number(value.replace(/\D/g, ''))
                      void go({ kind: 'raise', to: clampBet(n > 0 ? n : bet) })
                    }}
                  />
                )}
                <Button key="bet-down" plain hotkey="z" label="−" dimColor={bet <= minTo} onPress={() => setBet(bet - g.bb)} />
                <Button key="bet-up" plain hotkey="x" label="+" dimColor={bet >= most} onPress={() => setBet(bet + g.bb)} />
                <Button
                  key="bet-go"
                  plain
                  hotkey="b"
                  label={`${t.betTo} ${bet}${bet >= most ? ` (${t.allIn})` : ''}`}
                  onPress={() => go({ kind: 'raise', to: bet })}
                />
              </Box>
            )}
          </Box>
          <Box borderStyle="round" borderColor="subtle" flexDirection="column" paddingX={1}>
            <Box justifyContent="space-between">
              <Text dimColor>
                ☰ {logFrom - logFirst + 1}–{Math.min(logFrom + LOG_ROWS, logCount) - logFirst} / {g.log.length}
              </Text>
              <Box columnGap={2}>
                <Button key="log-up" plain hotkey="k" label="▲" dimColor={logFrom <= logFirst} onPress={() => scrollLog(logFrom - 1)} />
                <Button key="log-down" plain hotkey="j" label="▼" dimColor={logFrom >= logBottom} onPress={() => scrollLog(logFrom + 1)} />
              </Box>
            </Box>
            {Array.from({ length: LOG_ROWS }, (_, k) => {
              const entry = g.log[logFrom - logFirst + k]
              return (
                <Text dimColor={logFrom + k < logCount - 1} wrap="truncate">
                  {entry && typeof entry === 'object' ? entryText(t, g, entry) : ' '}
                </Text>
              )
            })}
          </Box>
        </Box>
      </Box>
    )
  })
}

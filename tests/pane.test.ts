import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'poker',
  props: {
    title: '♠ Покер',
    isFocused: true,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
  viewport: { columns: 160, rows: 50 },
} as const

type Ui = { find: (q: { key: string }) => Promise<unknown> }
type Clock = { advance: (ms: number) => Promise<void> }

/** Lets the paced bots play until one of the keys is on screen. */
async function waitFor(ui: Ui, clock: Clock, keys: string[]): Promise<string> {
  for (let k = 0; k < 200; k++) {
    for (const key of keys) if (await ui.find({ key })) return key
    await clock.advance(500)
  }
  throw new Error(`none of ${keys.join(', ')} appeared`)
}

test('the menu picks a level and a table size, then hands are dealt and paced', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'poker', surface, ...PANE })
    await ui.press({ key: 'pro' })
    expect(await ui.find({ key: 'bots-6' })).toBeDefined()
    await ui.press({ key: 'bots-3' })
    expect(await ui.find({ type: 'Text', text: /#1\b/ })).toBeDefined()
    if ((await waitFor(ui, clock, ['fold', 'next'])) === 'fold') await ui.press({ key: 'fold' })
    await waitFor(ui, clock, ['next'])
    await ui.press({ key: 'next' })
    expect(await ui.find({ type: 'Text', text: /#2\b/ })).toBeDefined()
    if ((await waitFor(ui, clock, ['fold', 'next'])) === 'fold') await ui.press({ key: 'fold' })
    await waitFor(ui, clock, ['next'])
    await ui.press({ key: 'menu' })
    expect(await ui.find({ key: 'novice' })).toBeDefined()
    await ui.unmount()
  }
})

test('a bot thinks before it moves, and the result shows over the table after a pause', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'poker', surface: 'terminal', ...PANE })
  await ui.press({ key: 'novice' })
  await ui.press({ key: 'bots-6' })
  expect(await ui.find({ type: 'Text', text: /thinks…|your move/ })).toBeDefined()
  if ((await waitFor(ui, clock, ['fold', 'next'])) === 'fold') {
    expect(await ui.find({ key: 'call' })).toBeDefined()
    await ui.press({ key: 'fold' })
  }
  await waitFor(ui, clock, ['next'])
  expect(await ui.find({ type: 'Text', text: /FOLD|█/ })).toBeUndefined()
  await clock.advance(2500)
  expect(await ui.find({ type: 'Text', text: /█/ })).toBeDefined()
  expect(await ui.find({ key: 'menu' })).toBeDefined()
  await ui.unmount()
})

test('the setup sets a name, a buy-in, stakes and a language before the deal', async ($, on) => {
  mock.store(on)
  const ui = await $.ui.mount({ plugin: 'poker', surface: 'terminal', ...PANE })
  await ui.input({ key: 'name', text: 'Эд' })
  await ui.press({ key: 'buyin' })
  expect(await ui.find({ key: 'buyin', text: /2000/ })).toBeDefined()
  await ui.press({ key: 'stakes' })
  expect(await ui.find({ key: 'stakes', text: /25\/50/ })).toBeDefined()
  await ui.press({ key: 'lang' })
  await ui.press({ key: 'lang-ru' })
  expect(await ui.find({ key: 'lang', text: /Русский/ })).toBeDefined()
  await ui.press({ key: 'pro' })
  await ui.press({ key: 'bots-2' })
  expect(await ui.find({ type: 'Text', text: /блайнды 25\/50/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Эд/ })).toBeDefined()
  await ui.unmount()
})

test('quitting mid-hand asks first, and only yes leaves the table', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'poker', surface: 'terminal', ...PANE })
  await ui.press({ key: 'medium' })
  await ui.press({ key: 'bots-4' })
  await ui.press({ key: 'quit' })
  expect(await ui.find({ key: 'quit-yes' })).toBeDefined()
  await ui.press({ key: 'quit-no' })
  expect(await ui.find({ key: 'quit-yes' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /#1\b/ })).toBeDefined()
  await ui.press({ key: 'quit' })
  await ui.press({ key: 'quit-yes' })
  expect(await ui.find({ key: 'novice' })).toBeDefined()
  await ui.unmount()
})

test('the log scrolls back and holds its place while the bots play on', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  const ui = await $.ui.mount({ plugin: 'poker', surface: 'terminal', ...PANE })
  await ui.press({ key: 'novice' })
  await ui.press({ key: 'bots-6' })
  for (let k = 0; k < 40 && !(await ui.find({ type: 'Text', text: /☰ [2-9]/ })); k++) {
    if (await ui.find({ key: 'call' })) await ui.press({ key: 'call' })
    else if (await ui.find({ key: 'next' })) await ui.press({ key: 'next' })
    else await clock.advance(1500)
  }
  const at = async () => ((await ui.find({ type: 'Text', text: /☰/ }))?.text ?? '').match(/☰ (\d+)/)?.[1]
  const bottom = Number(await at())
  expect(bottom > 1).toBe(true)
  await ui.press({ key: 'log-up' })
  expect(Number(await at())).toBe(bottom - 1)
  await clock.advance(3000)
  expect(Number(await at())).toBe(bottom - 1)
  for (let k = 0; k < 80; k++) await ui.press({ key: 'log-down' })
  expect(Number(await at()) >= bottom).toBe(true)
  await ui.unmount()
})

import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'poker',
  props: {
    title: '♠ Покер',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
  viewport: { columns: 160, rows: 40 },
} as const

test('the menu picks a level and a table size, then a hand is dealt', async ($, on) => {
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'poker', surface, ...PANE })
    expect(await ui.find({ key: 'pro' })).toBeDefined()
    await ui.press({ key: 'pro' })
    expect(await ui.find({ key: 'bots-6' })).toBeDefined()
    await ui.press({ key: 'bots-3' })
    expect(await ui.find({ type: 'Text', text: /Профи/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Раздача #1/ })).toBeDefined()
    const fold = await ui.find({ key: 'fold' })
    if (fold) await ui.press({ key: 'fold' })
    expect(await ui.find({ key: 'next' })).toBeDefined()
    await ui.press({ key: 'next' })
    expect(await ui.find({ type: 'Text', text: /Раздача #2/ })).toBeDefined()
    if (await ui.find({ key: 'fold' })) await ui.press({ key: 'fold' })
    await ui.press({ key: 'menu' })
    expect(await ui.find({ key: 'novice' })).toBeDefined()
    await ui.unmount()
  }
})

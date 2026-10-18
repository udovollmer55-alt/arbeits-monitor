import { test, expect, mock } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

test('Begrüßung erscheint auf Terminal und Desktop und lässt sich ausblenden', async ($, on) => {
  mock.clock(on)
  on('ui.render', ($, e) => $.ui.resolve(e).Text({}, 'engine'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'freundliche-oberflaeche', surface, ...BAND })
    expect(await ui.find({ key: 'ausblenden' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Tipp:/ })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'freundliche-oberflaeche', surface: 'desktop', ...BAND })
  await ui.press({ key: 'ausblenden' })
  expect(await ui.find({ key: 'ausblenden' })).toBeUndefined()
  await ui.unmount()
})

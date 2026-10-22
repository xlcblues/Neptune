const { chromium } = require('playwright')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = 'http://localhost:1420/'

async function waitFor(fn, timeout = 6000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await fn()) return
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  throw new Error('waitFor timeout')
}

async function main() {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.nav-item', { hasText: '音乐库' }).click()
  await page.locator('.library-title-row h1').waitFor()
  await waitFor(async () => (await page.locator('.track-row').count()) === 10)

  await page.locator('.player-bar').waitFor()
  const barBox = await page.locator('.player-bar').boundingBox()
  if (!barBox || barBox.height < 80) throw new Error('player bar is missing or too short')

  const firstTitle = (await page.locator('.track-main b').first().textContent()).trim()
  await page.locator('.track-play-btn').first().click({ force: true })
  await waitFor(async () => (await page.locator('.player-meta b').textContent()) === firstTitle)
  await waitFor(
    async () => (await page.locator('.player-play').getAttribute('aria-label')) === '暂停',
  )
  await waitFor(async () => (await page.locator('.player-time').first().textContent()) !== '0:00')

  await page.locator('button[aria-label="下一首"]').click()
  await waitFor(async () => (await page.locator('.player-meta b').textContent()) !== firstTitle)
  const secondTitle = (await page.locator('.player-meta b').textContent()).trim()
  await page.locator('button[aria-label="上一首"]').click()
  await waitFor(async () => (await page.locator('.player-meta b').textContent()) === firstTitle)

  await page.keyboard.press('Space')
  await waitFor(
    async () => (await page.locator('.player-play').getAttribute('aria-label')) === '播放',
  )
  await page.locator('.player-slider').evaluate((el) => {
    el.value = '0.6'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await waitFor(async () => (await page.locator('.player-slider').inputValue()) === '0.6')
  await page.keyboard.press('ArrowRight')
  await waitFor(async () => {
    const value = Number(await page.locator('.player-slider').inputValue())
    return Number.isFinite(value) && value > 1.5
  })
  await page.keyboard.press('Space')
  await waitFor(
    async () => (await page.locator('.player-play').getAttribute('aria-label')) === '暂停',
  )

  const volumeBox = await page.locator('.volume-slider').boundingBox()
  if (!volumeBox) throw new Error('volume slider missing')
  await page.mouse.click(
    volumeBox.x + volumeBox.width * 0.3,
    volumeBox.y + volumeBox.height / 2,
  )
  await waitFor(async () => Number(await page.locator('.volume-slider').inputValue()) > 0.2)
  await page.locator('button[aria-label="静音"]').click()
  await waitFor(async () => (await page.locator('.volume-slider').inputValue()) === '0')
  await page.locator('button[aria-label="取消静音"]').click()
  await waitFor(async () => (await page.locator('.volume-slider').inputValue()) === '0.8')

  await page.locator('.queue-trigger .icon-button').click()
  await page.locator('.queue-panel').waitFor()
  const queueTitles = (await page.locator('.queue-item .queue-meta b').allTextContents()).map((t) =>
    t.trim(),
  )
  if (queueTitles.length !== 10) throw new Error(`queue size mismatch: ${queueTitles.length}`)
  const thirdTitle = queueTitles[2]
  await page.locator('.queue-item').nth(2).click()
  await waitFor(async () => (await page.locator('.player-meta b').textContent()) === thirdTitle)
  await page.screenshot({ path: 'design/m2-player.png' })

  const panelBox = await page.locator('.queue-panel').boundingBox()
  if (!panelBox || panelBox.y < 0 || panelBox.y + panelBox.height > 800) {
    throw new Error('queue panel overflows the viewport')
  }
  await page.locator('.queue-head .icon-button').click()
  await waitFor(async () => (await page.locator('.queue-panel').count()) === 0)

  await page.locator('.theme-switch button[aria-label="深色"]').click()
  await waitFor(async () => (await page.locator('html').getAttribute('data-theme')) === 'dark')
  await page.setViewportSize({ width: 960, height: 640 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'design/m2-narrow-dark.png' })
  let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 960) errors.push(`dark narrow overflow: ${scrollWidth}px`)

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.locator('.theme-switch button[aria-label="浅色"]').click()
  await waitFor(async () => (await page.locator('html').getAttribute('data-theme')) === 'light')
  await page.screenshot({ path: 'design/m2-light.png' })
  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 1280) errors.push(`light overflow: ${scrollWidth}px`)

  await browser.close()
  if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`)
  console.log(
    'M2 verify passed: player bar, play/pause, next/prev, seek, volume, shortcuts, queue, dark/light layout',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

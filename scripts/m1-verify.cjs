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

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.hero h1').waitFor()

  const heroHeading = await page.locator('.hero h1').textContent()
  if (!heroHeading.includes('让本地音乐重新流动')) throw new Error('hero heading missing')
  if ((await page.locator('.status-grid .glass-card').count()) !== 3) {
    throw new Error('status cards missing')
  }
  const firstStat = await page.locator('.status-grid .glass-card').first().textContent()
  if (!firstStat.includes('10 首音乐已入库')) throw new Error('home stats not wired')
  await page.screenshot({ path: 'design/m1-home.png' })

  await page.locator('.nav-item', { hasText: '音乐库' }).click()
  await page.locator('.library-title-row h1').waitFor()
  if (!(await page.locator('.library-title-row h1').textContent()).includes('音乐库')) {
    throw new Error('library heading missing')
  }
  if ((await page.locator('.tag', { hasText: '浏览器预览' }).count()) !== 1) {
    throw new Error('browser preview tag missing')
  }
  await waitFor(async () => (await page.locator('.track-row').count()) === 10)
  await page.screenshot({ path: 'design/m1-library.png' })

  await page.locator('.search-box input').fill('夜航')
  await waitFor(async () => (await page.locator('.track-row').count()) === 1)
  const searchTitle = await page.locator('.track-main b').textContent()
  if (searchTitle !== '夜航') throw new Error(`search result mismatch: ${searchTitle}`)
  await page.locator('.search-clear').click()
  await waitFor(async () => (await page.locator('.track-row').count()) === 10)

  await page.locator('#sort-select').selectOption('duration')
  await page.locator('.sort-control .icon-button').click()
  await waitFor(async () => (await page.locator('.track-row').first().textContent()).includes('慢板'))
  const sortedFirst = await page.locator('.track-main b').first().textContent()
  if (sortedFirst !== '慢板') throw new Error(`sort mismatch: ${sortedFirst}`)

  await page.locator('.track-row').first().click()
  await page.locator('.track-detail').waitFor()
  const detailTitle = await page.locator('.track-detail h2').textContent()
  if (detailTitle !== '慢板') throw new Error(`detail mismatch: ${detailTitle}`)
  await page.screenshot({ path: 'design/m1-detail.png' })
  await page.locator('.track-detail .icon-button').click()
  await waitFor(async () => (await page.locator('.track-detail').count()) === 0)

  await page.locator('.nav-item', { hasText: '首页' }).click()
  await page.locator('.hero h1').waitFor()
  await page.setViewportSize({ width: 960, height: 640 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'design/m1-narrow.png' })

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 960) errors.push(`horizontal overflow on narrow viewport: ${scrollWidth}px`)

  await browser.close()
  if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`)
  console.log('M1 verify passed: home stats, library list, search, sort, detail, narrow layout')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

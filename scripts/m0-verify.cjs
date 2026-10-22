const { chromium } = require('playwright')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = 'http://localhost:1420/'

async function main() {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const title = await page.title()
  if (title !== 'Neptune') throw new Error(`unexpected title: ${title}`)

  const navLabels = await page.locator('.nav-item span').allTextContents()
  const expectedNav = ['首页', '音乐库', '智能分类', '播放特效']
  if (JSON.stringify(navLabels) !== JSON.stringify(expectedNav)) {
    throw new Error(`unexpected nav: ${navLabels.join(',')}`)
  }

  const heroHeading = await page.locator('.hero h1').textContent()
  if (!heroHeading.includes('让本地音乐重新流动')) throw new Error('hero heading missing')
  if ((await page.locator('.status-grid .glass-card').count()) !== 3) throw new Error('status cards missing')
  if ((await page.locator('.empty-state').count()) !== 1) throw new Error('empty state missing')

  await page.screenshot({ path: 'design/m0-home.png' })

  await page.locator('.nav-item', { hasText: '音乐库' }).click()
  if (!(await page.locator('.placeholder-card h1').textContent()).includes('音乐库')) {
    throw new Error('library view missing')
  }
  await page.screenshot({ path: 'design/m0-library.png' })

  await page.locator('.nav-item', { hasText: '智能分类' }).click()
  if (!(await page.locator('.placeholder-card h1').textContent()).includes('智能分类')) {
    throw new Error('classify view missing')
  }
  await page.locator('.nav-item', { hasText: '播放特效' }).click()
  if (!(await page.locator('.placeholder-card h1').textContent()).includes('播放特效')) {
    throw new Error('visual view missing')
  }

  await page.locator('.nav-item', { hasText: '首页' }).click()
  await page.setViewportSize({ width: 960, height: 640 })
  await page.screenshot({ path: 'design/m0-narrow.png' })

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 960) errors.push(`horizontal overflow on narrow viewport: ${scrollWidth}px`)

  await browser.close()

  if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`)
  console.log('M0 verify passed: home, library, classify, visual, narrow layout')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

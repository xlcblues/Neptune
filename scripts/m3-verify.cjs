const { chromium } = require('playwright')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = 'http://localhost:1420/'

async function waitFor(fn, timeout = 8000) {
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
  await page.locator('.nav-item', { hasText: '智能分类' }).click()
  await page.locator('.classify-view h1').waitFor()
  await waitFor(async () => (await page.locator('.classify-row').count()) === 10)

  const statCards = await page.locator('.classify-stat').count()
  if (statCards !== 4) throw new Error(`stat cards expected 4, got ${statCards}`)
  const statText = await page.locator('.classify-sub').textContent()
  if (!statText.includes('共 10 首')) throw new Error(`stats sub mismatch: ${statText}`)

  const sourceChips = (await page.locator('.source-chips .tag').allTextContents()).join(' ')
  if (!sourceChips.includes('文件标签') || !sourceChips.includes('MusicBrainz')) {
    throw new Error(`source chips mismatch: ${sourceChips}`)
  }

  const firstTitle = (await page.locator('.classify-row .row-track b').first().textContent()).trim()
  await page.locator('.filter-segmented button', { hasText: '待确认' }).click()
  await waitFor(async () => (await page.locator('.classify-row').count()) === 3)
  await page.locator('.filter-segmented button', { hasText: '全部' }).click()
  await waitFor(async () => (await page.locator('.classify-row').count()) === 10)

  await page.locator('input[aria-label="选择全部"]').check()
  await waitFor(async () => (await page.locator('.selection-count').textContent()).includes('已选 10'))
  await page.locator('button', { hasText: '采用选中建议' }).click()
  await waitFor(async () => (await page.locator('.classify-row.selected').count()) === 0)
  const confirmed = (await page.locator('.classify-row .row-current .tag').count())
  if (confirmed !== 7) throw new Error(`expected 7 confirmed, got ${confirmed}`)

  await page.locator('button', { hasText: '开始检测' }).click()
  await page.locator('.classify-progress').waitFor()
  await waitFor(async () => {
    const text = await page.locator('.progress-copy b').textContent()
    return text.includes('分类完成')
  }, 12000)
  await waitFor(async () => (await page.locator('.classify-progress').count()) === 0, 6000)

  await page.screenshot({ path: 'design/m3-classify.png' })

  await page.setViewportSize({ width: 960, height: 640 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'design/m3-classify-narrow.png' })
  let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 960) errors.push(`narrow overflow: ${scrollWidth}px`)

  await page.setViewportSize({ width: 375, height: 720 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'design/m3-classify-mobile.png' })
  scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scrollWidth > 375) errors.push(`mobile overflow: ${scrollWidth}px`)

  await browser.close()
  if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`)
  console.log(
    'M3 verify passed: classify view, stats, source chips, filters, batch apply, detection progress, narrow/mobile layout',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

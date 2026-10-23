const { chromium } = require('playwright')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = 'http://localhost:1420/'

function overlap(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)
}

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
  const issues = []

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.nav-item', { hasText: '智能分类' }).click()
  await page.locator('.classify-view h1').waitFor()
  await waitFor(async () => (await page.locator('.classify-row').count()) === 10)

  async function audit(label) {
    const head = await page.locator('.classify-head').boundingBox()
    const stats = await page.locator('.classify-stats').boundingBox()
    const source = await page.locator('.source-card').boundingBox()
    const panel = await page.locator('.classify-panel').boundingBox()
    const note = await page.locator('.classify-note').boundingBox()
    const sections = [head, stats, source, panel, note].filter(Boolean)
    for (let i = 0; i < sections.length - 1; i += 1) {
      if (overlap(sections[i], sections[i + 1])) {
        issues.push(`${label}: section ${i} overlaps section ${i + 1}`)
      }
    }

    const rows = await page.locator('.classify-row').evaluateAll((els) =>
      els.map((el) => {
        const cells = Array.from(el.children).map((child) => {
          const r = child.getBoundingClientRect()
          return { x: r.x, y: r.y, width: r.width, height: r.height }
        })
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, cells }
      }),
    )
    for (const row of rows) {
      for (let i = 0; i < row.cells.length - 1; i += 1) {
        if (overlap(row.cells[i], row.cells[i + 1])) {
          issues.push(`${label}: row cells ${i}/${i + 1} overlap at y=${row.y}`)
        }
      }
    }

    const scrollInfo = await page.locator('.classify-rows').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    if (scrollInfo.clientHeight >= scrollInfo.scrollHeight - 2) {
      issues.push(`${label}: classify-rows is not scrollable (${scrollInfo.clientHeight}/${scrollInfo.scrollHeight})`)
    }

    await page.locator('.content').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(120)
    const noteBox = await page.locator('.classify-note').boundingBox()
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    if (!noteBox) issues.push(`${label}: classify-note missing`)
    else if (noteBox.y + noteBox.height > viewportHeight + 2) {
      issues.push(`${label}: classify-note clipped at scroll bottom (${noteBox.y + noteBox.height}/${viewportHeight})`)
    }
    await page.locator('.content').evaluate((el) => {
      el.scrollTop = 0
    })
    await page.waitForTimeout(120)
  }

  await audit('desktop')

  await page.setViewportSize({ width: 375, height: 720 })
  await page.waitForTimeout(250)
  await audit('mobile')

  await browser.close()
  if (issues.length) throw new Error(issues.join('\n'))
  console.log('M3 layout audit passed: no section/cell overlaps, rows scroll within viewport')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

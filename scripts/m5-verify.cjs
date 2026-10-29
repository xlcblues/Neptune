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

async function canvasVariance(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.visual-canvas')
    if (!canvas) throw new Error('canvas missing')
    const context = canvas.getContext('2d')
    const { width, height } = canvas
    const data = context.getImageData(0, 0, width, height).data
    let count = 0
    let sum = 0
    let sumSquares = 0
    const step = 4
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4
        const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
        sum += luminance
        sumSquares += luminance * luminance
        count += 1
      }
    }
    const mean = sum / count
    return sumSquares / count - mean * mean
  })
}

async function auditPanel(page, label, issues) {
  const viewport = page.viewportSize()
  const panel = await page.locator('.visual-panel').boundingBox()
  if (!panel) throw new Error(`${label}: visual panel missing`)
  if (
    panel.x < -1 ||
    panel.y < -1 ||
    panel.x + panel.width > viewport.width + 1 ||
    panel.y + panel.height > viewport.height + 1
  ) {
    issues.push(`${label}: panel outside viewport`)
  }

  const children = await page.locator('.visual-panel > *').evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  for (let i = 0; i < children.length - 1; i += 1) {
    if (overlap(children[i], children[i + 1])) {
      issues.push(`${label}: panel section ${i} overlaps section ${i + 1}`)
    }
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const issues = []
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.sidebar').waitFor()
  await page.locator('.theme-switch button[aria-label="深色"]').click()
  await waitFor(async () => (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark')
  await page.locator('.nav-item', { hasText: '播放特效' }).click()
  await page.locator('.visual-view').waitFor()
  await waitFor(async () => (await canvasVariance(page)) > 40)
  await auditPanel(page, 'desktop', issues)

  const presets = ['spectrum', 'aurora', 'waveform', 'vinyl', 'particles', 'flow']
  for (let index = 0; index < presets.length; index += 1) {
    await page.locator('.visual-preset').nth(index).click()
    await page.waitForTimeout(260)
    const variance = await canvasVariance(page)
    if (variance < 30) issues.push(`desktop: ${presets[index]} canvas too flat (${variance.toFixed(1)})`)
  }
  await page.screenshot({ path: 'design/m5-visual-dark.png' })

  await page.locator('.theme-switch button[aria-label="浅色"]').click()
  await waitFor(async () => (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
  await page.waitForTimeout(260)
  const lightVariance = await canvasVariance(page)
  if (lightVariance < 30) issues.push(`light: canvas too flat (${lightVariance.toFixed(1)})`)
  await page.screenshot({ path: 'design/m5-visual-light.png' })

  await page.setViewportSize({ width: 375, height: 720 })
  await page.waitForTimeout(300)
  await auditPanel(page, 'mobile', issues)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 1) issues.push(`mobile: horizontal overflow ${overflow}px`)
  await page.screenshot({ path: 'design/m5-visual-mobile.png' })

  await browser.close()
  if (errors.length) issues.push(`console errors: ${errors.join(' | ')}`)
  if (issues.length) throw new Error(issues.join('\n'))
  console.log('M5 verify passed: canvas animates, 6 presets render, light/dark themes, no overlaps or overflow')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

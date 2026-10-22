const { chromium } = require('playwright')

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = 'http://localhost:1420/'

async function main() {
  const browser = await chromium.launch({ executablePath: edgePath, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const problems = []

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.hero h1').waitFor()
  await page.locator('.nav-item', { hasText: '音乐库' }).click()
  await page.locator('.library-title-row h1').waitFor()

  for (const width of [1280, 1100, 960]) {
    await page.setViewportSize({ width, height: 700 })
    await page.waitForTimeout(250)
    const audit = await page.evaluate(() => {
      const scroll = document.querySelector('.track-list-scroll')
      const body = document.querySelector('.library-body')
      const row = document.querySelector('.track-row')
      const genre = document.querySelector('.track-genre .tag')
      return {
        scrollClient: scroll ? scroll.clientWidth : 0,
        scrollWidth: scroll ? scroll.scrollWidth : 0,
        bodyClient: body ? body.clientWidth : 0,
        bodyScroll: body ? body.scrollWidth : 0,
        rowHeight: row ? getComputedStyle(row).height : null,
        genreScroll: genre ? genre.scrollWidth : 0,
        genreClient: genre ? genre.clientWidth : 0,
        docScroll: document.documentElement.scrollWidth,
      }
    })
    if (audit.scrollWidth > audit.scrollClient + 1) {
      problems.push(`${width}px: list scroll overflow ${audit.scrollWidth}/${audit.scrollClient}`)
    }
    if (audit.bodyScroll > audit.bodyClient + 1) {
      problems.push(`${width}px: body overflow ${audit.bodyScroll}/${audit.bodyClient}`)
    }
    if (audit.docScroll > width + 1) {
      problems.push(`${width}px: document overflow ${audit.docScroll}`)
    }
    if (audit.rowHeight !== '56px') {
      problems.push(`${width}px: row height ${audit.rowHeight}`)
    }
    if (audit.genreScroll > audit.genreClient + 1) {
      problems.push(`${width}px: genre tag overflow`)
    }
  }

  await browser.close()
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log('M1 layout audit passed: stable rows, no horizontal overflow at 1280/1100/960')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

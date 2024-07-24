const puppeteer = require('puppeteer')

const EXTENSION_PATH = 'D:/code_archive/CensorTracker/censortracker/dist/chrome/prod'

let browser

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false,
    product: 'firefox',
    protocol: 'webDriverBiDi',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  })
})

afterAll(async () => {
  if (browser) {
    await browser.close()
  }
  browser = undefined
})

global.getPage = async () => {
  const page = await browser.newPage()

  await page.bringToFront()
  return page
}

global.getPopUp = async () => {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === 'service_worker' && target.url().endsWith('background.js'),
  )

  const worker = await workerTarget.worker()

  await worker.evaluate('chrome.action.openPopup();')

  const popupTarget = await browser.waitForTarget(
    (target) => target.type() === 'page' && target.url().endsWith('popup.html'),
  )

  const popupPage = await popupTarget.asPage()

  return popupPage
}

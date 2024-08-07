import path from 'path'
import puppeteer from 'puppeteer'

const EXTENSION_PATH = path.resolve(__dirname, '../../../dist/chrome/prod')

let browser

global.extensionUrlPrefix = 'chrome-extension'

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  })
  global.browser = browser
}, 15000)

afterAll(async () => {
  if (browser) {
    await browser.close()
  }
  browser = undefined
  global.browser = browser
}, 10000)

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

global.getExtensionId = async () => {
  const popUp = await global.getPopUp()
  const extensionId = await popUp.evaluate(() => document.querySelector('#extension-id').textContent)

  return extensionId
}

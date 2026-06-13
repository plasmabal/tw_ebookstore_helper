const fs   = require('fs');
const path = require('path');

/**
 * 將資料寫入 chrome.storage.sync，透過 management.html 特權頁執行。
 * @param {object} data  要寫入的 storage key-value 物件
 */
async function setStorage(data) {
  const setup = await global.browser.newPage();
  await setup.goto(`chrome-extension://${global.EXTENSION_ID}/management.html`);
  await setup.evaluate(async (d) => new Promise(resolve => chrome.storage.sync.set(d, resolve)), data);
  await setup.close();
}

/**
 * 等待頁面上某 selector 元素獲得指定 class，超時 5 秒。
 * @returns {Promise<boolean>}
 */
async function waitForClass(page, selector, className) {
  try {
    await page.waitForFunction(
      (sel, cls) => { const el = document.querySelector(sel); return el && el.classList.contains(cls); },
      { timeout: 5000 },
      selector,
      className
    );
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 依序注入所有 content script 檔案（供 fixture 測試使用）。
 * 注意：呼叫前 window.TEH.findSite 必須已存在（不可整個覆蓋 window.TEH，
 * 否則會抹掉 teh-chip-input.js 設置的 createChipInput）。
 */
async function injectContentScripts(page) {
  const files = [
    '../teh-chip-input.js',
    '../teh-storage.js',
    '../teh-blacklist.js',
    '../teh-price.js',
    '../teh-wishlist.js',
    '../content.js'
  ].map(f => path.resolve(__dirname, f));
  for (const f of files) {
    await page.evaluate(fs.readFileSync(f, 'utf8'));
  }
}

/**
 * 導航至 fixture URL 並注入 TEH mock + content scripts。
 * @param {object} page       Puppeteer page
 * @param {string} fixtureUrl chrome-extension:// URL
 * @param {object} tehMock    window.TEH 的 mock 物件（含 findSite 回傳值）
 */
async function loadFixture(page, fixtureUrl, tehMock) {
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate((mock) => { window.TEH = mock; }, tehMock);
  await injectContentScripts(page);
}

module.exports = { setStorage, waitForClass, injectContentScripts, loadFixture };

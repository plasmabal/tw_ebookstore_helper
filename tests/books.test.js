const testData = require('./testData.json');

// books.com.tw 受 Cloudflare WAF 保護，自動化測試會被 403 擋下，暫時跳過。
// 手動驗證方式：安裝擴充功能後，開啟下列頁面確認樣式注入正確。
// - 黑名單作者: https://www.books.com.tw/products/0010336891 (九把刀)
// - 優良作者:   https://www.books.com.tw/products/0010979566 (布蘭登．山德森)

describe('Books.com.tw 黑白名單 E2E 測試', () => {
  let page;

  beforeAll(async () => {
    const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
    const setupPage = await global.browser.newPage();
    await setupPage.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setupPage.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.local.set(data, resolve));
    }, testData);
    await setupPage.close();
  });

  beforeEach(async () => {
    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.skip('1. 黑名單作者 (書籍頁): 九把刀', async () => {
    await page.goto('https://www.books.com.tw/products/0010336891', { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      (sel, cls) => { const el = document.querySelector(sel); return el && el.classList.contains(cls); },
      { timeout: 5000 },
      '.type02_p01_wrap a[href*="adv_author/1"]', 'teh-blacklisted-text'
    );
    await page.waitForFunction(
      (sel, cls) => { const el = document.querySelector(sel); return el && el.classList.contains(cls); },
      { timeout: 5000 },
      '.type02_p01_wrap h1', 'teh-blacklisted-title'
    );
  });

  test.skip('2. 優良作者 (書籍頁): 布蘭登．山德森', async () => {
    await page.goto('https://www.books.com.tw/products/0010979566', { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      (sel, cls) => { const el = document.querySelector(sel); return el && el.classList.contains(cls); },
      { timeout: 5000 },
      '.type02_p01_wrap a[href*="adv_author/1"]', 'teh-whitelisted-text'
    );
  });
});

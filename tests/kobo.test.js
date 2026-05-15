const testData = require('./testData.json');

describe('Kobo 黑白名單 E2E 測試', () => {
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

  const waitForClass = async (selector, className) => {
    try {
      await page.waitForFunction(
        (sel, cls) => {
          const el = document.querySelector(sel);
          return el && el.classList.contains(cls);
        },
        { timeout: 5000 },
        selector,
        className
      );
      return true;
    } catch (e) {
      return false;
    }
  };

  test('1. 優良作者 (書籍頁): 布蘭登．山德森', async () => {
    // 翠海的雀絲 by 布蘭登．山德森
    await page.goto('https://www.kobo.com/tw/zh/ebook/QNNMWo57eDWTP0YfThPf4w', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('.primary-left-container .visible-contributors a.contributor-name', 'teh-whitelisted-text');
    expect(hasClass).toBe(true);
  });

  test('2. 黑名單作者 (書籍頁): 九把刀', async () => {
    // 功夫 by 九把刀
    await page.goto('https://www.kobo.com/tw/zh/ebook/w3UfB3BDfT2PS3bHS1fYzA', { waitUntil: 'networkidle2' });
    const hasAuthorClass = await waitForClass('.primary-left-container .visible-contributors a.contributor-name', 'teh-blacklisted-text');
    const hasTitleClass = await waitForClass('.primary-left-container h1.title', 'teh-blacklisted-title');
    expect(hasAuthorClass).toBe(true);
    expect(hasTitleClass).toBe(true);
  });

  test('3. 黑名單作者 (搜尋頁): 九把刀', async () => {
    await page.goto('https://www.kobo.com/tw/zh/search?query=%E4%B9%9D%E6%8A%8A%E5%88%80', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('[data-testid="authors"] a[data-testid="book-attribute-link"]', 'teh-blacklisted-text');
    expect(hasClass).toBe(true);
  });
});

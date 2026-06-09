const testData = require('./testData.json');

describe('Readmoo 黑白名單 E2E 測試', () => {
  let page;

  beforeAll(async () => {
    // Inject test data into chrome.storage.sync via management.html
    const EXTENSION_ID = global.EXTENSION_ID;
    const setupPage = await global.browser.newPage();
    await setupPage.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setupPage.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
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

  test('1. 優良作者 (作者頁): 布蘭登．山德森', async () => {
    await page.goto('https://readmoo.com/contributor/105', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('h1', 'teh-whitelisted-text');
    expect(hasClass).toBe(true);
  });

  test('2. 優良作者 (書籍頁): 颶光典籍五部曲', async () => {
    await page.goto('https://readmoo.com/book/210450261000101', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('.contributors-list-item a[itemprop="name"]', 'teh-whitelisted-text');
    expect(hasClass).toBe(true);
  });

  test('3. 優良出版社 (出版社頁): 獨步文化', async () => {
    await page.goto('https://readmoo.com/publisher/982', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('h1', 'teh-whitelisted-text');
    expect(hasClass).toBe(true);
  });

  test('4. 優良出版社 (書籍頁): 冰菓', async () => {
    await page.goto('https://readmoo.com/book/210471110000101', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('.book-detail-info a[href*="/publisher/"]', 'teh-whitelisted-text');
    expect(hasClass).toBe(true);
  });

  test('5. 黑名單作者 (作者頁): 林熹', async () => {
    await page.goto('https://readmoo.com/contributor/35813', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('h1', 'teh-blacklisted-text');
    expect(hasClass).toBe(true);
  });

  test('6. 黑名單作者 (書籍頁): 靈魂通判', async () => {
    await page.goto('https://readmoo.com/book/210366310000101', { waitUntil: 'networkidle2' });
    const hasTitleClass = await waitForClass('.book-detail-info h1', 'teh-blacklisted-title');
    const hasAuthorClass = await waitForClass('.book-detail-info .contributors-list-item a[itemprop="name"]', 'teh-blacklisted-text');
    expect(hasTitleClass).toBe(true);
    expect(hasAuthorClass).toBe(true);
  });

  test('7. 黑名單出版社 (出版社頁): 典石成金工作室', async () => {
    await page.goto('https://readmoo.com/publisher/1741', { waitUntil: 'networkidle2' });
    const hasClass = await waitForClass('h1', 'teh-blacklisted-text');
    expect(hasClass).toBe(true);
  });

  test('8. 黑名單出版社 (書籍頁): 維也納慢慢玩', async () => {
    await page.goto('https://readmoo.com/book/210289635000101', { waitUntil: 'networkidle2' });
    const hasTitleClass = await waitForClass('.book-detail-info h1', 'teh-blacklisted-title');
    const hasPublisherClass = await waitForClass('.book-detail-info a[href*="/publisher/"]', 'teh-blacklisted-text');
    expect(hasTitleClass).toBe(true);
    expect(hasPublisherClass).toBe(true);
  });
});

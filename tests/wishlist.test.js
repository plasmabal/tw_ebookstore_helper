const fs   = require('fs');
const path = require('path');
const testData = require('./testData.json');

describe('待購清單備註注入測試 (Fixture)', () => {
  const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
  const FIXTURE_URL = `chrome-extension://${EXTENSION_ID}/tests/fixtures/wishlist.html#wishlist`;
  const CONTENT_JS = path.resolve(__dirname, '../content.js');

  let page;

  async function setStorage(extra = {}) {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.local.set(data, resolve));
    }, { ...testData, ...extra });
    await setup.close();
  }

  async function loadFixture() {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });

    // window.TEH must exist before the content.js IIFE runs.
    // page.evaluate() uses CDP Runtime.evaluate which bypasses extension page CSP,
    // unlike page.addScriptTag() which injects a <script> tag and is blocked by
    // the default MV3 `script-src 'self'` policy.
    await page.evaluate(() => {
      window.TEH = {
        findSite: () => ({
          getPriceInfo: () => null,
          getBlacklistTargets: () => ({ global: null, blocks: [] })
        })
      };
    });

    const code = fs.readFileSync(CONTENT_JS, 'utf8');
    await page.evaluate(code);
  }

  beforeEach(async () => {
    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('1. 有備註的書籍應注入備註文字與 Tag chip', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '想購買這本書' },
      wishlistTags:    { '12345': ['奇幻', '想買'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // 兩本書都應有容器
    const containers = await page.$$('.teh-wishlist-remark-container');
    expect(containers.length).toBe(2);

    // 第一本書 (12345) 應顯示備註
    const remarkText = await page.$eval(
      '.teh-wishlist-remark-container .teh-wishlist-remark-text',
      el => el.textContent
    );
    expect(remarkText).toBe('想購買這本書');

    // Tag chip 應出現
    const content = await page.content();
    expect(content).toContain('奇幻');
    expect(content).toContain('想買');
  });

  test('2. 無備註的書籍應有空白容器', async () => {
    await setStorage({ wishlistRemarks: {}, wishlistTags: {} });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    const texts = await page.$$eval(
      '.teh-wishlist-remark-text',
      els => els.map(el => el.textContent)
    );
    expect(texts.every(t => t === '')).toBe(true);
  });

  test('3. 點擊容器應進入編輯模式，並預填現有備註', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '現有備註內容' },
      wishlistTags:    {}
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    const firstContainer = await page.$('.teh-wishlist-remark-container');
    await firstContainer.click();
    await new Promise(r => setTimeout(r, 100));

    const textarea = await page.$('.teh-wishlist-remark-editor');
    expect(textarea).not.toBeNull();

    const value = await page.$eval('.teh-wishlist-remark-editor', el => el.value);
    expect(value).toBe('現有備註內容');
  });

  test('4. 儲存後應回到顯示模式並顯示新備註', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '舊備註' },
      wishlistTags:    {}
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    const firstContainer = await page.$('.teh-wishlist-remark-container');
    await firstContainer.click();
    await new Promise(r => setTimeout(r, 100));

    const textarea = await page.$('.teh-wishlist-remark-editor');
    await textarea.click({ clickCount: 3 });
    await textarea.type('新備註');

    const saveBtn = await firstContainer.$('.teh-btn-save');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 300));

    // 應回到顯示模式（無 textarea）
    const editor = await page.$('.teh-wishlist-remark-editor');
    expect(editor).toBeNull();

    const remarkText = await page.$eval(
      '.teh-wishlist-remark-container .teh-wishlist-remark-text',
      el => el.textContent
    );
    expect(remarkText).toBe('新備註');
  });

  test('5. 取消編輯後應回到顯示模式且不更動備註', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '原始備註' },
      wishlistTags:    {}
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    const firstContainer = await page.$('.teh-wishlist-remark-container');
    await firstContainer.click();
    await new Promise(r => setTimeout(r, 100));

    const textarea = await page.$('.teh-wishlist-remark-editor');
    await textarea.click({ clickCount: 3 });
    await textarea.type('不應儲存的內容');

    const cancelBtn = await firstContainer.$('.teh-btn-cancel');
    await cancelBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const editor = await page.$('.teh-wishlist-remark-editor');
    expect(editor).toBeNull();

    const remarkText = await page.$eval(
      '.teh-wishlist-remark-container .teh-wishlist-remark-text',
      el => el.textContent
    );
    expect(remarkText).toBe('原始備註');
  });

  test('6. Auto-cleanup：不在清單中的書籍備註應被清除', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '保留備註', '99999': '應被清除' },
      wishlistTags:    { '99999': ['舊標籤'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve =>
        chrome.storage.local.get(['wishlistRemarks', 'wishlistTags'], resolve)
      )
    );

    expect(storage.wishlistRemarks['12345']).toBe('保留備註');
    expect(storage.wishlistRemarks['99999']).toBeUndefined();
    expect(storage.wishlistTags['99999']).toBeUndefined();
  });
});

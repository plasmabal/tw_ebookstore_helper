const fs   = require('fs');
const path = require('path');
const testData = require('./testData.json');

// 待購清單最優價格計算（與 sites.js 邏輯一致，fixture 測試用）
const WISHLIST_PRICE_OPTIONS = (price) => [
  { id: 'd75', label: '75折',  cost: Math.round(price * 0.75) },
  { id: 'd80', label: '8折',   cost: Math.round(price * 0.80) },
  { id: 'm50', label: '-50',   cost: Math.max(0, price - 50)  },
  { id: 'tok', label: '領書額度', cost: Math.ceil(price / 250) * 167 }
];
const bestOf = (price) => WISHLIST_PRICE_OPTIONS(price).reduce((a, b) => a.cost <= b.cost ? a : b);

describe('待購清單備註注入測試 (Fixture)', () => {
  let EXTENSION_ID;
  let FIXTURE_URL;
  const CONTENT_JS = path.resolve(__dirname, '../content.js');

  let page;

  beforeAll(() => {
    EXTENSION_ID = global.EXTENSION_ID;
    FIXTURE_URL = `chrome-extension://${EXTENSION_ID}/tests/fixtures/wishlist.html#wishlist`;
  });

  async function setStorage(extra = {}) {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
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

  test('7. 點擊狀態條 tag 應過濾清單，只顯示含相同 tag 的書籍', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }   // 67890 無 tag
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    const item12345Filtered = await page.$eval(
      'li.cart-list-item[data-teh-book-id="12345"]',
      el => el.classList.contains('teh-filtered-out')
    );
    expect(item12345Filtered).toBe(false);

    const item67890Filtered = await page.$eval(
      'li.cart-list-item[data-teh-book-id="67890"]',
      el => el.classList.contains('teh-filtered-out')
    );
    expect(item67890Filtered).toBe(true);
  });

  test('8. 點擊清除標籤篩選按鈕應恢復完整清單', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // 先啟用篩選
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    // 點擊清除
    const clearBtn = await page.$('.teh-filter-clear-btn');
    await clearBtn.click();
    await new Promise(r => setTimeout(r, 100));

    // 兩本書都應恢復可見
    const filteredItems = await page.$$('li.cart-list-item.teh-filtered-out');
    expect(filteredItems.length).toBe(0);

    // 清除按鈕應回到 inactive
    const clearActive = await page.$eval('.teh-filter-clear-btn', el => el.classList.contains('teh-filter-tag-active'));
    expect(clearActive).toBe(false);
  });

  test('9. 點擊 tag chip 不應觸發備註編輯模式', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-tag-chip', { timeout: 3000 });

    const chip = await page.$('.teh-wishlist-tag-chip');
    await chip.click();
    await new Promise(r => setTimeout(r, 100));

    const editor = await page.$('.teh-wishlist-remark-editor');
    expect(editor).toBeNull();
  });

  // --- Tag Filter Bar ---

  test('10. 進入頁面時應顯示 tag filter bar，列出所有 pool tag', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻', '想買'], '67890': ['輕小說'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-tag-filter-bar', { timeout: 3000 });

    const tagLabels = await page.$$eval('.teh-filter-tag', btns => btns.map(b => b.textContent));
    expect(tagLabels).toContain('奇幻');
    expect(tagLabels).toContain('想買');
    expect(tagLabels).toContain('輕小說');
  });

  test('11. 清除標籤篩選按鈕初始應為 inactive', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-clear-btn', { timeout: 3000 });

    const isActive = await page.$eval('.teh-filter-clear-btn', el => el.classList.contains('teh-filter-tag-active'));
    expect(isActive).toBe(false);
  });

  test('12. 點擊 disabled tag 應變成 active', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    const isActive = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      return btn ? btn.classList.contains('teh-filter-tag-active') : false;
    });
    expect(isActive).toBe(true);

    const clearActive = await page.$eval('.teh-filter-clear-btn', el => el.classList.contains('teh-filter-tag-active'));
    expect(clearActive).toBe(true);
  });

  test('13. 點擊 active tag 應 toggle 回 disabled', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // Enable
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    // Disable again
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    const isActive = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      return btn ? btn.classList.contains('teh-filter-tag-active') : true;
    });
    expect(isActive).toBe(false);

    // 篩選清除，所有書應可見
    const filteredItems = await page.$$('li.cart-list-item.teh-filtered-out');
    expect(filteredItems.length).toBe(0);
  });

  test('14. AND 交集篩選：選多個 tag 只顯示全部皆有的書籍', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻', '想買'], '67890': ['輕小說', '想買'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // Enable '奇幻' then '想買' separately to avoid clicking stale nodes
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '想買');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    // 12345 有 '奇幻' + '想買' → 應可見
    const item12345Filtered = await page.$eval(
      'li.cart-list-item[data-teh-book-id="12345"]',
      el => el.classList.contains('teh-filtered-out')
    );
    expect(item12345Filtered).toBe(false);

    // 67890 有 '想買' 但無 '奇幻' → 應被隱藏
    const item67890Filtered = await page.$eval(
      'li.cart-list-item[data-teh-book-id="67890"]',
      el => el.classList.contains('teh-filtered-out')
    );
    expect(item67890Filtered).toBe(true);
  });

  test('15. 點擊清除標籤篩選按鈕應恢復顯示所有書籍並全部回 inactive', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻', '想買'], '67890': ['輕小說'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // Enable some tags
    await page.evaluate(() => {
      document.querySelectorAll('.teh-filter-tag').forEach(btn => {
        if (btn.textContent === '奇幻' || btn.textContent === '輕小說') btn.click();
      });
    });
    await new Promise(r => setTimeout(r, 100));

    const clearBtn = await page.$('.teh-filter-clear-btn');
    await clearBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const filteredItems = await page.$$('li.cart-list-item.teh-filtered-out');
    expect(filteredItems.length).toBe(0);

    const anyTagActive = await page.$$eval('.teh-filter-tag', btns => btns.some(b => b.classList.contains('teh-filter-tag-active')));
    expect(anyTagActive).toBe(false);

    const clearActive = await page.$eval('.teh-filter-clear-btn', el => el.classList.contains('teh-filter-tag-active'));
    expect(clearActive).toBe(false);
  });

  test('16. AND 交集無結果時顯示空結果訊息', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'], '67890': ['輕小說'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // '奇幻' + '輕小說' → 無書同時擁有兩者
    await page.evaluate(() => {
      document.querySelectorAll('.teh-filter-tag').forEach(btn => {
        if (btn.textContent === '奇幻' || btn.textContent === '輕小說') btn.click();
      });
    });
    await new Promise(r => setTimeout(r, 100));

    const allFiltered = await page.$$('li.cart-list-item.teh-filtered-out');
    expect(allFiltered.length).toBe(2);

    const emptyMsgDisplay = await page.$eval('.teh-wishlist-empty-filter-msg', el => el.style.display);
    expect(emptyMsgDisplay).toBe('block');
  });

  test('17. Storage 更新後重新渲染，已 active 的 tag 狀態應保留', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻', '想買'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // Enable '奇幻'
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    // 觸發 storage 更新（只改備註，不改 tags）
    await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.set({ wishlistRemarks: { '12345': '新備註' } }, resolve))
    );
    await new Promise(r => setTimeout(r, 500));

    // '奇幻' 應仍為 active
    const isActive = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      return btn ? btn.classList.contains('teh-filter-tag-active') : false;
    });
    expect(isActive).toBe(true);
  });

  test('18. 點擊項目上的 tag chip 不應改變狀態條篩選狀態', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-tag-chip', { timeout: 3000 });

    const chip = await page.$('.teh-wishlist-tag-chip');
    await chip.click();
    await new Promise(r => setTimeout(r, 100));

    const anyTagActive = await page.$$eval('.teh-filter-tag', btns => btns.some(b => b.classList.contains('teh-filter-tag-active')));
    expect(anyTagActive).toBe(false);
  });

  test('19. Hash 切換後回到 #wishlist，tag 篩選狀態應清空', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    // Enable a tag
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.teh-filter-tag')].find(b => b.textContent === '奇幻');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 100));

    // 切換 hash
    await page.evaluate(() => { window.location.hash = '#other'; });
    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => { window.location.hash = '#wishlist'; });
    await new Promise(r => setTimeout(r, 300));

    const anyTagActive = await page.$$eval('.teh-filter-tag', btns => btns.some(b => b.classList.contains('teh-filter-tag-active')));
    expect(anyTagActive).toBe(false);

    const filteredItems = await page.$$('li.cart-list-item.teh-filtered-out');
    expect(filteredItems.length).toBe(0);
  });

  test('20. 狀態條的 tag 應按 localeCompare 排序顯示', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['想買', '奇幻'], '67890': ['輕小說'] }
    });
    await loadFixture();
    await page.waitForSelector('.teh-filter-tag', { timeout: 3000 });

    const tagLabels = await page.$$eval('.teh-filter-tag', btns => btns.map(b => b.textContent));
    const sorted = [...tagLabels].sort((a, b) => a.localeCompare(b, 'zh-TW'));
    expect(tagLabels).toEqual(sorted);
  });

  // --- wishlistTagTemplates ---

  test('21. Auto-cleanup：移除孤立書籍的 tag 應轉存至 wishlistTagTemplates', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '99999': ['舊標籤', '奇幻'], '12345': ['奇幻'] },
      wishlistTagTemplates: []
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTagTemplates', 'wishlistTags'], resolve))
    );
    // '舊標籤' was only on 99999 (not in DOM) → promoted
    expect(storage.wishlistTagTemplates).toContain('舊標籤');
    // '奇幻' still on 12345 (in DOM) → not promoted
    expect(storage.wishlistTagTemplates).not.toContain('奇幻');
    // 99999 removed from wishlistTags
    expect(storage.wishlistTags['99999']).toBeUndefined();
  });

  test('22. btn-remove：點擊移除按鈕應轉存孤立 tag 至 wishlistTagTemplates', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻', '限定'], '67890': ['奇幻'] },
      wishlistTagTemplates: []
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // Click btn-remove for book 12345
    const removeBtn = await page.$('li.cart-list-item:first-child .btn-remove');
    await removeBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTagTemplates'], resolve))
    );
    // '限定' was only on 12345 → promoted
    expect(storage.wishlistTagTemplates).toContain('限定');
    // '奇幻' still on 67890 → not promoted
    expect(storage.wishlistTagTemplates).not.toContain('奇幻');
  });

  test('23. 編輯清空標籤（書留在清單）不應轉存至 wishlistTagTemplates', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': ['奇幻'] },
      wishlistTagTemplates: []
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // Enter edit mode and save with empty tags
    const container = await page.$('.teh-wishlist-remark-container');
    await container.click();
    await new Promise(r => setTimeout(r, 100));
    const saveBtn = await page.$('.teh-wishlist-remark-container .teh-btn-save');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTagTemplates'], resolve))
    );
    expect((storage.wishlistTagTemplates || []).length).toBe(0);
  });

  test('24. wishlistTagTemplates 的 tag 應出現在 chip input 的 autocomplete', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    {},
      wishlistTagTemplates: ['奇幻', '想買']
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // Enter edit mode
    const container = await page.$('.teh-wishlist-remark-container');
    await container.click();
    await new Promise(r => setTimeout(r, 100));

    // Type in tag input
    const tagInput = await page.$('.teh-wishlist-remark-container .teh-tag-text-input');
    await tagInput.type('奇');
    await new Promise(r => setTimeout(r, 100));

    const dropdownVisible = await page.$eval('.teh-tag-autocomplete', el => el.style.display !== 'none');
    expect(dropdownVisible).toBe(true);

    const suggestions = await page.$$eval('.teh-tag-autocomplete li', items => items.map(i => i.textContent));
    expect(suggestions).toContain('奇幻');
  });

  test('25. 將 template tag 加入書籍後應從 wishlistTagTemplates 移除', async () => {
    await setStorage({
      wishlistRemarks: {},
      wishlistTags:    { '12345': [] },
      wishlistTagTemplates: ['奇幻']
    });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // Enter edit mode and add '奇幻' tag
    const container = await page.$('.teh-wishlist-remark-container');
    await container.click();
    await new Promise(r => setTimeout(r, 100));

    const tagInput = await page.$('.teh-wishlist-remark-container .teh-tag-text-input');
    await tagInput.type('奇幻');
    await tagInput.press('Enter');
    await new Promise(r => setTimeout(r, 100));

    const saveBtn = await page.$('.teh-wishlist-remark-container .teh-btn-save');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTagTemplates'], resolve))
    );
    expect((storage.wishlistTagTemplates || [])).not.toContain('奇幻');
  });

  test('26. 容器已存在時 onChanged 應重新渲染（快取延遲載入修正）', async () => {
    // Start with empty storage so content.js creates containers with no data.
    await setStorage({ wishlistRemarks: {}, wishlistTags: {} });
    await loadFixture();
    await page.waitForSelector('.teh-wishlist-remark-container', { timeout: 3000 });

    // Containers exist but show no remarks/tags yet.
    const initialText = await page.$eval(
      'li.cart-list-item[data-teh-book-id="12345"] .teh-wishlist-remark-text',
      el => el.textContent
    );
    expect(initialText).toBe('');

    // Simulate storage arriving late (cross-device sync or slow storage.get).
    await page.evaluate(() =>
      new Promise(resolve =>
        chrome.storage.sync.set({
          wishlistRemarks: { '12345': '延遲載入備註' },
          wishlistTags:    { '12345': ['延遲Tag'] }
        }, resolve)
      )
    );
    await new Promise(r => setTimeout(r, 500));

    // Containers should reflect the updated data without requiring a page reload.
    const updatedText = await page.$eval(
      'li.cart-list-item[data-teh-book-id="12345"] .teh-wishlist-remark-text',
      el => el.textContent
    );
    expect(updatedText).toBe('延遲載入備註');

    const content = await page.content();
    expect(content).toContain('延遲Tag');
  });

  // --- Auto-cleanup ---

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
        chrome.storage.sync.get(['wishlistRemarks', 'wishlistTags'], resolve)
      )
    );

    expect(storage.wishlistRemarks['12345']).toBe('保留備註');
    expect(storage.wishlistRemarks['99999']).toBeUndefined();
    expect(storage.wishlistTags['99999']).toBeUndefined();
  });
});

describe('待購清單最優價格注入測試 (Fixture)', () => {
  let EXTENSION_ID;
  let PRICES_FIXTURE_URL;
  const CONTENT_JS = path.resolve(__dirname, '../content.js');

  let page;

  beforeAll(() => {
    EXTENSION_ID = global.EXTENSION_ID;
    PRICES_FIXTURE_URL = `chrome-extension://${EXTENSION_ID}/tests/fixtures/wishlist_prices.html#wishlist`;
  });

  async function setStorage(extra = {}) {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, { ...extra });
    await setup.close();
  }

  async function loadPricesFixture() {
    await page.goto(PRICES_FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    // getPriceInfo mirrors the wishlist block in sites.js getPriceInfo()
    // (「待購清單頁（/checkout/cart#wishlist）」section).
    // If that logic changes, update this mock to match.
    await page.evaluate(() => {
      window.TEH = {
        findSite: () => ({
          getPriceInfo: (doc) => {
            if (window.location.hash !== '#wishlist') return null;
            const results = [];
            for (const li of doc.querySelectorAll('li.cart-list-item')) {
              if ([...li.querySelectorAll('span.text-attention')].some(s => s.textContent.includes('停止銷售'))) continue;
              const priceEl = li.querySelector('.item-price');
              if (!priceEl) continue;
              const match = (priceEl.getAttribute('aria-label') || '').match(/單價(\d+)元/);
              const ebookPrice = match ? parseInt(match[1], 10) : parseInt(priceEl.textContent.replace(/[^\d]/g, ''), 10);
              if (!ebookPrice) continue;
              const container = li.querySelector('.item-price-box__main');
              if (container) results.push({ price: ebookPrice, isSale: !!li.querySelector('.badge.bg-notice'), container, isTokenApplicable: true });
            }
            return results.length ? results : null;
          },
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

  test('26. 一般售價書籍應注入 teh-best-price-hint', async () => {
    await setStorage({});
    await loadPricesFixture();
    await page.waitForSelector('li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint', { timeout: 3000 });

    const hint = await page.$eval(
      'li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint',
      el => el.textContent
    );
    // NT$299: 75折=224, 8折=239, -50=249, token=334 → best is 75折:224
    const best = bestOf(299);
    expect(hint).toContain('↳');
    expect(hint).toContain(best.label);
    expect(hint).toContain(String(best.cost));
  });

  test('27. 特價書籍應以特價（非原價）計算最優價格', async () => {
    await setStorage({});
    await loadPricesFixture();
    await page.waitForSelector('li.cart-list-item[data-teh-book-id="22222"] .teh-best-price-hint', { timeout: 3000 });

    const hint = await page.$eval(
      'li.cart-list-item[data-teh-book-id="22222"] .teh-best-price-hint',
      el => el.textContent
    );
    // NT$150 (sale): 75折=113, 8折=120, -50=100, token=167 → best is -50:100
    const best = bestOf(150);
    expect(hint).toContain('↳');
    expect(hint).toContain(best.label);
    expect(hint).toContain(String(best.cost));
  });

  test('28. 停止銷售書籍不應注入任何價格提示', async () => {
    await setStorage({});
    await loadPricesFixture();
    // Wait for other books' hints to confirm injection ran, then check sold-out item
    await page.waitForSelector('li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint', { timeout: 3000 });

    const hintOnSoldOut = await page.$('li.cart-list-item[data-teh-book-id="33333"] .teh-best-price-hint');
    expect(hintOnSoldOut).toBeNull();
  });

  test('29. 提示應注入於 .item-price-box__main 內', async () => {
    await setStorage({});
    await loadPricesFixture();
    await page.waitForSelector('li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint', { timeout: 3000 });

    const parentClass = await page.$eval(
      'li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint',
      el => el.parentElement.className
    );
    expect(parentClass).toContain('item-price-box__main');
  });

  test('30. 重複觸發 run() 不應重複注入提示（idempotency）', async () => {
    await setStorage({});
    await loadPricesFixture();
    await page.waitForSelector('li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint', { timeout: 3000 });
    // Wait for MutationObserver debounce cycle to settle
    await new Promise(r => setTimeout(r, 700));

    const hints = await page.$$('li.cart-list-item[data-teh-book-id="11111"] .teh-best-price-hint');
    expect(hints.length).toBe(1);
  });
});

describe('書籍詳情頁待購備註注入測試 (Fixture)', () => {
  let EXTENSION_ID;
  let DETAIL_FIXTURE_URL;
  const CONTENT_JS = path.resolve(__dirname, '../content.js');

  let page;

  beforeAll(() => {
    EXTENSION_ID = global.EXTENSION_ID;
    DETAIL_FIXTURE_URL = `chrome-extension://${EXTENSION_ID}/tests/fixtures/book_detail.html`;
  });

  async function setStorage(data = {}) {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (d) => new Promise(resolve => chrome.storage.sync.set(d, resolve)), data);
    await setup.close();
  }

  async function loadDetailFixture(bookId = '12345') {
    await page.goto(DETAIL_FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((id) => { history.pushState({}, '', `/book/${id}`); }, bookId);
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

  test('31. 有備註和標籤時應注入 .teh-book-detail-note 並顯示兩者', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '這本很值得買' },
      wishlistTags:    { '12345': ['奇幻', '想買'] }
    });
    await loadDetailFixture('12345');
    await page.waitForSelector('.teh-book-detail-note', { timeout: 3000 });

    const remarkText = await page.$eval('.teh-book-detail-note-text', el => el.textContent);
    expect(remarkText).toBe('這本很值得買');

    const chips = await page.$$eval('.teh-book-detail-note .teh-wishlist-tag-chip', els => els.map(e => e.textContent));
    expect(chips).toContain('奇幻');
    expect(chips).toContain('想買');
  });

  test('32. 無備註無標籤時不應注入 .teh-book-detail-note', async () => {
    await setStorage({ wishlistRemarks: {}, wishlistTags: {} });
    await loadDetailFixture('12345');
    await new Promise(r => setTimeout(r, 500));

    const note = await page.$('.teh-book-detail-note');
    expect(note).toBeNull();
  });

  test('33. Storage 更新後應重新渲染備註區塊', async () => {
    await setStorage({ wishlistRemarks: {}, wishlistTags: {} });
    await loadDetailFixture('12345');
    await new Promise(r => setTimeout(r, 300));

    const beforeNote = await page.$('.teh-book-detail-note');
    expect(beforeNote).toBeNull();

    await page.evaluate(() =>
      new Promise(resolve =>
        chrome.storage.sync.set({
          wishlistRemarks: { '12345': '延遲備註' },
          wishlistTags:    { '12345': ['延遲Tag'] }
        }, resolve)
      )
    );
    await new Promise(r => setTimeout(r, 500));

    const remarkText = await page.$eval('.teh-book-detail-note-text', el => el.textContent);
    expect(remarkText).toBe('延遲備註');

    const chips = await page.$$eval('.teh-book-detail-note .teh-wishlist-tag-chip', els => els.map(e => e.textContent));
    expect(chips).toContain('延遲Tag');
  });

  test('34. 重複觸發 run() 不應重複注入（idempotency）', async () => {
    await setStorage({
      wishlistRemarks: { '12345': '備註' },
      wishlistTags:    { '12345': ['tag'] }
    });
    await loadDetailFixture('12345');
    await page.waitForSelector('.teh-book-detail-note', { timeout: 3000 });
    await new Promise(r => setTimeout(r, 700));

    const count = await page.$$eval('.teh-book-detail-note', els => els.length);
    expect(count).toBe(1);
  });
});

const testData = require('./testData.json');

describe('Management Page Tests', () => {
  let page;
  let extensionId = 'mmmgehlnhopcejokbbdjblejkkbbahek';

  beforeAll(async () => {
    const setupPage = await global.browser.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/management.html`);
    await setupPage.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.local.set(data, resolve));
    }, testData);
    await setupPage.close();
  });

  beforeEach(async () => {
    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('管理介面應該正確載入並顯示所有的黑白名單', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    const content = await page.content();
    expect(content).toContain('布蘭登．山德森');
    expect(content).toContain('獨步文化');
    expect(content).toContain('林熹');
    expect(content).toContain('典石成金工作室');
  });

  test('名單條目的 tag 應該在清單中顯示為 chip', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    // 切換到優良名單 - 作者/譯者
    await page.click('button[data-target="section-author-white"]');
    await new Promise(r => setTimeout(r, 150));

    const content = await page.content();
    // 布蘭登．山德森 有 tags: ["奇幻", "史詩"]
    expect(content).toContain('奇幻');
    expect(content).toContain('史詩');

    // 確認 tag 使用正確的 CSS class
    const tagChips = await page.$$('.item-tag-chip');
    expect(tagChips.length).toBeGreaterThan(0);
  });

  test('可以在管理介面新增一筆資料並顯示出來', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    await page.click('button[data-target="section-author-black"]');
    await new Promise(r => setTimeout(r, 100));

    await page.type('#author-input', '新測試作者');
    await page.type('#author-note', '測試備註');
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 300));

    const content = await page.content();
    expect(content).toContain('新測試作者');
    expect(content).toContain('測試備註');
  });

  test('可以在管理介面新增含 tag 的資料', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    await page.click('button[data-target="section-pub-white"]');
    await new Promise(r => setTimeout(r, 100));

    await page.type('#white-pub-input', '測試出版社With標籤');

    // 在 tag chip input 中輸入標籤
    const tagInput = await page.$('#section-pub-white .tag-text-input');
    await tagInput.type('測試標籤');
    await tagInput.press('Enter');

    // 點擊新增按鈕
    await page.click('#add-white-pub');
    await new Promise(r => setTimeout(r, 300));

    const content = await page.content();
    expect(content).toContain('測試出版社With標籤');
    expect(content).toContain('測試標籤');
  });

  test('Tag 管理頁面應該正確顯示現有標籤', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    await page.click('button[data-target="section-list-tags"]');
    await new Promise(r => setTimeout(r, 300));

    const content = await page.content();
    // testData 中有 "奇幻", "科幻", "史詩", "爛翻譯", "台灣作者" 等標籤
    expect(content).toContain('奇幻');
    expect(content).toContain('科幻');
    expect(content).toContain('個條目');
  });

  test('遷移機制：舊格式（無 tags 欄位）應能正確載入', async () => {
    // 注入舊格式資料（0.1.0 格式，無 schemaVersion 和 tags）
    const legacyData = {
      publisherBlacklist: [{ name: '舊格式出版社', note: '測試' }],
      authorBlacklist: [],
      publisherWhitelist: [],
      authorWhitelist: []
    };

    await page.goto(`chrome-extension://${extensionId}/management.html`);
    await page.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.local.set(data, resolve));
    }, legacyData);

    // 重新載入 — 會觸發 runMigrations()
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    const content = await page.content();
    expect(content).toContain('舊格式出版社');

    // 確認 schemaVersion 已更新為 0.2.0
    const schema = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.local.get(['schemaVersion'], res => resolve(res.schemaVersion)))
    );
    expect(schema).toBe('0.2.0');
  });
});

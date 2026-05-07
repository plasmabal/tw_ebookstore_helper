const testData = require('./testData.json');

describe('Management Page Tests', () => {
  let page;
  let extensionId = 'mmmgehlnhopcejokbbdjblejkkbbahek';

  beforeAll(async () => {
    // Inject test data into chrome.storage.local
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
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('管理介面應該正確載入並顯示所有的黑白名單', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    // Validate that the lists are correctly rendered on the page
    const content = await page.content();

    expect(content).toContain('布蘭登．山德森');
    expect(content).toContain('獨步文化');
    expect(content).toContain('林熹');
    expect(content).toContain('典石成金工作室');
  });

  test('可以在管理介面新增一筆資料並顯示出來', async () => {
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    // Click on the author blacklist section to ensure it's active
    await page.click('button[data-target="section-author-black"]');
    await new Promise(r => setTimeout(r, 100)); // wait for transition

    await page.type('#author-input', '新測試作者');
    await page.type('#author-note', '測試備註');

    // The Enter key listener is bound to the inputs based on the rules in GEMINI.md
    await page.keyboard.press('Enter');

    // Check if the new author is rendered
    const content = await page.content();
    expect(content).toContain('新測試作者');
    expect(content).toContain('測試備註');
  });
});

describe('Readmoo 價格試算與領書額度適用性測試', () => {
  let page;

  beforeEach(async () => {
    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  const getDropdownText = async () => {
    await page.waitForSelector('.teh-best-option-btn', { timeout: 5000 });
    await page.click('.teh-best-option-btn');
    await page.waitForSelector('.teh-price-dropdown', { timeout: 5000 });
    return await page.evaluate(() => {
      return document.querySelector('.teh-price-dropdown').innerText;
    });
  };

  test('1. 不適用領書額度的書籍 (套書): 應該排除領書選項', async () => {
    // 丹．布朗【羅柏．蘭登系列】紀念套書
    await page.goto('https://readmoo.com/book/210470620000101', { waitUntil: 'networkidle2' });
    
    const dropdownText = await getDropdownText();
    expect(dropdownText).not.toContain('領書額度');
    expect(dropdownText).toContain('75折');
  });

  test('2. 適用領書額度的一般書籍: 應該保留領書選項', async () => {
    // 中國製造：從躺平、小粉紅到正能量...
    await page.goto('https://readmoo.com/book/210469196000101', { waitUntil: 'networkidle2' });
    
    const dropdownText = await getDropdownText();
    expect(dropdownText).toContain('領書額度');
    expect(dropdownText).toContain('75折');
  });
});

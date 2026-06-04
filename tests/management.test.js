const testData = require('./testData.json');

// ─── 原有測試 ────────────────────────────────────────────────────────────────
describe('Management Page Tests', () => {
  let page;
  let extensionId = 'mmmgehlnhopcejokbbdjblejkkbbahek';

  beforeAll(async () => {
    const setupPage = await global.browser.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/management.html`);
    await setupPage.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
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
      await new Promise(resolve => chrome.storage.sync.remove('schemaVersion', resolve));
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, legacyData);

    // 重新載入 — 會觸發 runMigrations()
    await page.goto(`chrome-extension://${extensionId}/management.html`, { waitUntil: 'networkidle0' });

    const content = await page.content();
    expect(content).toContain('舊格式出版社');

    // 確認 schemaVersion 已更新為 0.2.0
    const schema = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['schemaVersion'], res => resolve(res.schemaVersion)))
    );
    expect(schema).toBe('0.2.0');
  });
});

// ─── 編輯 / 刪除 CRUD ────────────────────────────────────────────────────────
describe('Management Page - 編輯與刪除', () => {
  const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
  let page;

  beforeEach(async () => {
    // 每個測試前重設為乾淨的 testData，確保測試間互不影響
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, testData);
    await setup.close();

    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('可以編輯現有條目的名稱與備註', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-author-black"]');
    await new Promise(r => setTimeout(r, 150));

    // 點擊第一筆（林熹）的編輯按鈕
    const editBtn = await page.$('#author-list .edit-btn');
    await editBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const nameInput = await page.$('.edit-name-input');
    await nameInput.click({ clickCount: 3 });
    await nameInput.type('修改後作者名');

    const noteInput = await page.$('.edit-note-textarea');
    await noteInput.click({ clickCount: 3 });
    await noteInput.type('修改後備註');

    await page.click('.btn-save-edit');
    await new Promise(r => setTimeout(r, 300));

    const content = await page.content();
    expect(content).toContain('修改後作者名');
    expect(content).toContain('修改後備註');

    // 確認 storage 也已更新
    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['authorBlacklist'], resolve))
    );
    expect(storage.authorBlacklist[0].name).toBe('修改後作者名');
  });

  test('取消編輯後應恢復原始資料', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-author-white"]');
    await new Promise(r => setTimeout(r, 150));

    const editBtn = await page.$('#white-author-list .edit-btn');
    await editBtn.click();
    await new Promise(r => setTimeout(r, 100));

    const nameInput = await page.$('.edit-name-input');
    await nameInput.click({ clickCount: 3 });
    await nameInput.type('不應儲存的名稱');

    await page.click('.btn-cancel-edit');
    await new Promise(r => setTimeout(r, 100));

    const content = await page.content();
    expect(content).toContain('布蘭登．山德森');
    expect(content).not.toContain('不應儲存的名稱');
  });

  test('可以刪除現有條目', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    // section-pub-black 是預設顯示的 section，含「典石成金工作室」
    await page.click('button[data-target="section-pub-black"]');
    await new Promise(r => setTimeout(r, 150));

    let content = await page.content();
    expect(content).toContain('典石成金工作室');

    const delBtn = await page.$('#pub-list .delete-btn');
    await delBtn.click();
    await new Promise(r => setTimeout(r, 300));

    content = await page.content();
    expect(content).not.toContain('典石成金工作室');

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['publisherBlacklist'], resolve))
    );
    expect(storage.publisherBlacklist).toHaveLength(0);
  });
});

// ─── Tag 管理：名單標籤 ───────────────────────────────────────────────────────
describe('Management Page - 名單 Tag 管理', () => {
  const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
  let page;

  beforeEach(async () => {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, testData);
    await setup.close();

    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('可以重命名名單 Tag，並套用至所有含該 Tag 的條目', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-list-tags"]');
    await new Promise(r => setTimeout(r, 300));

    // 找到「爛翻譯」的重命名按鈕（只有典石成金工作室有此 tag）
    await page.evaluate(() => {
      for (const span of document.querySelectorAll('.tag-manager-name')) {
        if (span.textContent === '爛翻譯') {
          span.parentElement.querySelector('.btn-tag-rename').click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 100));

    const input = await page.$('.tag-rename-input');
    await input.click({ clickCount: 3 });
    await input.type('最爛翻譯');

    await page.click('.btn-tag-rename-confirm');
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['publisherBlacklist'], resolve))
    );
    expect(storage.publisherBlacklist[0].tags).toContain('最爛翻譯');
    expect(storage.publisherBlacklist[0].tags).not.toContain('爛翻譯');
  });

  test('可以刪除名單 Tag，並從所有條目中移除', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-list-tags"]');
    await new Promise(r => setTimeout(r, 300));

    // 接受 confirm dialog
    page.once('dialog', dialog => dialog.accept());

    // 刪除「台灣作者」（九把刀有此 tag）
    await page.evaluate(() => {
      for (const span of document.querySelectorAll('.tag-manager-name')) {
        if (span.textContent === '台灣作者') {
          span.parentElement.querySelector('.btn-tag-delete').click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['authorBlacklist'], resolve))
    );
    const kouFu = storage.authorBlacklist.find(i => i.name === '九把刀');
    expect(kouFu.tags).not.toContain('台灣作者');
  });

  test('重命名後 Tag 管理頁面應顯示新名稱', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-list-tags"]');
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      for (const span of document.querySelectorAll('.tag-manager-name')) {
        if (span.textContent === '科幻') {
          span.parentElement.querySelector('.btn-tag-rename').click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 100));

    const input = await page.$('.tag-rename-input');
    await input.click({ clickCount: 3 });
    await input.type('科幻小說');

    await page.click('.btn-tag-rename-confirm');
    await new Promise(r => setTimeout(r, 500));

    const content = await page.content();
    expect(content).toContain('科幻小說');
  });
});

// ─── Tag 管理：待購清單標籤 ──────────────────────────────────────────────────
describe('Management Page - 待購清單 Tag 管理', () => {
  const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
  let page;

  const WISHLIST_TAGS_SEED = {
    wishlistTags: {
      '12345': ['小說', '想買'],
      '67890': ['小說']
    }
  };

  beforeEach(async () => {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, { ...testData, ...WISHLIST_TAGS_SEED });
    await setup.close();

    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('待購清單 Tag 管理頁面應正確顯示標籤與使用次數', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-wishlist-tags"]');
    await new Promise(r => setTimeout(r, 300));

    const content = await page.content();
    expect(content).toContain('小說');
    expect(content).toContain('想買');
    expect(content).toContain('個條目');
  });

  test('可以重命名待購清單 Tag', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-wishlist-tags"]');
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      for (const span of document.querySelectorAll('.tag-manager-name')) {
        if (span.textContent === '想買') {
          span.parentElement.querySelector('.btn-tag-rename').click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 100));

    const input = await page.$('.tag-rename-input');
    await input.click({ clickCount: 3 });
    await input.type('必買');

    await page.click('.btn-tag-rename-confirm');
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTags'], resolve))
    );
    expect(storage.wishlistTags['12345']).toContain('必買');
    expect(storage.wishlistTags['12345']).not.toContain('想買');
  });

  test('可以刪除待購清單 Tag，並從所有書籍中移除', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-wishlist-tags"]');
    await new Promise(r => setTimeout(r, 300));

    page.once('dialog', dialog => dialog.accept());

    await page.evaluate(() => {
      for (const span of document.querySelectorAll('.tag-manager-name')) {
        if (span.textContent === '小說') {
          span.parentElement.querySelector('.btn-tag-delete').click();
          return;
        }
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const storage = await page.evaluate(() =>
      new Promise(resolve => chrome.storage.sync.get(['wishlistTags'], resolve))
    );
    expect(storage.wishlistTags['12345']).not.toContain('小說');
    expect(storage.wishlistTags['67890']).not.toContain('小說');
  });
});

// ─── 備份與還原 ───────────────────────────────────────────────────────────────
describe('Management Page - 備份與還原', () => {
  const EXTENSION_ID = 'mmmgehlnhopcejokbbdjblejkkbbahek';
  let page;

  beforeEach(async () => {
    const setup = await global.browser.newPage();
    await setup.goto(`chrome-extension://${EXTENSION_ID}/management.html`);
    await setup.evaluate(async (data) => {
      return new Promise(resolve => chrome.storage.sync.set(data, resolve));
    }, testData);
    await setup.close();

    page = await global.browser.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('匯出應建立包含所有名單的 JSON 結構', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });
    await page.click('button[data-target="section-system"]');
    await new Promise(r => setTimeout(r, 100));

    // 攔截 Blob 建立以取得匯出內容，同時阻止實際下載
    const exported = await page.evaluate(() => new Promise(resolve => {
      const OrigBlob = window.Blob;
      window.Blob = function(content, options) {
        const blob = new OrigBlob(content, options);
        const reader = new FileReader();
        reader.onload = e => { window.Blob = OrigBlob; resolve(JSON.parse(e.target.result)); };
        reader.readAsText(blob);
        return blob;
      };
      // 阻止 <a>.click() 觸發下載
      const origCreate = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => {};
        return el;
      };
      exportData();
    }));

    expect(exported.publisherBlacklist).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: '典石成金工作室' })])
    );
    expect(exported.authorWhitelist).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: '布蘭登．山德森' })])
    );
    expect(exported.schemaVersion).toBe('0.2.0');
  });

  test('匯入有效備份後 storage 應更新為新資料', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });

    const importData = {
      publisherBlacklist: [{ name: '匯入出版社', note: '', tags: [] }],
      authorBlacklist:    [],
      publisherWhitelist: [],
      authorWhitelist:    [{ name: '匯入作者', note: '', tags: [] }],
      wishlistRemarks: {},
      wishlistTags:    {}
    };

    // confirm → 接受；success alert → 接受
    const dialogHandler = async (dialog) => {
      await dialog.accept();
      page.once('dialog', dialogHandler);
    };
    page.once('dialog', dialogHandler);

    await page.evaluate((dataStr) => {
      const file = new File([dataStr], 'backup.json', { type: 'application/json' });
      handleImport(file);
    }, JSON.stringify(importData));

    await new Promise(r => setTimeout(r, 1500)); // 等待 FileReader + confirm + runMigrations

    const storage = await page.evaluate(() =>
      new Promise(resolve =>
        chrome.storage.sync.get(['publisherBlacklist', 'authorWhitelist'], resolve)
      )
    );
    expect(storage.publisherBlacklist[0].name).toBe('匯入出版社');
    expect(storage.authorWhitelist[0].name).toBe('匯入作者');
  });

  test('匯入無效 JSON 應顯示錯誤 alert', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });

    const alertMsg = await new Promise(resolve => {
      page.once('dialog', async dialog => {
        resolve(dialog.message());
        await dialog.accept();
      });
      page.evaluate(() => {
        const file = new File(['invalid {{{'], 'bad.json', { type: 'application/json' });
        handleImport(file);
      });
      setTimeout(() => resolve(null), 2000);
    });

    expect(alertMsg).not.toBeNull();
    expect(alertMsg).toContain('無法解析');
  });

  test('匯入結構損壞的備份應顯示錯誤 alert', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });

    const alertMsg = await new Promise(resolve => {
      page.once('dialog', async dialog => {
        resolve(dialog.message());
        await dialog.accept();
      });
      page.evaluate(() => {
        // publisherBlacklist 應是物件陣列，這裡傳字串陣列（結構錯誤）
        const bad = JSON.stringify({ publisherBlacklist: ['not-an-object'] });
        const file = new File([bad], 'bad.json', { type: 'application/json' });
        handleImport(file);
      });
      setTimeout(() => resolve(null), 2000);
    });

    expect(alertMsg).not.toBeNull();
    expect(alertMsg).toContain('❌');
  });

  test('匯入不含任何有效 key 的 JSON 應顯示錯誤 alert', async () => {
    await page.goto(`chrome-extension://${EXTENSION_ID}/management.html`, { waitUntil: 'networkidle0' });

    const alertMsg = await new Promise(resolve => {
      page.once('dialog', async dialog => {
        resolve(dialog.message());
        await dialog.accept();
      });
      page.evaluate(() => {
        const bad = JSON.stringify({ unknownKey: 'value' });
        const file = new File([bad], 'bad.json', { type: 'application/json' });
        handleImport(file);
      });
      setTimeout(() => resolve(null), 2000);
    });

    expect(alertMsg).not.toBeNull();
    expect(alertMsg).toContain('❌');
  });
});

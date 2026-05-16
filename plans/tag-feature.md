# Tag 功能規劃

**狀態**：設計確認，待實作
**建立日期**：2026-05-15

---

## 確認的設計決策

| 決策點 | 結論 |
|--------|------|
| Tag 池共用？ | **分開**：名單 tag 與待購清單 tag 各自獨立 |
| Tag 輸入方式 | **自由輸入 + autocomplete**（輸入後 Enter/逗號確認成 chip） |
| Tag 顯示於書籍頁面？ | **否**，僅管理介面 |
| Tag 管理頁 | **需要**（改名、刪除並批次套用） |
| 待購清單 tag 管理 | **只管 tag 池**（改名/刪除）；個別書籍 tag 編輯在 content.js 的 Readmoo 待購清單頁 |
| 名單條目行內編輯 | **補上**（名稱、備註、tags 均可行內編輯，不再需要刪除重加） |

---

## 影響範圍總覽

```
management.html  ← 新增 tag 輸入欄位、Tag 管理分頁
management.css   ← chip input、tag chip 樣式、行內編輯樣式
management.js    ← 資料讀寫、渲染、tag 管理邏輯
content.js       ← wishlist 備註 popover 加入 tag 輸入；待購清單頁面顯示 tags
```

---

## 資料結構

### 名單條目（0.1.0 → 0.2.0）

```js
// 0.1.0 格式（現有使用者的資料）
{ name: string, note: string }

// 0.2.0 格式（新增 tags）
{ name: string, note: string, tags: string[] }
```

### 遷移機制設計

在 `chrome.storage.local` 中儲存 `schemaVersion`，啟動時依序執行所有尚未套用的遷移，確保跳版（如 0.1.0 → 0.3.0）的使用者也能安全升級。

```js
const MIGRATIONS = [
  {
    version: '0.2.0',
    run: async () => {
      // 為四個名單的所有條目補上 tags: []
      // 初始化 wishlistTags: {}
    }
  },
  // 未來版本：{ version: '0.3.0', run: async () => { ... } },
];

async function runMigrations() {
  const { schemaVersion } = await storageGet(['schemaVersion']);
  const from = schemaVersion || '0.1.0';

  const pending = MIGRATIONS.filter(m => semverGt(m.version, from));
  for (const m of pending) {
    await m.run();
    await storageSet({ schemaVersion: m.version });
  }
}
```

**關鍵設計原則**
- 每個 `run()` 需為冪等（重複執行不造成破壞）
- 每跑完一個版本就更新 `schemaVersion`（即使中途失敗，下次只從失敗點繼續）
- 不依賴 semver 函式庫，可用簡單的版本字串陣列順序代替

舊的 `migrateData()` 整個移除（它處理的是 pre-release 格式，0.1.0 正式版中已不存在，移除不影響任何使用者）。

### 待購清單（新增獨立 key）

```js
wishlistRemarks: { [bookId]: string }   // 不動
wishlistTags:    { [bookId]: string[] } // 新增
```

優點：不破壞現有 `wishlistRemarks` 結構，遷移與驗證最小化。

### Export/Import 新增 key

`wishlistTags` 加入 `keysToExport` 與 `handleImport` 的 `validKeys` 及結構驗證。

---

## 新 UI 組件：Tag Chip Input

通用組件，可在名單新增表單與行內編輯中復用。

**外觀（草稿）**

```
┌──────────────────────────────────────────────┐
│ [科幻 ×]  [日系 ×]  [輸入標籤，Enter 確認…] │
└──────────────────────────────────────────────┘
 ↓ 輸入時彈出 autocomplete
┌──────────────────────────────────────────────┐
│ 科幻小說                                      │
│ 科幻（已選）                                  │
└──────────────────────────────────────────────┘
```

**行為規格**
- 輸入後按 **Enter** 或 **,（逗號）** 新增一個 chip
- 點擊 chip 的 **×** 移除
- 輸入時從現有 tag 池過濾建議（autocomplete dropdown）
- Tag 最大長度：20 字元
- 同名 tag 不重複加入（直接 focus 回 input）

---

## 新增表單更新（名單）

```
[ 名稱 (必填)...                              ]
[ 備註 (選填，支援多行)...                    ]
[ 標籤: [科幻 ×] [日系 ×] [輸入標籤…]       ]  ← 新增
[ 新增至黑名單 ]
```

適用四個名單分頁（publisherBlacklist、authorBlacklist、publisherWhitelist、authorWhitelist）。

---

## 名單條目行內編輯

點擊條目任意處（刪除按鈕除外）進入編輯模式：

```
┌─────────────────────────────────────────────┐
│ [ 名稱（可編輯）                           ]│
│ [ 備註（可編輯）                           ]│
│ [ 標籤: [科幻 ×] [日系 ×] [輸入…]         ]│
│ [儲存]  [取消]                              │
└─────────────────────────────────────────────┘
```

- 儲存：更新 `items[index]`，`chrome.storage.local.set` 後重新渲染
- 取消：恢復顯示模式
- 刪除按鈕在編輯模式不可見（避免意外）

---

## Tag 管理分頁

### 側邊欄新增

```
🏷️ 標籤管理
  名單標籤
  待購清單標籤
```

（在「系統工具」群組上方加入新的 nav-group）

### 名單標籤管理頁

- 動態彙整四個名單所有 tag，去重統計
- 顯示：`[科幻]  3 個條目  [重命名] [刪除]`
- **重命名**：點擊後 tag 名稱變為 input，Enter 確認 → 遍歷四個名單的所有條目，找出含舊 tag 的條目，替換為新 tag → 批次 `chrome.storage.local.set`
- **刪除**：確認後 → 遍歷四個名單所有條目，移除該 tag → 批次儲存
- 若無任何 tag，顯示空狀態提示

### 待購清單標籤管理頁

- 動態彙整 `wishlistTags` 所有 tag，去重統計
- 邏輯相同，但操作對象為 `wishlistTags`

---

## 待購清單 tag（content.js）

### showRemarkPopover 更新

```
┌──────────────────────────────────────────────┐
│ 輸入備註 (例如：為何想買這本書？)             │  ← 現有 textarea
│                                              │
│ 標籤: [等特價 ×] [今年必買 ×] [輸入…]       │  ← 新增 chip input
│                                   [取消] [儲存]│
└──────────────────────────────────────────────┘
```

### injectWishlistRemarks 更新

待購清單頁面每本書的 remark container 加入 tag 顯示：

```
📝 備註: 等出平裝版再買
🏷️ [等特價] [今年必買]   ← 新增，點擊可行內編輯
```

Tag 行內編輯：點擊 tag 區域出現 chip input，blur 後儲存。

### 資料清理邏輯更新

現有自動清理邏輯（書籍從待購清單移除後清除備註）也要同步清理 `wishlistTags`。

---

## 實作步驟

- [x] **Phase 1｜資料層與遷移機制**
  - [x] 移除舊 `migrateData()` 及所有呼叫點（management.js × 3、content.js × 1）
  - [x] 實作 `runMigrations()`：讀取 `schemaVersion`，依序執行尚未套用的遷移
  - [x] 實作 0.2.0 遷移：為四個名單補 `tags: []`、初始化 `wishlistTags: {}`
  - [x] `management.js` 在 `loadSettings()` 前呼叫 `runMigrations()`
  - [x] 將 `wishlistTags` 加入 `content.js` 的 `initStorage` / `updateCache` / `validKeys`
  - [x] 將 `wishlistTags`、`schemaVersion` 加入 `management.js` 的 `loadSettings` / `exportData` / `handleImport`
  - [x] `handleImport` 簡化 `validateList`（移除 `typeof item === 'string'` 分支，只接受物件格式），加入 `wishlistTags` 驗證（需為 `{ [string]: string[] }` 形式）

- [x] **Phase 2｜Tag Chip Input 組件**
  - [x] `management.css`：chip、chip-input-container、autocomplete dropdown 樣式
  - [x] `management.js`：`createTagChipInput(initialTags)` 函數，回傳 DOM element
  - [x] 支援：新增 chip（Enter/逗號）、移除 chip（×）、autocomplete 過濾（讀取共享 listTagPool）

- [x] **Phase 3｜名單新增表單**
  - [x] `management.js`：`setupSection()` 動態注入 tag chip input（插入於 button 前）
  - [x] `addItem()` 讀取 chip input 的 tags 並加入條目

- [x] **Phase 4｜名單條目行內編輯**
  - [x] `renderList()` 重構：改為呼叫 `buildDisplayRow()` / `buildEditRow()`
  - [x] 顯示模式：名稱、備註、tag chips、編輯/刪除按鈕
  - [x] 編輯模式：name input、note textarea、tag chip input、儲存/取消按鈕
  - [x] 儲存：`items[index] = { name, note, tags }`，重新儲存並 `loadSettings()`

- [x] **Phase 5｜Tag 管理分頁**
  - [x] `management.html`：新增 sidebar nav-group「🏷️ 標籤管理」及兩個 section
  - [x] `management.js`：`loadListTagManager()` / `loadWishlistTagManager()` / `renderTagManagerContent()`
    - [x] 統計各 tag 使用次數
    - [x] 重命名：批次更新四個 storage key 中所有含舊 tag 的條目（行內編輯）
    - [x] 刪除：同上，移除 tag（confirm 確認後執行）
  - [x] 待購清單 tag 管理：操作 `wishlistTags` key

- [x] **Phase 6｜content.js 更新**
  - [x] 載入 `wishlistTags`（`initStorage` / `updateCache`），維護 `wishlistTagPool`
  - [x] `showRemarkPopover` 加入 tag chip input（content.js 內的輕量實作 `createWishlistChipInput`）
  - [x] `saveRemark` 改為 `saveWishlistData(bookId, note, tags, callback)` 同時儲存 remarks 與 tags，立即更新 in-memory cache
  - [x] `injectWishlistRemarks` 加入 tag 顯示與行內編輯（save/cancel 按鈕，非 blur-to-save）
  - [x] 自動清理邏輯同步清理 `wishlistTags`
  - [x] `content.css` 加入 wishlist tag chip 樣式

- [x] **Phase 7｜測試與文件**
  - [x] `tests/testData.json`：更新為 0.2.0 格式（含 tags、schemaVersion）
  - [x] `tests/management.test.js`：新增 tag chip 顯示、含 tag 新增、tag 管理頁、遷移機制測試
  - [x] `CHANGES.md`：更新 changelog

---

## 已知風險與注意事項

1. **content.js 的 chip input 獨立實作**：content.js 是注入頁面的 IIFE，無法 import management.js 的函數。需在 content.js 內撰寫一個輕量版 chip input，或將共用邏輯抽到 sites.js。
2. **XSS 防範**：Tag 名稱必須用 `textContent` 設定，禁止 innerHTML 直接插入使用者輸入的 tag 字串。
3. **Tag 長度與字符限制**：建議 20 字元上限，trim 後禁止純空白。
4. **Autocomplete 點擊事件**：需防止 dropdown 在 blur 之前先被關閉（mousedown preventDefault 技巧）。
5. **Export/Import 相容性**：舊備份檔匯入時，`wishlistTags` 和 `tags` 欄位可能不存在，需視為 `{}` / `[]` 而非錯誤。

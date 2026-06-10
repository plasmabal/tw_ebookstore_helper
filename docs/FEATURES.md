# 功能規格說明 (Feature Specification)

本文件描述各功能的**預期行為**，作為開發、重構或 bug 修正時的對照基準。
修改程式前請先確認改動不會違反此處定義的規格；若需調整規格，應先更新本文件並取得確認。

---

## 1. 黑白名單標記

**適用平台**：Readmoo、博客來、Kobo TW

### 1.1 黑名單

- 符合名單的出版社或作者名稱，套用 `teh-blacklisted-text` class（變淡 + 刪除線）
- 若某書籍區塊（如搜尋結果列、書籍詳情頁）含有黑名單的作者或出版社：
  - 書名套用 `teh-blacklisted-title` class（變淡 + 刪除線）
  - 區塊本身套用 `teh-blacklisted-block` class，使其內的 `img`（封面）一併刷淡（opacity 0.25 + grayscale 60%）；hover 時恢復至 opacity 0.6 + grayscale 20%
- 文字比對須先 `.trim()`，避免前後空白導致誤判

### 1.2 白名單（優良名單）

- 符合名單的出版社或作者名稱，套用 `teh-whitelisted-text` class（綠色突顯）
- 黑名單優先於白名單：同一元素若同時符合兩者，以黑名單為準

### 1.3 適用頁面類型

| 頁面類型 | Readmoo | 博客來 | Kobo |
|---------|---------|--------|------|
| 書籍詳情頁 | ✅ | ✅ | ✅ |
| 作者/出版社頁 | ✅ | — | — |
| 列表/搜尋頁 | ✅ | ✅（作者限有連結者）| ✅ |

### 1.4 限制

- 博客來搜尋頁的出版社無連結，無法標記
- Kobo 無出版社資訊，出版社名單不適用
- Kobo 無獨立作者頁，作者連結導向搜尋頁

---

## 2. 價格試算小幫手

**適用平台**：Readmoo

| 頁面類型 | 呈現方式 |
|---------|---------|
| 書籍詳情頁（`/book/`） | 完整下拉選單 |
| 活動頁大張宣傳卡片（`/campaign/*` `.panel-body`） | 完整下拉選單 |
| 每日特惠書列表（`/campaign/specialoffer/`）| 輕量綠色標籤 |
| 活動頁延伸閱讀列表（`/campaign/*` `.listItem-box`） | 輕量綠色標籤 |
| 待購清單（`/checkout/cart#wishlist`）| 輕量綠色標籤 |

### 2.1 顯示條件

偵測以下任一格式的價格區塊，且未已注入過（`.teh-price-helper-container` 或 `.teh-best-price-hint` 不存在）：

- `.price` 元素，innerText 含 `電子書售價`、`電子書特價` 或 `電子書：`，且內有 `<strong>` 價格
- 活動頁：`.panel-body > DIV`，含「電子書售價」文字節點，價格為純數字文字節點
- 待購清單：`li.cart-list-item` 下的 `.item-price`（以 `aria-label="單價NNN元"` 取價格）；含 `span.text-attention` 且文字為「停止銷售」的書籍略過不注入

注入位置：價格容器內（`info.container`）。

**呈現判斷**：若 `info.container` 位於 `.listItem-box` 或 `.cart-list-item` 內，顯示輕量標籤；否則顯示完整下拉選單。

### 2.2 計算選項

以下四個選項恆顯示：
- **75折**：`price × 0.75`（四捨五入）
- **8折**：`price × 0.80`
- **-50**：`price - 50`（最低為 0）
- **領書額度 N 點**：`ceil(price / 250) × 167`
  - 讀墨以 6 個領書額度 $999 販售，即每點 $999 ÷ 6 ≈ **$167**
  - 一個額度可領 **$250 以內**的書，超過 $250 的書需多點疊加
  - 官方說明：https://readmoo.com/readdict

**例外**：若頁面上的「領書額度兌換」按鈕為 disabled 狀態（套書等不適用品項），**不顯示領書額度選項**。

### 2.3 互動行為

**完整下拉選單**：
- 點擊主按鈕展開下拉選單；點擊頁面其他位置收起
- 下拉選單中，最低價選項標示「(最佳)」
- 主按鈕顯示最佳選項的標籤

**輕量標籤**（列表卡片）：
- 以 `↳ {最佳選項}` 格式顯示於價格下方，不可點擊
- 樣式：淡綠底色、深綠文字小圓角標籤

---

## 3. 待購清單備註與標籤

**適用平台**：Readmoo（書籍詳情頁 + 待購清單頁）

### 3.1 書籍詳情頁（書籍加入流程）

**觸發條件**：
- 使用者點擊「加入待購清單」按鈕（`button[title*="待購清單"]`），且該按鈕當下**不是** active 狀態（即尚未加入）

**行為**：
- 點擊後 500ms 彈出備註輸入浮窗（popover），讓讀墨 API 有時間完成
- 浮窗包含：多行文字備註欄、tag chip 輸入框（支援 autocomplete）、儲存／取消按鈕
- 若此 bookId 已有備註，預填現有內容
- 「取消」：關閉浮窗，不儲存
- 「儲存」：寫入 `chrome.storage.sync`（`wishlistRemarks`、`wishlistTags`），關閉浮窗

**從已加入改成移除時**：
- 點擊按鈕時若按鈕為 active（即移除書籍），**不清除**備註與標籤
- 使用者可能只是暫時移除，應保留已輸入的資料供日後重新加入時使用
- 備註清除只發生在待購清單頁的明確移除操作（見 3.2）

**注意**：bookId 一律從 `window.location.pathname` 的 `/book/(\d+)` 取得，確保與待購清單頁使用相同格式。

**浮窗關閉條件**：
- 點擊「取消」或「儲存」
- 點擊浮窗外的頁面區域（outside click）
- **例外**：若外部點擊目標位於 `[role="dialog"]` 內（如讀墨的「成功加入」確認視窗），**不關閉浮窗**

### 3.2 書籍詳情頁（備註與標籤顯示）

**觸發條件**：
- URL 符合 `/book/\d+`
- `cachedLists.wishlistRemarks[bookId]` 或 `cachedLists.wishlistTags[bookId]` 有資料

**行為**：
- 在 `.book-info-text` 末端（`.book-price` 之後）插入 `.teh-book-detail-note` 區塊
- 區塊顯示：標題列「📝 待購備註」+ 右側「編輯」按鈕、備註文字（若有）、tag chip（若有）
- 若備註與標籤皆為空，移除現有區塊
- 重複呼叫時以 `data-teh-hash`（remark + tags 字串）比對，內容相同則略過，避免 MutationObserver 無限觸發
- 點擊「編輯」按鈕：開啟現有的 `showRemarkPopover()`，儲存後自動重新渲染

### 3.3 待購清單頁（備註顯示與編輯）

**觸發條件**：`window.location.hash.includes('#wishlist')`

**注入行為**：
- 對每個 `li.cart-list-item` 注入 `.teh-wishlist-remark-container`
- bookId 從 `.item-cover-link` 的 href（`/book/(\d+)`）取得
- 注入位置：`.item-detail-content` 內的 `.item-contributor-box` 之後
- 已注入過的條目略過

**顯示模式**（預設）：
- 顯示備註文字與 tag chip（純顯示，不可點擊觸發篩選）
- 無備註時欄位空白（容器仍存在）

**編輯模式**（點擊容器後）：
- 若容器已含 textarea，不重複進入編輯模式
- 顯示 textarea（預填現有備註）、tag chip 輸入框
- 「儲存」：寫入 storage，回到顯示模式
- 「取消」：直接回到顯示模式，不更動資料

**Chip input autocomplete 來源**：目前有書籍使用的 tag（`wishlistTagPool`）∪ `wishlistTagTemplates`（已儲存的常用 tag）去重合併後提供建議。

**Tag filter bar**（清單上方狀態條）：

- 進入頁面時自動顯示於 `ul.cart-list-item-list` 上方（`.teh-tag-filter-bar`）
- 第一項為 `清除標籤篩選` 按鈕（`.teh-filter-clear-btn`），外觀與 tag 有所區別
- 其餘項目為所有書籍的 tag 集合（`.teh-filter-tag`），依 `wishlistTagPool` 順序排列
- 每個 tag / 清除按鈕各有 disabled（預設）與 active（`.teh-filter-tag-active`）兩種狀態
- 點擊 disabled tag → active；點擊 active tag → disabled（toggle）
- 多個 tag active 時，清單以 **AND 交集**篩選——只顯示同時擁有所有 active tag 的書籍
- 篩選結果為零時，顯示 `.teh-wishlist-empty-filter-msg`（「沒有符合篩選條件的書籍」）
- 點擊 `清除標籤篩選` → 全部 tag 回 disabled，`清除標籤篩選` 本身也回 disabled，顯示全部書籍
- `clear 標籤篩選` 按鈕：無 active tag 時為 disabled；有 active tag 時為 active
- storage 更新後重新渲染時，已 active 的 tag 狀態保留（`activeTagFilters` Set 不清空）；若某 active tag 已從 pool 消失，自動移除
- 切換 hash 後回到 `#wishlist`，active 狀態重置（`activeTagFilters.clear()`）

**移除書籍時**：
- 監聽每個條目的 `.btn-remove` 按鈕，點擊時自動清除該 bookId 的備註與標籤

**Auto-cleanup**（每次進入待購清單頁時執行一次）：
- 掃描所有 `li.cart-list-item`，收集目前在清單中的 bookId 集合
- 清除 `wishlistRemarks` 和 `wishlistTags` 中不在此集合的孤立資料
- 每次 hash 切換至 `#wishlist` 只執行一次（`wishlistCleanupDone` 旗標控制）
- **前提**：待購清單頁面一次載入所有條目（非動態分頁），cleanup 時 DOM 已完整

---

## 4. 管理介面

**位置**：Extension popup → 「開啟設定」，或直接開啟 `management.html`

### 4.1 黑白名單 CRUD

四個清單（出版社黑、作者黑、出版社白、作者白）各自支援：
- **新增**：輸入名稱（必填）、備註（選填）、標籤（選填）→ Enter 或點按鈕
- **顯示**：列出所有條目，顯示名稱、備註、tag chip
- **行內編輯**：點鉛筆按鈕進入編輯模式，可修改名稱、備註、標籤；「儲存」或「取消」
- **刪除**：點垃圾桶按鈕直接刪除（無確認對話框）

重複名稱不允許新增。

### 4.2 標籤管理（名單標籤）

- 統計所有清單條目使用的 tag 及其出現次數
- **重命名**：行內輸入新名稱 → 確認，批次更新所有含該 tag 的條目
- **刪除**：confirm 對話框確認後，從所有條目移除該 tag
- 操作後即時刷新清單與 tag 管理頁面

### 4.3 標籤管理（待購清單標籤）

- 合併顯示兩個來源的 tag：
  - **有書籍使用的 tag**：從 `wishlistTags` 統計書籍數，依數量降序排列，顯示 `X 本`
  - **已儲存的 template tag**（`wishlistTagTemplates`，目前無書籍）：依字母順序排在下方，顯示 `(0 本)`；與有書籍的 tag 之間加分隔線
- 同一 tag 若同時在 `wishlistTags` 和 `wishlistTagTemplates`，只顯示一次（以有書籍的版本為主）
- **重命名**：同步更新 `wishlistTags` 所有書籍與 `wishlistTagTemplates`
- **刪除**：同步從 `wishlistTags` 所有書籍與 `wishlistTagTemplates` 移除

**wishlistTagTemplates 的生命週期**：
- **轉存**：當書籍離開待購清單（使用者點「移除」或 auto-cleanup），若該書的 tag 已無其他書籍使用，自動加入 `wishlistTagTemplates`
- **刻意清空不轉存**：使用者在編輯模式清空某書的標籤並儲存（書仍在清單），不觸發轉存
- **去活化**：某 tag 被加入任何書籍時，自動從 `wishlistTagTemplates` 移除（已有書籍對應，無需保留）

### 4.4 備份與還原

**匯出**：
- 下載 `teh_backup_YYYYMMDD_HHMM.json`
- 包含：四個清單、`wishlistRemarks`、`wishlistTags`、`wishlistTagTemplates`、`schemaVersion`

**匯入**：
- 接受 JSON 檔（點擊選取或拖曳至 drop zone）
- 驗證格式：各清單須為物件陣列且含 `name`，remarks/tags 須為 object 非 array，`wishlistTagTemplates` 須為 array
- 若不含任何有效 key，顯示錯誤
- 驗證通過後顯示 confirm 對話框，確認才覆蓋現有資料
- 匯入後自動執行 `runMigrations()` 確保結構相容，並顯示成功 alert

### 4.5 Schema 遷移

- 啟動時自動執行 `runMigrations()`
- 0.1.0 → 0.2.0：為所有清單條目補上 `tags: []`；建立 `wishlistTags: {}`

### 4.6 Local → Sync 一次性遷移

- 所有資料儲存於 `chrome.storage.sync`，以支援跨裝置同步（需登入同一 Chrome 帳號）
- 首次載入（options page 或 content script）時，自動檢查 `chrome.storage.local` 中的舊資料，若存在則複製至 `sync`
- 遷移完成後於 `chrome.storage.local` 寫入 `localToSyncMigrated: true`，後續略過此步驟
- 若 sync 配額超限（總上限 100 KB、單 key 上限 8 KB），遷移靜默失敗並記錄 warning；匯入時配額超限則顯示錯誤訊息

---

## 5. 跨功能行為

- **即時同步**：`chrome.storage.onChanged` 監聽 `sync` namespace，儲存變更後自動重新渲染頁面上的所有功能
- **跨裝置同步**：資料存於 `chrome.storage.sync`，同一 Chrome 帳號下多台裝置自動同步；Edge 等其他 Chromium 瀏覽器同樣支援，但各瀏覽器的帳號體系獨立，無法跨瀏覽器同步
- **MutationObserver**：300ms debounce，SPA 換頁或動態載入後自動重新執行注入
- **Hash 切換**：`hashchange` 事件觸發重新執行，並重置 `wishlistCleanupDone`
- **XSS 防護**：所有使用者輸入一律用 `.textContent` 插入，嚴禁 `.innerHTML`

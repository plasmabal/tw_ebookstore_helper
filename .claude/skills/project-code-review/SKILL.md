---
name: project-code-review
description: Chrome extension 專用 code review。審查 git staged 變更，以繁體中文輸出易讀的 markdown 報告並複製到剪貼簿。涵蓋正確性、安全性（個人資訊、XSS、script injection）、Chrome extension 特有問題。使用多角度平行 finder + 驗證的兩段式流程。
---

# tw-ebookstore code review

審查目前 `git stage` 的修改，以**繁體中文**輸出 markdown 格式的 review 報告，最後複製到系統剪貼簿。

## 呼叫方式

`/project-code-review` — 審查目前所有 staged + 未 commit 的變更。

## 執行流程

### Phase 0 — 取得 diff

```bash
git diff HEAD && git diff --cached
```

若輸出過大，讀取存檔的完整內容。

### Phase 1 — 平行 Finder（用 Agent tool）

同時啟動三個獨立 finder agent，每個回傳最多 6 個候選問題：

**Finder A — 逐行掃描**
逐行讀 diff，對每個 hunk 問：什麼輸入、狀態、時序會讓這行出錯？
找：條件反轉、null/undefined deref、missing await、falsy-zero、copy-paste 錯誤、catch 吞掉 error、mutation-during-iteration。
也要讀被修改函式的**完整本體**——觸及但未更動的行同樣在審查範圍內。

**Finder B — 移除行為稽核**
對每個被刪除或替換的行，說明它原本守護的不變式，再找新程式碼在哪裡重新建立。
找不到 → 候選問題（移除的 guard、消失的 error path、縮窄的驗證）。

**Finder C — 跨檔追蹤 + 安全**
- 跨檔：找每個被改動函式的呼叫點，確認簽名/回傳/前置條件沒有破壞呼叫端。
- 安全（本專案重點）：
  - **個人資訊 / Token**：diff 中有無 API key、email、密碼、憑證？
  - **XSS**：有無用 `innerHTML` 寫入不可信資料？（應用 `.textContent`）
  - **Script injection**：content script 注入的 DOM 元素，頁面 JS 是否能偽裝或探測 extension 狀態？
  - **chrome.storage 邊界**：讀回的資料有無在用於 DOM/邏輯前做型別驗證？

### Phase 2 — 驗證

對收集到的候選問題去重，對每個執行一票驗證（可直接推理或用 `node -e` 跑純邏輯片段）：
- **CONFIRMED**：明確可重現
- **PLAUSIBLE**：有可信的觸發路徑（預設值，不要因為「機率低」就否決）
- **REFUTED**：程式碼已明確處理，或類型/常數使其不可能發生

丟掉 REFUTED，保留其餘。

### Phase 3 — 輸出

依嚴重程度排列，以**繁體中文**撰寫易讀的 markdown 報告，格式如下：

```markdown
## 安全檢查

**個人資訊 / Token**：（有/無）。**XSS**：（說明）。

---

## 問題一：（標題）
**位置**：`file.js` 第 N 行

（說明情境與影響）

**修法**：（具體建議）

---

## 問題二：...

---

## 小結

| 優先度 | 問題 | 建議動作 |
|--------|------|---------|
| 高/中/低 | ... | ... |
```

最後執行：
```bash
cat <<'EOF' | pbcopy
（報告內容）
EOF
```

並告知使用者已複製到剪貼簿。

## 本專案特有注意事項

**架構**：Manifest V3 Chrome Extension，無 bundler，所有 JS 直接載入。

**常見正確性陷阱**：
- `chrome.storage.sync` 非同步，讀完寫入之間可能有 race（另一個 tab 或 `onChanged` 插入）
- `MutationObserver` childList 會被 `innerHTML = ''` 觸發，可能導致無限 debounce 循環
- `Set.prototype.forEach` 中刪除目前元素是安全的，但刪除尚未拜訪的元素會跳過它
- `document.querySelector` 只搜尋 live DOM，detached node 找不到
- `window.location.hash === '#wishlist'` 用精確比對，不用 `includes`

**安全重點**：
- tag 值應用 `.textContent`（非 `innerHTML`）寫入 DOM
- 從 storage 讀回的資料（尤其匯入的備份），陣列元素要驗證是 `string`
- content script 注入的元素在頁面 DOM 中，頁面可操作——避免用 `querySelector` 找 extension 自己建的元素而信任頁面可能預先注入的同名元素

**Storage schema**：
- `wishlistTagTemplates`：`string[]`，匯入時需驗證每個元素為字串
- `deleteWishlistTag` / `saveWishlistData` 清空某書 tags 後應 `delete` 該 bookId，而非留下空陣列 `[]`

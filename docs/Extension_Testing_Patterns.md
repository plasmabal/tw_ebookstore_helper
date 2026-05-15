# 擴充功能自動化測試經驗與架構指南 (Testing Patterns)

這份文件記錄了本專案導入 Puppeteer + Jest 自動化 E2E 測試時遇到的關鍵問題與解決架構，供未來維護或開發新功能時參考。

## 1. 隔離環境：為何捨棄 puppeteer-core 改用 puppeteer？
*   **問題背景**：最初嘗試使用 `puppeteer-core` 搭配本機 Mac Chrome 的執行檔路徑來跑測試。但在 macOS 上，若使用者原本就已經開啟了 Chrome，新啟動的 Puppeteer session 很容易被合併進既有的 Chrome 執行實例中，導致啟動參數 `--load-extension` 被系統忽略，擴充功能完全無法載入。
*   **解決方案**：全面改用完整的 `puppeteer` 套件。它會在安裝時下載專屬的 Chromium 執行檔。測試時一律透過這個獨立的 Chromium 核心啟動，不僅能確保 100% 的隔離環境 (Isolated Context)，也不會受到使用者日常開啟的分頁與擴充功能干擾，徹底解決了擴充功能載入失敗的問題。

## 2. 測試資料注入：固定 Extension ID 與無頭注入法
*   **問題背景**：本專案為輕量化架構，沒有撰寫 Background Service Worker。這導致在測試環境下，Puppeteer 無法輕易地透過 `browser.targets()` 攔截到擴充功能的專屬執行緒，無法直接呼叫 `chrome.storage.local` 來注入測試用的黑白名單。
*   **解決方案**：
    1.  **固定 Extension ID**：在 `manifest.json` 中手動加入了一組固定的 `key` 值（此行為對發布至 Chrome Web Store 沒有影響，因商店會根據開發者憑證重新核發或認定）。這使得擴充功能的 ID 在任何本地測試環境下都固定為 `mmmgehlnhopcejokbbdjblejkkbbahek`。
    2.  **特權上下文注入**：測試腳本 (`tests/setup.js` 等) 會透過 Puppeteer 直接導航至 `chrome-extension://mmmgehlnhopcejokbbdjblejkkbbahek/management.html`。在這個擴充功能專屬的頁面中，擁有完整的 Extension Context 權限，因此可以直接使用 `page.evaluate` 執行 `chrome.storage.local.set`，達成測試資料預載入。

## 3. 新網站的 CSS Selector 必須實測，不可推測

新增書商支援時，**所有 CSS selector 必須先開啟真實頁面確認後才能寫進 `sites.js`**，不可依賴 AI 推測或參考舊 stash 的程式碼。

*   **背景**：網站的 DOM 結構往往與「看起來合理」的 class 名稱不同。例如 `search.books.com.tw` 搜尋頁中，`li.item` 看似是書籍卡片，實際上是左側分類過濾標籤；真正的搜尋結果在 `.table-td`。AI 生成的 selector 若未經實測，很容易選錯容器卻毫無報錯。
*   **做法**：使用 Puppeteer 腳本或 agent-browser，在真實頁面上執行 `document.querySelectorAll(selector)` 來確認元素存在與數量，並抽查 `innerText` / `href` 確認是正確的目標節點，再寫入程式碼。

## 4. 非同步斷言 (Async Assertions) 與嚴謹的選擇器
*   **問題背景**：
    1.  **時間差 (Flaky Tests)**：擴充功能的 `content.js` 在處理 DOM 變更時，為了效能考量，對 `MutationObserver` 加入了 300ms 的 Debounce 延遲。若 Jest 測試在頁面 `load` 完成後立刻進行斷言，往往會因為擴充功能還沒開始上色而誤判失敗。
    2.  **作用域不精準**：早期測試腳本使用的選擇器（如 `a[href*="/publisher/"]`）過於廣泛，會誤抓到網頁頂部的麵包屑導覽列或其他無關連結。
*   **解決方案**：
    1.  **放棄即時檢查，改用等待機制**：捨棄原先的立刻斷言 (`checkClass`)，全面改用 `waitForClass` 函數。該函數底層封裝了 `page.waitForFunction`，配合 5 秒的超時設定，給予擴充功能足夠的反應時間。只要元素在時間內被掛上正確的 class 標籤（如 `.teh-blacklisted-title`），測試就會立刻通過。
    2.  **落實分層作用域原則**：斷言時使用的選擇器必須與 `sites.js` 中的邏輯完全一致。例如，針對書籍詳情頁的出版社判定，必須限定前綴如 `.book-detail-info a[href*="/publisher/"]`，以確保測試的精確性。

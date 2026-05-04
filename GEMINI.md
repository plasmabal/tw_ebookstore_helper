# Taiwan Ebookstore Helper 專案開發規範與知識庫

這份文件記錄了本專案開發過程中的經驗教訓與核心原則，所有的 AI 助理與開發者在進行後續開發時都必須嚴格遵守。

## 1. 網頁 DOM 解析策略 (Readmoo 特定)
*   **高容錯的選擇器**：Readmoo 的網頁結構與 URL 格式會變動（如 `/search/contributor/` vs `/contributor/`）。在抓取網頁元素時，應優先使用標準的 Schema.org 屬性（如 `[itemprop="author"]`, `[itemprop="publisher"]`），並搭配多種備用選擇器（Fallback Selectors）。
*   **資料清理**：在取得 DOM 內的文字進行比對前，必須統一執行 `.trim()` 清除前後空白與換行。

## 2. UI / UX 設計與非干擾原則
*   **不干擾原有體驗 (Non-intrusive)**：這個小幫手的主要目標是輔助，必須盡量不要干擾原有頁面的功能與閱讀體驗。例如：標示黑名單時，將「書名變淡並加上刪除線」，遠比「整塊區域變暗」來得好。整塊變暗不僅視覺過於干擾，也可能阻礙使用者操作原本的頁面功能。
*   **緊湊的版面配置 (Compact Layout)**：列表類型的 UI 必須保持緊湊。透過消除多餘的 `padding` (例如 `padding: 0`) 並設定合適的 `line-height` 或 `min-height` 來節省空間。
*   **直覺的互動設計**：所有的文字輸入框（Input），都必須預設綁定 `Enter` 鍵觸發送出/新增功能，不能只依賴點擊按鈕。
*   **色彩與圖示**：偏好較柔和的色彩（例如使用 `#f06a4d` 而非刺眼的純紅色）；在不需複雜圖片的情況下，善用 Emoji（如 ✅, 🗑️, 🗑️, ⚙️）作為輕量級的 UI 圖示。

## 3. 程式碼品質與格式
*   **Trailing Spaces**：所有檔案嚴禁保留行尾多餘空白（Trailing spaces）。請在提交前確認清理乾淨。

## 4. Git 與協作流程 (Review 階段的 Stage 策略)
*   **首次大功能提交**：大功能初步實作完成後，應直接將所有變更放入 Stage（`git add .`）。這能方便開發人員明確看出新增或刪除了哪些檔案，而不會被 Untracked 檔案混淆。
*   **後續微調提交**：在核心功能已 Stage 的情況下，根據開發人員回饋進行的後續微調或修正，**不應**立即放入 Stage。這樣能讓開發人員使用 `git diff` 清楚觀察到這一次的微調到底改了哪些具體的程式碼，方便進行增量審視。

## 5. 擴充功能效能與安全 (Performance & Security)
*   **記憶體快取 (In-memory Caching)**：為了避免在頻繁變動的網頁（如動態捲動列表）中產生過高的效能開銷，應將 `chrome.storage` 的資料快取在腳本的全域變數中。在進行 DOM 比對時，優先使用快取資料。
*   **實時同步 (Real-time Sync)**：利用 `chrome.storage.onChanged` 監聽設定變動。這樣當使用者在選項頁面修改設定時，已開啟的分頁能立即反應，無需重新整理頁面。
*   **安全文字處理**：插入使用者定義的內容（如黑名單名稱）時，**嚴禁**使用 `.innerHTML`。必須使用 `.textContent` 或 `.innerText` 以徹底杜絕 XSS 攻擊風險。
*   **腳本生命週期管理**：在呼叫 `chrome.*` API 前，應檢查 `chrome.runtime?.id` 是否存在。這能有效防止因擴充功能更新或重載導致「Extension context invalidated」的錯誤。
*   **Debounce 機制**：處理動態網頁變動（MutationObserver）時，必須搭配至少 300ms 的 `setTimeout` (Debounce)，避免短時間內執行過多次昂貴的 DOM 掃描與比對。

## 6. 高階架構模式 (Advanced Patterns)
*   **側邊欄導覽佈局 (Sidebar Navigation)**：當設定項超過 3 個類別時，應改採側邊欄導覽。側邊欄應包含「即時計數泡泡」，主區域則應保留最大寬度以利多行備註輸入。
*   **佈局穩定性優先 (Layout Stability First)**：
    *   在處理如出版社標題等複雜 DOM 時，**嚴禁搬移或替換節點**。
    *   應優先在父容器加上標記類別（如 `.teh-blacklisted-text`），並利用 CSS 背景色或偽元素進行視覺處理，以 100% 維持原網頁的佈局順序。
*   **向下相容的資料遷移 (Data Migration)**：當儲存格式從簡單類型（如 String）演進為複雜類型（如 Object）時，必須在 `options.js` 與 `content.js` 中實作 `migrateData` 函數，確保舊版資料在載入時能自動無痛轉換。
*   **跨分頁狀態同步**：應全面利用 `chrome.storage.onChanged` 達成設定頁面與內容劇本間的實時連動。包含計數器更新與視覺樣式切換，均應在不重新整理頁面的前提下完成。

## 7. 測試與驗證 (Testing & Verification)
為了確保後續開發不影響現有功能，應定期使用以下 URL 進行回歸測試：

*   **書籍詳情頁 (價格試算與黑名單)**:
    *   URL: `https://readmoo.com/book/210137233000101`
    *   驗證重點：確認是否正確注入「75折 vs 領書點數」資訊；確認出版社與作者名字是否正確打 X（若在黑名單中）。
*   **出版社頁面 (大標題打 X)**:
    *   URL: `https://readmoo.com/publisher/982` (以「獨步文化」為例)
    *   驗證重點：確認頂部的大大的出版社名稱是否能正確排除「關注」按鈕文字並打上紅 X。
*   **通用書籍列表 (書名變淡)**:
    *   URL: `https://readmoo.com/category/1/2?sort=latest` (新書上市)
    *   驗證重點：確認列表模式 (List) 與網格模式 (Grid) 下，黑名單內的書名是否會變淡且帶有刪除線。
*   **黑名單管理頁面 (Options)**:
    *   URL: 在 Chrome 擴充功能管理介面點擊「選項」或點擊 popup 齒輪。
    *   驗證重點：確認輸入框 Enter 鍵有效；確認新增/刪除操作能立即反映到已開啟的網頁分頁中。

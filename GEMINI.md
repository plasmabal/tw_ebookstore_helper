# Taiwan Ebookstore Helper 專案開發規範與知識庫

這份文件記錄了本專案開發過程中的核心原則與協作規範。本文件亦作為各專項知識的索引。

## 0. 協作與執行規範 (Core Rules)
*   **專項文件管理**：專項文件（如各書商開發細節、工具教學）統一放置於 `docs/` 目錄裡，檔名採小寫。
    *   [Readmoo 開發規範](docs/readmoo.md)
    *   [Agent Browser 使用技巧](docs/agent-browser-tips.md)
*   **AI 主動糾錯**：若使用者指示中存在明顯的邏輯不一致或結構錯誤，AI 助手必須主動向使用者提出並協助修正，而非盲目執行。
*   **Plan Mode 執行原則**：在 Antigravity 中，當 Plan Mode 開啟時，AI 必須獲得使用者的明確行動指示（如 "go", "execute"）後才可以開始動手修改程式碼；否則應以完善計畫或問答交流為主。

## 1. UI / UX 設計與非干擾原則
*   **不干擾原有體驗 (Non-intrusive)**：這個小幫手的主要目標是輔助，必須盡量不要干擾原有頁面的功能與閱讀體驗。例如：標示黑名單時，將「書名變淡並加上刪除線」，遠比「整塊區域變暗」來得好。
*   **緊湊的版面配置 (Compact Layout)**：列表類型的 UI 必須保持緊湊。透過消除多餘的 `padding` (例如 `padding: 0`) 並設定合適的 `line-height` 或 `min-height` 來節省空間。
*   **直覺的互動設計**：所有的文字輸入框（Input），都必須預設綁定 `Enter` 鍵觸發送出/新增功能。
*   **色彩與圖示**：偏好較柔和的色彩（例如使用 `#f06a4d`）；在不需複雜圖片的情況下，善用 Emoji 作為輕量級 UI 圖示。

## 2. 程式碼品質與格式
*   **Trailing Spaces**：所有檔案嚴禁保留行尾多餘空白（Trailing spaces）。請在提交前確認清理乾淨。

## 3. Git 與協作流程 (Review 階段的 Stage 策略)
*   **首次大功能提交**：大功能初步實作完成後，應直接將所有變更放入 Stage (`git add .`)。
*   **後續微調提交**：在核心功能已 Stage 的情況下，後續的微調或修正**不應**立即放入 Stage，以便開發人員使用 `git diff` 進行增量審視。

## 4. 擴充功能效能與安全 (Performance & Security)
*   **記憶體快取 (In-memory Caching)**：優先使用全域變數快取資料，避免頻繁呼叫 `chrome.storage`。
*   **實時同步 (Real-time Sync)**：利用 `chrome.storage.onChanged` 達成跨分頁即時連動。
*   **安全文字處理**：插入使用者內容時，**嚴禁**使用 `.innerHTML`。必須使用 `.textContent` 或 `.innerText`。
*   **腳本生命週期管理**：呼叫 `chrome.*` API 前應檢查 `chrome.runtime?.id` 是否存在。
*   **Debounce 機制**：處理動態網頁變動時，必須搭配至少 300ms 的 Debounce。

## 5. 高階架構模式 (Advanced Patterns)
*   **側邊欄導覽佈局 (Sidebar Navigation)**：當設定項超過 3 個類別時，應改採側邊欄導覽。
*   **佈局穩定性優先 (Layout Stability First)**：嚴禁搬移或替換原網頁節點。優先利用標記類別與 CSS 偽元素進行視覺處理。
*   **向下相容的資料遷移 (Data Migration)**：儲存格式演進時，必須實作 `migrateData` 函數。
*   **分層作用域原則 (Layered Scoping Principle)**：
    *   **主體標題劃線**：範圍必須嚴格鎖定在該書的資訊區塊（如 `.book-detail-info`）。
    *   **全域元資料標記**：作者、出版社名字的標記可擴及全網頁（含推薦區）。

## 6. 發布與圖示規範 (Publishing & Icons)
*   **圖示要求**：商店圖示必須為完美的 `128x128` 正方形。
*   **母圖管理**：以 `icons/icon_new.png` 為基準。
*   **重新生成流程**：使用 ImageMagick 進行去背、裁切與加邊，並生成四種標準尺寸。

---
> **💡 自動化測試知識庫**：關於本專案的 E2E 測試架構，請參閱 [docs/Extension_Testing_Patterns.md](docs/Extension_Testing_Patterns.md)。

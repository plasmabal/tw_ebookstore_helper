# Readmoo 讀墨開發規範與技術細節

本文件專門記錄 Readmoo 站點的 DOM 解析策略、可靠選擇器以及回歸測試路徑。

## 1. 網頁 DOM 解析策略
*   **高容錯的選擇器**：Readmoo 的網頁結構與 URL 格式會變動（如 `/search/contributor/` vs `/contributor/`）。在抓取網頁元素時，應優先使用標準的 Schema.org 屬性（如 `[itemprop="author"]`, `[itemprop="publisher"]`），並搭配多種備用選擇器（Fallback Selectors）。
*   **以實測 DOM 為準**：AI 輔助工具可能回傳虛構或過時的類名（如 `.book-header`）。定義選擇器時必須以 Chrome DevTools 實際觀察到的 DOM 結構為準。
*   **資料清理**：在取得 DOM 內的文字進行比對前，必須統一執行 `.trim()` 清除前後空白與換行。

## 2. 可靠選擇器清單 (實測驗證)
*   **書籍詳情資訊容器**：`.book-detail-info`
*   **書籍元數據 (出版日期、定價等)**：`.book-metadata`
*   **書籍標題**：`h1` (位於 `.book-detail-info` 內)
*   **作者/出版社連結**：`[itemprop="author"]`, `[itemprop="publisher"]`
*   **電子書售價**：`.price-buy`, `.price-selling`

## 3. 測試與驗證 (Regression Testing)
為了確保後續開發不影響現有功能，應定期使用以下 URL 進行回歸測試：

*   **書籍詳情頁 (價格試算與黑名單)**:
    *   URL: `https://readmoo.com/book/210471110000101`
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

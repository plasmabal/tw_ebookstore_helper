# Agent Browser 開發技巧指南

本文件記錄了如何利用 `agent-browser` 提升開發效率、查詢 DOM 元素以及進行自動化測試的技巧。

## 1. 快速 DOM 查詢與分析
在開發過程中，可以使用 `agent-browser` 快速獲取網頁結構，而不需要手動打開 DevTools：

*   **獲取無障礙樹 (Accessibility Tree)**：
    ```bash
    agent-browser snapshot -i
    ```
    這會產生一個帶有編號（如 `@e1`, `@e2`）的精簡結構，非常適合用來快速定位目標元素。

*   **執行自定義 JavaScript 提取資料**：
    ```bash
    agent-browser eval "() => document.querySelector('.target-class').innerText"
    ```

## 2. 處理動態與延遲載入內容
Readmoo 等網站常有捲動載入的模組，可使用以下組合：

```bash
agent-browser scroll down 1000
agent-browser snapshot -i
```

## 3. 視覺化驗證與錄製
當需要確認擴充功能的注入效果時，可以使用錄製功能：

```bash
agent-browser record start debug_session.webm
# 執行操作...
agent-browser record stop
```

## 4. 環境診斷
如果工具運作異常（例如連不上 Chrome），請執行：
```bash
agent-browser doctor --fix
```

## 5. 實戰建議
- **避免幻想**：如果懷疑 AI 提供的選擇器是幻想的，直接要求它使用 `agent-browser get html` 獲取真實的 DOM 片段。
- **穩定的引用**：在一次會話中，`@eN` 的編號是穩定的，可以用來連續執行 `click`, `fill`, `get text` 等操作。

# Kobo TW 開發規範

## 網站概覽

- **域名**：`www.kobo.com`（台灣站路徑：`/tw/zh/...`）
- **偵測**：`host === "kobo.com"`
- **目標**：僅支援台灣站（`/tw/zh/`），其他語系站不在當前範圍內。

## 支援功能

| 功能 | 支援 |
|------|------|
| 黑名單 (作者) | ✅ 書籍頁 / 搜尋頁 |
| 黑名單 (出版社) | ❌ Kobo 不提供出版社連結 |
| 白名單 (作者) | ✅ 書籍頁 / 搜尋頁 |
| 書名打叉 (teh-blacklisted-title) | ✅ 書籍頁 |
| 價格試算 | ❌ 無 getPriceInfo |

## 頁面模式與選擇器

### 書籍詳情頁 (`/tw/zh/ebook/XXXXX`)

容器：`.primary-left-container`

```js
selector: '.primary-left-container',
elements: (b) => ({
  publishers: [],
  authors: Array.from(b.querySelectorAll('.visible-contributors a.contributor-name')),
  title: b.querySelector('h1.title')
})
```

### 搜尋頁 / 列表頁 (`/tw/zh/search?query=...`)

容器：`[data-ratunit="item"]`

```js
selector: '[data-ratunit="item"]',
elements: (b) => ({
  publishers: [],
  authors: Array.from(b.querySelectorAll('[data-testid="authors"] a[data-testid="book-attribute-link"]')),
  title: b.querySelector('a[data-testid="title"]')
})
```

## 已知限制

- **出版社不標記**：Kobo 頁面不提供出版社連結，`publishers` 固定為空陣列。
- **作者頁不存在**：Kobo 的作者連結會導向搜尋頁（`/tw/zh/search?contributor=...`），沒有獨立的作者詳情頁。

## 測試 URL

| 用途 | URL |
|------|-----|
| 優良作者 (布蘭登．山德森) - 書籍頁 | https://www.kobo.com/tw/zh/ebook/QNNMWo57eDWTP0YfThPf4w |
| 黑名單作者 (九把刀) - 書籍頁 | https://www.kobo.com/tw/zh/ebook/w3UfB3BDfT2PS3bHS1fYzA |
| 黑名單作者 (九把刀) - 搜尋頁 | https://www.kobo.com/tw/zh/search?query=九把刀 |

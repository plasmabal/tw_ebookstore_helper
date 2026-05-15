# 博客來 (books.com.tw) 開發規範

## 網站概覽

- **域名**：`www.books.com.tw`、`search.books.com.tw`
- **偵測**：`host.includes("books.com.tw")`
- **注意**：博客來受 Cloudflare WAF 保護，自動化測試無法通過，需手動驗證。

## 支援功能

| 功能 | 支援 |
|------|------|
| 黑名單 (作者) | ✅ 書籍頁 / 列表頁* |
| 黑名單 (出版社) | ✅ 書籍頁 / 列表頁* |
| 白名單 (作者) | ✅ 書籍頁 / 列表頁* |
| 白名單 (出版社) | ✅ 書籍頁 / 列表頁* |
| 書名打叉 (teh-blacklisted-title) | ✅ 書籍頁 |
| 價格試算 | ❌ 博客來無 getPriceInfo |

*列表頁僅作者可標記（有連結），出版社在搜尋頁無連結，無法標記。

## 頁面模式與選擇器

### 書籍詳情頁 (`/products/XXXXXXXXXX`)

容器：`.type02_p01_wrap`（包含書名 h1、作者連結、出版社連結）

```js
selector: '.type02_p01_wrap',
elements: (b) => ({
  publishers: Array.from(b.querySelectorAll('a[href*="?pubid="]')),
  authors: Array.from(b.querySelectorAll('a[href*="adv_author/1"]')),
  title: b.querySelector('h1')
})
```

- **作者連結格式**：`https://search.books.com.tw/search/query/key/作者名/adv_author/1/`
- **出版社連結格式**：`https://www.books.com.tw/web/sys_puballb/books/?pubid=XXXXX`

### 列表頁 / 搜尋頁 (`search.books.com.tw`)

容器：`.table-td`（真正的搜尋結果項目）

> ⚠️ **注意**：頁面上同時存在 `li.item`，但那是左側**分類過濾**標籤（電子書、兒童館…），不是書籍結果，切勿混用。

```js
selector: '.table-td',
elements: (b) => ({
  publishers: Array.from(b.querySelectorAll('a[href*="?pubid="]')),
  authors: Array.from(b.querySelectorAll('a[href*="adv_author/1"]')),
  title: b.querySelector('h4 a')
})
```

- 作者連結格式：`//search.books.com.tw/search/query/cat/all/v/1/adv_author/1/key/作者名`
- 出版社連結在搜尋頁不存在，`publishers` 固定回空陣列

## 手動驗證用 URL

| 用途 | URL |
|------|-----|
| 黑名單作者 (九把刀) | https://www.books.com.tw/products/0010336891 |
| 優良作者 (布蘭登．山德森) | https://www.books.com.tw/products/0010979566 |

## Cloudflare WAF 說明

博客來對爬蟲有嚴格的防護：
- 連續多個請求會被 403 封鎖
- `search.books.com.tw` 的搜尋結果採 lazy loading，Puppeteer 無法取得完整 DOM
- 自動化 E2E 測試暫不可行，測試案例以 `test.skip` 保留供未來參考

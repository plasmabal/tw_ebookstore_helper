# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 知識庫文件（修改前必讀）

為了確保專案的一致性與高品質，請在進行任何程式碼修改或測試前，務必優先閱讀並遵循以下文件：

1. **核心開發規範**：`GEMINI.md` — DOM 解析策略、UI/UX 原則、Git 流程、XSS 防範要求。
2. **功能規格**：`docs/FEATURES.md` — 每項功能的預期行為，**修改或重構前務必對照**，避免誤刪功能。**有功能新增、變更或移除時，必須同步更新此文件，確保內容隨時反映現實狀況。**
   **Commit 前亦須檢查 `CHANGES.md` 是否需要更新**，凡使用者可感知的功能異動（新增、變更、修正）都應記錄於 `[Upcoming Version]` 區段。
3. **自動化測試知識庫**：`docs/Extension_Testing_Patterns.md` — Puppeteer + Jest E2E 測試策略。
4. **執行測試 (Skill)**：若需執行測試，請參考 `.cursor/rules/run_test.mdc`。
5. **Code Review (Skill)**：使用 `/project-code-review` 指令審查目前 staged 變更，輸出繁體中文 markdown 報告（含安全性、正確性、Chrome Extension 特有問題）。
6. **Commit (Skill)**：使用 `/project-commit` 指令取代手動 `git commit`。會自動依序確認 CHANGES.md（使用者可感知的變動）、docs/FEATURES.md（功能規格變動）、unit test 完整性，三項通過後才執行 commit。

## 常用指令

```bash
npm test                                        # 執行所有測試
npx jest --testPathPatterns="wishlist"          # 執行特定測試檔
npx jest --testPathPatterns="wishlist" --no-coverage  # 執行但不產生 coverage 報告
npm run build                                   # 打包 extension（產出 zip）
```

測試使用真實 Chromium + Extension，需要有網路連線（Readmoo、Kobo 的 E2E 測試會連線至真實網站）。博客來測試因 Cloudflare WAF 全部 skip。

## 架構概覽

這是一個 Manifest V3 Chrome Extension，**無 bundler、無 framework**，所有 JS 直接載入。

```
manifest.json          # 宣告 content scripts、permissions、options page
sites.js               # 各平台 site config（偵測、選擇器、getPriceInfo）→ 定義 window.TEH
content.js             # 主要 content script，注入所有 UI 功能
management.js/html     # Options page（黑白名單 CRUD、Tag 管理、備份還原）
popup.js/html          # 點擊 extension icon 的小視窗
```

**資料流**：`chrome.storage.sync` ↔ `content.js` cachedLists ↔ DOM 注入  
**跨頁同步**：`chrome.storage.onChanged` 讓已開啟的分頁即時更新  
**跨裝置同步**：所有資料存於 `chrome.storage.sync`，同一 Chrome 帳號的多台裝置自動同步

**Storage schema（v0.2.0）**：
- `publisherBlacklist / authorBlacklist / publisherWhitelist / authorWhitelist`：`[{ name, note, tags[] }]`
- `wishlistRemarks`：`{ bookId: string }`
- `wishlistTags`：`{ bookId: string[] }`
- `schemaVersion`：`"0.2.0"`
- `localToSyncMigrated`（`chrome.storage.local`）：一次性遷移標記，標示該裝置已完成 local → sync 搬移

## 測試注意事項

- Extension ID（hardcoded 於所有測試）：`mmmgehlnhopcejokbbdjblejkkbbahek`
- Wishlist fixture 測試用 `page.evaluate(code)` 注入 content.js（繞過 MV3 CSP），**不可**改用 `page.addScriptTag({ path })`
- 注入前需先設定 `window.TEH` mock，否則 content.js IIFE 會提早 return

---
name: project-release
description: 執行完整 release 流程：更新版號、CHANGES.md、build、commit、push、建立 GitHub Release，並顯示 Chrome Web Store 上傳提醒與設定檢查清單。
---

# project-release

將目前的 Upcoming Version 正式發布為新版本。

## 呼叫方式

`/project-release` — 互動式引導完成完整 release 流程。

## 執行流程

### Step 1 — 確認目前狀態

```bash
git status
git log --oneline -5
```

若工作樹有未 commit 的修改，提醒使用者先處理（commit 或 stash），停止流程。

讀取以下資訊：
- `manifest.json` → 目前版號
- `CHANGES.md` → `[Upcoming Version]` 區段內容

若 `[Upcoming Version]` 區段沒有任何實質內容（Added / Changed / Fixed 都空），詢問使用者是否確定要繼續發布。

### Step 2 — 確認新版號

根據 `[Upcoming Version]` 的內容建議下一個版號（遵循 SemVer）：
- 有破壞性變更 → 升 minor（0.x.0）
- 僅新增功能或修正 → 升 minor（目前專案慣例）

提示使用者確認版號，或輸入自訂版號。以下以 `X.Y.Z` 代指確認後的版號，`TODAY` 代指今日日期（YYYY-MM-DD）。

### Step 3 — 更新版號與 CHANGES.md

同步更新三個檔案：

**manifest.json**：
```json
"version": "X.Y.Z"
```

**package.json**：
```json
"version": "X.Y.Z"
```

**CHANGES.md**：
1. 將 `## [Upcoming Version]` 替換為 `## [X.Y.Z] - TODAY`
2. 在其上方插入新的空白 `[Upcoming Version]` 區塊：

```markdown
## [Upcoming Version]
### Added

### Changed

### Fixed

```

### Step 4 — Build

```bash
npm run build
```

確認輸出包含 `release.zip created successfully`。若 build 失敗，停止流程並顯示錯誤。

### Step 5 — Commit & Push

Stage 以下檔案：
```bash
git add manifest.json package.json CHANGES.md
```

Commit message 固定格式（`MODEL_NAME` 替換為執行本 skill 時實際使用的 model，例如 `Claude Sonnet 4.6`）：
```
chore: release X.Y.Z

Co-Authored-By: MODEL_NAME <noreply@anthropic.com>
```

接著 push：
```bash
git push
```

### Step 6 — 建立 GitHub Release

從 `CHANGES.md` 的 `## [X.Y.Z]` 區段擷取 release notes，執行：

```bash
gh release create vX.Y.Z release.zip --title "vX.Y.Z" --notes "<release notes>"
```

### Step 7 — 顯示後續提醒

完成後輸出以下訊息：

---

**Release vX.Y.Z 完成！**

**Chrome Web Store 上傳步驟：**

1. 前往 [Chrome Web Store 開發者後台](https://chrome.google.com/webstore/devconsole)
2. 選擇 **Taiwan Ebookstore Helper**
3. 點選左側 **版本 > 套件**
4. 點選右上角 **上傳新套件**，選取 `release.zip`
5. 填寫版本說明（可貼上 release notes）
6. 送審

**本版是否需要額外 Chrome Web Store 設定？請對照以下清單：**

| 變動類型 | 需要額外設定 |
|----------|------------|
| 新增 `permissions`（如 `tabs`、`cookies`）| ✅ 在 CWS 後台「隱私權慣例」頁面更新已宣告的權限用途說明 |
| 新增 `host_permissions`（新網域）| ✅ 在 CWS 後台「說明」頁面更新支援的網站列表；若新增廣泛網域（如 `*://*/*`）需額外說明理由 |
| 新增遠端請求（fetch 外部 API）| ✅ 確認隱私權政策已涵蓋資料傳輸說明 |
| 新增 `content_scripts` 匹配規則 | ✅ 更新說明頁的功能描述，說明新支援的網站 |
| 移除功能或縮減權限 | ✅ 更新 CWS 說明，避免描述與實際功能不符 |
| 僅功能新增／Bug 修正（無上述變動）| ❌ 無需額外設定，直接上傳套件送審即可 |

---

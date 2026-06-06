---
name: project-commit
description: 提交前自動檢查：更新 CHANGES.md（使用者可感知的功能變動）、docs/FEATURES.md（功能規格變動），並確認有對應的 unit test，三項通過後撰寫 commit log 並 commit。
---

# project-commit

對目前 staged 的修改執行三項檢查，確認文件完整後再 commit。

## 呼叫方式

`/project-commit` — 檢查 staged 變更，依序完成文件更新與確認後 commit。

## 執行流程

### Step 0 — 取得 diff

```bash
git diff --cached
git status
```

若 staged 為空，提示使用者先 `git add` 再執行，停止流程。

### Step 1 — 分析修改性質

閱讀 diff，判斷以下三個面向：

- **使用者可感知的變動**：end user 能觀察到的新功能、行為改變、UI 變更、Bug 修正
- **功能規格變動**：功能運作方式有變化，需要更新 `docs/FEATURES.md`
- **無對應 unit test**：有邏輯或功能改動，但 staged 中沒有對應的測試修改

以下類型通常三項都不需要：純文件修改（`.md` 檔、`CLAUDE.md`、skill 檔）、版本號 bump、設定檔調整。

### Step 2 — CHANGES.md（必須完成）

**若有使用者可感知的變動**：

1. 讀取 `CHANGES.md` 的 `[Upcoming Version]` 區段，確認現有內容
2. 以使用者角度（非技術細節）撰寫一到兩句描述，加入對應小節（`Added / Changed / Fixed`）
3. 更新 `CHANGES.md`，並告知寫了什麼

**若無法判斷**：詢問使用者「這次修改是否有使用者可感知的功能異動？」

**若確認無使用者可感知的變動**：略過此步，繼續。

### Step 3 — docs/FEATURES.md（必須完成）

**若有功能規格變動**：

1. 讀取 `docs/FEATURES.md` 的相關章節
2. 更新或新增規格說明（詳細，供日後開發參照）
3. 告知更新了哪一節

**若無法判斷**：詢問使用者「這次修改是否改變了任何功能的規格或行為？」

**若確認無功能規格變動**：略過此步，繼續。

### Step 4 — Unit Test 確認（可豁免）

**若 diff 包含邏輯或功能改動，但 staged 中沒有對應測試修改**：

詢問使用者：

> 這次修改包含 [簡述邏輯改動]，但 staged 中沒有對應的 unit test 修改。要略過，還是先補測試？

- 使用者說略過 → 繼續
- 使用者說補測試 → 等補完並 `git add` 後繼續（或由你撰寫）
- 使用者已明確指示略過 unit test → 直接繼續，不詢問

**若無邏輯/功能改動**（如純文件修改）：略過此步，繼續。

### Step 5 — Commit

Step 2–4 完成後：

1. 將 `CHANGES.md`、`docs/FEATURES.md` 加入 staged（若有更新）：
   ```bash
   git add CHANGES.md docs/FEATURES.md
   ```
2. 讀取 `git log --oneline -5` 確認 commit message 風格
3. 撰寫 commit message：
   - 格式：`type: 簡短描述（繁體中文）`
   - 必要時加 body 補充說明
   - 結尾加 `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
4. 執行 commit

## 各變動類型判斷基準

| 變動類型 | CHANGES.md | FEATURES.md | 需要測試 |
|----------|:----------:|:-----------:|:-------:|
| 新功能 | ✅ | ✅ | ✅ |
| Bug 修正 | ✅ | 視情況 | ✅ |
| 行為改變 | ✅ | ✅ | ✅ |
| 重構（行為不變） | ❌ | ❌ | 視情況 |
| 純文件修改 | ❌ | ❌ | ❌ |
| 測試修改 | ❌ | ❌ | N/A |
| 設定／CI 修改 | ❌ | ❌ | ❌ |
| Skill／CLAUDE.md 修改 | ❌ | ❌ | ❌ |

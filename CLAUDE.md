# Taiwan Ebookstore Helper 指南 (Claude Code)

歡迎使用 Claude Code！為了確保專案的一致性與高品質，請在進行任何程式碼修改或測試前，務必優先閱讀並遵循以下知識庫文件：

1. **核心開發規範**：請閱讀 `GEMINI.md`。這是本專案的最高指導原則，包含了 DOM 解析策略、UI/UX 原則、Git 流程以及防範 XSS 的安全要求。
2. **自動化測試知識庫**：請閱讀 `docs/Extension_Testing_Patterns.md`。裡面詳細記錄了專案如何使用 Puppeteer + Jest 進行 E2E 測試、無頭資料注入策略，以及如何避免 Flaky Tests。
3. **執行測試 (Skill)**：若需要執行測試，請參考 `.cursor/rules/run_test.mdc` 的流程。

請確保所有建議與修改均符合上述文件中的規範。

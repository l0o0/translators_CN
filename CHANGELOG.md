# 更新日志 (CHANGELOG)

本文件记录本仓库中由 [@Daxoel](https://github.com/4965898) 开发维护的翻译器更新历史。

## 2026-08-18

### 翻译器现代化重构

根据 [PR #939](https://github.com/l0o0/translators_CN/pull/939) 中维护者的审阅意见，对以下翻译器进行了全面现代化重构：

- **移除已废弃的 FW 框架依赖**（Wikimedia Commons.js）
- **将 `var` 声明现代化为 `const`/`let`**
- **移除 `ZU.processDocuments`、`ZU.doGet` 等旧 API**，改用现代 Promise API（`requestJSON`、`requestText`、`requestDocument`、`processDocuments`）
- **修正 creator 字段**（CNBKSY V2.js 的 creator 由 jiaojiaodubai 修正为 Daxoel）

涉及文件：

| 文件 | 主要变更 |
|------|---------|
| [CADAL.js](./CADAL.js) | var→const/let，改用 `requestDocument`/`Z.selectItems`，creator 修正 |
| [CNBKSY V2.js](./CNBKSY%20V2.js) | var→const/let，改用现代 API，creator 修正为 Daxoel |
| [China National Library - Republic Era.js](./China%20National%20Library%20-%20Republic%20Era.js) | var→const/let，改用 `processDocuments`/`Z.selectItems`，creator 修正 |
| [China National Library - Modern Newspaper Database.js](./China%20National%20Library%20-%20Modern%20Newspaper%20Database.js) | var→const/let，改用 `Z.selectItems`，creator 修正 |
| [ShuKui.js](./ShuKui.js) | var→const/let，改用 `processDocuments`/`Z.selectItems`，creator 修正 |
| [Wikimedia Commons.js](./Wikimedia%20Commons.js) | 移除 FW 框架，重写为原生 DOM/API 解析，var→const/let，改用 `requestJSON`/`requestText`，creator 修正 |

### Wikimedia Commons.js 功能增强

- 重写 `getWikitext`：使用 `requestJSON`（现代 API），失败时回退到 `requestText`
- 重写 `scrapeBookFromDOM`：使用 `fileinfotpl_*` ID 直接提取元数据，不再依赖文本匹配
- 支持 `{{Book}}`/`{{Information}}` 模板解析，提取标题、作者、出版社、出版地、日期、ISBN、版次、页数、DOI 等完整元数据
- 支持 PDF/DjVu 附件，特别支持超星爬取的中文民国书籍与古籍

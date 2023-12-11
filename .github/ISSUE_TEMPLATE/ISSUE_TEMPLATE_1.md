---
name: 报告翻译器错误❌
about: 报告你使用翻译器遇到的异常
---

**你遇到了什么问题？** [必填]
- [ ] 无法识别条目
- [ ] 无法保存条目
- [ ] 无法下载附件
- [x] 缺少字段、字段错误
- [ ] 其他

**发生问题的链接** [必填]
[在此填写链接](https://www.cnki.net/)

**问题描述** [必填]
如：“作者”字段没有分开。

**你的预期结果**
如：“作者”名字应该分开。

**浏览器**

- [ ] Chrome（谷歌浏览器）
- [ ] FireFox（火狐浏览器）
- [x] Edge
- [ ] Safari
- [ ] 其他

**自查清单**
- [x] 我已经按照[教程](https://zotero-chinese.com/user-guide/faqs/update-translators.html)将翻译器更新到最新版
- [ ] 我尝试过重启浏览器、Zotero或电脑
- [ ] 我使用VPN访问
- [ ] 我使用校园网直接访问
- [ ] 我在海外访问

**附件**
如Connector报错记录（建议粘贴代码格式）：
![Connector的报错记录](https://picss.sunbangyan.cn/2023/12/05/428125effd2c72d84f558329b4dbcc36.jpeg)

```shell
[JavaScript Error: "No title specified for item
Error: No title specified for item
    at Object._itemDone (chrome-extension://nmhdhpibnnopknkmonacoephklnflpho/translate/translation/translate.js:609:32)
    at Object._itemDone (chrome-extension://nmhdhpibnnopknkmonacoephklnflpho/inject/sandboxManager.js:89:17)
    at Zotero.Item.complete (eval at <anonymous> (chrome-extension://nmhdhpibnnopknkmonacoephklnflpho/inject/sandboxManager.js:63:4), <anonymous>:1:306)
    at scrape (eval at <anonymous> (chrome-extension://nmhdhpibnnopknkmonacoephklnflpho/inject/sandboxManager.js:63:4), <anonymous>:353:12)
    at async doWeb (eval at <anonymous> (chrome-extension://nmhdhpibnnopknkmonacoephklnflpho/inject/sandboxManager.js:63:4), <anonymous>:215:4)" {file: "[object Object]"}]
```

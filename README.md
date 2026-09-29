# Zotero translators 中文仓库

目前 Zotero 中有许多抓取中文学术网站的转换器，但这些转换器有些已经非常老旧，缺少及时的维护。希望能在这里召集一些志同道合的朋友，共同维护中文学术或其他类型网站的 Zotero 转换器。
如果 Github 下载速度慢，可以试试 [Gitee](https://gitee.com/l0o0/translators_CN)。

## 📢 如何更新

👉 视频教程：[Zotero 更新知网Translator翻译器教程 - Bilibili](https://www.bilibili.com/video/BV1F54y1k73n)
👉 图文教程：[Zotero 百科全书](https://zotero-chinese.com/user-guide/faqs/update-translators.html)
👉 完整讨论：[从浏览器保存条目时发生错误 / 抓取时不能自动下载PDF / 无法自动给添加的PDF附件创建条目怎么办](https://gitee.com/zotero-chinese/zotero-chinese/issues/I56D62)

如果完成以上操作后仍未解决问题，请发布 issue 反馈问题：

- [Github 反馈入口](https://github.com/l0o0/translators_CN/issues/new/choose)（首选）
- [Gitee 反馈入口](https://gitee.com/l0o0/translators_CN/issues/new)（备用）

## 📄 参与贡献

在开始创建前，浏览下面这些材料可以帮你了解一些创建 translator 的基本知识和开发的工具。

- [Zotero 文档教你写 translator](https://www.zotero.org/support/dev/translators/coding)
- [Zotero JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api)
- [Translator 中可能用到的函数](https://www.zotero.org/support/dev/translators/functions)
- [Wiki-Create translator](https://www.mediawiki.org/wiki/Citoid/Creating_Zotero_translators)，了解基本HTML结构，CSS选择器，javascript基本语法等
- [refworks 引文格式](./data/refworks.pdf)，有些学术网站可以将引文导出为 refworks 格式
- [Scaffold 使用说明](https://www.zotero.org/support/dev/translators/scaffold)，官方出品，便于创建 translator 的工具
- [MDN Javascript 中文教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/A_re-introduction_to_JavaScript)
- [Zotero 条目类型说明](https://aurimasv.github.io/z2csl/typeMap.xml)
- [How to write a Zotero translator](https://niche-canada.org/member-projects/zotero-guide/about.html)

## 🦸 其他热心参与者

[@jiaojiaodubai](https://github.com/jiaojiaodubai)
[@wanyzh](https://github.com/wanyzh)  
[@smilevent](https://github.com/smilevent)  
[@Lemmingh](https://github.com/Lemmingh)  
[@Captain2021 (啊哈船长)](https://github.com/Captain2021)  
[道格学社](https://github.com/gezhongran/DougSociety)及学员[Felix](https://github.com/xuwd)、[018](https://github.com/018)

## 🎈问题交流

如果有问题的，可以加QQ群 913637964，一起交流。

---

## 📚 本仓库新增翻译器（@Daxoel）

以下翻译器由 [@Daxoel](https://github.com/4965898) 开发并维护，均已按 Zotero 现代规范编写（使用 `const`/`let`、现代 Promise API，不使用已废弃的 FW 框架与 `ZU.processDocuments` 等旧 API）。

| 翻译器 | 抓取网站 | 说明 |
|--------|---------|------|
| [CADAL.js](./CADAL.js) | [CADAL 大学数字图书馆](https://cadal.edu.cn) | 抓取图书/学位论文/标准/期刊/会议/专利详情页与搜索结果，支持多类型条目 |
| [CNBKSY V2.js](./CNBKSY%20V2.js) | [中国近代报刊数据库 V2](https://www.cnbksy.com/v2) | 抓取期刊文章/报纸文章详情页与搜索结果，支持 PDF 附件 |
| [China National Library - Republic Era.js](./China%20National%20Library%20-%20Republic%20Era.js) | [国家图书馆民国文献](https://read.nlc.cn) | 抓取民国图书详情页与搜索结果，中文作者单字段保存 |
| [China National Library - Modern Newspaper Database.js](./China%20National%20Library%20-%20Modern%20Newspaper%20Database.js) | [中国历史文献总库·近代报纸数据库](https://bz-nlcpress-com-s-*.ycfw.library.hb.cn) | 抓取近代报纸篇目与报纸信息，支持 PDF 附件 |
| [ShuKui.js](./ShuKui.js) | [书葵网](https://www.shukui.net) | 抓取图书详情页与搜索结果，支持封面图片与 MD5/文件大小信息 |
| [Wikimedia Commons.js](./Wikimedia%20Commons.js) | [Wikimedia Commons](https://commons.wikimedia.org) | 解析图书文件页（`{{Book}}`/`{{Information}}` 模板）与搜索/画廊，支持 PDF/DjVu 附件；特别支持超星爬取的中文民国书籍与古籍 |

### 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

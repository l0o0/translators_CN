# Zotero translators 中文维护小组  

目前 Zotero 中有许多抓取中文学术网站的插件，这些插件有些已经非常老旧，缺少及时的维护。希望能在这里召集一些志同道合的朋友，共同维护中文学术或其他类型网站的抓取插件维护。

## 🎯 目标网站

+ [知网](https://cnki.net/) -> [CNKI.js](./translators/CNKI.js)  
  - [x] 默认保存网页快照  
  - [x] 下载PDF或CAJ文件，学位论文默认保存CAJ 
  - [x] 修改旧版本将知网导出`refworks`中`CN`字段保存为期刊条目中的 `call number`，修改后`CN`字段不保留
  - [x] 修改了拉取知网`refworks`格式引文的网址，新网址提供的摘要字数最多为500字
+ [万方数据](http://www.wanfangdata.com.cn/index.html)
+ [维普](http://www.cqvip.com/)  
+ [百度学术](http://xueshu.baidu.com/) 
+ [Bilibili 视频网站](https://www.bilibili.com/)



## 📄 相关材料  

在开始创建前，浏览下面这些材料可以帮你了解一些创建 translator 的基本知识和开发的工具。

+ [Zotero 文档教你写 translator](https://www.zotero.org/support/dev/translators/coding)  
+ [Zotero JavaScript API](https://www.zotero.org/support/dev/client_coding/javascript_api)  
+ [Translator 中可能用到的函数](https://www.zotero.org/support/dev/translators/functions)  
+ [Wiki-Create translator](https://www.mediawiki.org/wiki/Citoid/Creating_Zotero_translators)，了解基本HTML结构，CSS选择器，javascript基本语法等
+ [refworks 引文格式](https://www.refworks.com/refworks/help/refworks_tagged_format.htm)，有些学术网站可以将引文导出为 refworks 格式
+ [Scaffold 使用说明](https://www.zotero.org/support/dev/translators/scaffold)，官方出品，便于创建 translator 的工具
+ [MDN Javascript 中文教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/A_re-introduction_to_JavaScript)  
+ [Zotero 条目类型说明](https://aurimasv.github.io/z2csl/typeMap.xml)

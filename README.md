# Zotero translators 中文维护小组  

目前 Zotero 中有许多抓取中文学术网站的插件，这些插件有些已经非常老旧，缺少及时的维护。希望能在这里召集一些志同道合的朋友，共同维护中文学术或其他类型网站的抓取插件。

## 🎯 目标网站

+ [知网或知网海外](https://cnki.net/) -> [CNKI.js](./translators/CNKI.js)  
  - [x] 默认保存网页快照  
  - [x] 文章格式都为PDF，学位论文的CAJ链接已经替换为PDF，注意学位论文的PDF应该是没有目录信息的。如果想要下载CAJ格式的学位论文，将`CNKI.js`中两处`keepPDF`改为`false`
  - [x] 修改旧版本将知网导出`refworks`中`CN`字段保存为期刊条目中的 `call number`，修改后`CN`字段不保留
  - [x] 修改了拉取知网`refworks`格式引文的网址，新网址提供的摘要字数最多为500字
  - [x] 知网海外版PDF和CAJ附件下载支持  
  - [x] 支持文献类型：期刊，学位论文，会议论文，报纸
  - [ ] 已同步到官方版本库中
+ [万方数据](http://www.wanfangdata.com.cn/index.html) -> [WanFang.js](./translators/WanFang.js) ❗
  - [x] 抓取引文信息  
  - [x] 支持文献类型：期刊，学位论文，专利，会议论文
  - [ ] PDF附件下载
+ [维普](http://www.cqvip.com/) -> [WeiPu.js](./translators/WeiPu.js) ❗
  - [x] 抓取引文信息  
  - [x] 支持文献类型：期刊
  - [ ] PDF附件下载
+ [百度学术](http://xueshu.baidu.com/) -> [Baidu Scholar.js](./translators/Baidu&#32;Scholar.js)
  - [x] 修复抓取图书时错误
  - [x] 修复中文作者姓，名问题
+ [Bilibili 视频网站](https://www.bilibili.com/) -> [BiliBili.js](./translators/BiliBili.js)
  - [x] 视频页抓取信息，包括Up主，标签，上传日期，视频选集
  - [x] 搜索页面信息抓取，包括Up主，上传日期，标题，抓取信息比较少
+ [谷粉学术-谷歌学术](https://gfsoso.99lb.net/) -> [GFSOSO.js](./translators/GFSOSO.js)
  - [x] 修改了网页匹配，识别抓取代码抄自Google Scholar。从搜索结果页识别搜索结果，引文信息正常
  - [ ] 部分文献的PDF下载可能会有问题，谷粉搜搜上可能没有相应的下载链接
  - 安装Adblock插件的朋友请注意下将谷粉学术`*.glgoo.top`添加到白名单，不然可能会出现问题
+ [专利搜索网站Soopat](http://www.soopat.com/) -> [Snnopat.js](./translators/Soopat.js)
  - [x] 搜索页面和单个专利页面信息抓取
  - [x] PDF附件下载（需要登录，网站验证码可能会导致PDF下载失败）



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


## 🎈问题交流

如果有问题的，可以加群 913637964，一起交流。
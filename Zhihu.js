{
	"translatorID": "b06ddb30-55db-49dd-b550-4eb63d184277",
	"label": "Zhihu",
	"creator": "Lin Xingzhong",
	"target": "^https?://(zhuanlan|www)\\.zhihu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-04-03 06:43:09"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Lin Xingzhong
	
	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

var urlHash = {
	article: 'https://www.zhihu.com/api/v4/articles/',
	answer: 'https://www.zhihu.com/api/v4/answers/'
};


// p for article, answer for answer
function getIDFromUrl(url) {
	let m = url.match(/\/(answer|p)\/(\d+)/);
	if (!m) return false;
	return { ztype: m[1] === 'p' ? 'article' : 'answer', zid: m[2], url: url };
}

function detectWeb(doc, url) {
	let ZID = getIDFromUrl(url);
	// Z.debug(ZID);
	if (ZID) {
		return ZID.ztype === 'answer' ? 'forumPost' : 'blogPost';
	}
	else if (url.includes("search?type=")
		|| url.includes("/collection/")
		|| url.includes("/people/")
		|| getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly, itemInfo) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.ArticleItem,.AnswerItem');
	for (let i = 0; i < rows.length; i++) {
		let data = rows[i].getAttribute('data-zop');
		let url, ZID, title;
		if (!data) { // 搜索页面
			url = rows[i].querySelector("h2 a").getAttribute('href').replace(/^\/\//, 'https://');
			if (url.startsWith('/')) url = "https://zhihu.com" + url;
			ZID = getIDFromUrl(url);
			title = i + ' ' + text(rows[i], "h2 a span");
		}
		else { // 问题页,首页,专栏
			data = JSON.parse(data);
			url = rows[i].querySelectorAll("meta[itemprop='url']");
			createTime = rows[i].querySelector("meta[itemprop='dateCreated']");
			url = url[url.length - 1].getAttribute('content').replace(/^\/\//, 'https://');
			ZID = { ztype: data.type, zid: data.itemId, url: url };
			title = i + ' ' + data.authorName + ' : ' + data.title + `${createTime ? " 创建于:" + createTime.content.slice(0, 19).replace("T", " ") : ""}`;
		}
		if (checkOnly) return true;
		found = true;
		itemInfo[url] = ZID;
		items[url] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		let selectedItems = await Zotero.selectItems(getSearchResults(doc, false, itemInfo));
		await Promise.all(
			Object.keys(selectedItems).map(url => {
				scrape(doc, itemInfo[url]);
			}
			)
		);
	}
	else {
		var ZID = getIDFromUrl(url);
		await scrape(doc, ZID);
	}
}

async function scrape(doc, ZID) {
	var { ztype, zid, url } = ZID;
	var newItem = new Zotero.Item(ztype === 'answer' ? 'forumPost' : 'blogPost');
	newItem.url = url;
	if (ztype === 'answer') {  // For Zhihu answer
		let html = await requestDocument(url);
		newItem.postType = '知乎回答';
		newItem.forumTitle = '知乎';
		newItem.title = html.title.replace(" - 知乎", '');
		let noteContent = ZU.xpath(html, "//div[@class='RichContent-inner']//span")[0].innerHTML;
		noteContent = noteContent.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, "<img src='$1'/>");
		newItem.abstractNote = ZU.cleanTags(noteContent).slice(0, 150) + "...";
		newItem.notes.push({ note: noteContent });
		newItem.date = ZU.xpathText(html, "//span[@data-tooltip]").split(' ').slice(1).join(" ");
		newItem.websiteType = '知乎回答';
		let authorMatch = innerText(html, "div.AuthorInfo-head a");
		newItem.creators.push({ lastName: authorMatch ? authorMatch : '匿名用户', createType: 'author' });
		if (ZU.xpath(html, "//meta[@itemprop='keywords']")) {
			ZU.xpath(html, "//meta[@itemprop='keywords']")[0].content.split(",").forEach(t => newItem.tags.push({ tag: t }));
		}
		let vote = html.querySelector("button.Button.VoteButton.VoteButton--up").innerText.match("[0-9]+$");
		if (vote) newItem.extra = `赞数:${vote[0]}`;
	} else {  // For Zhihu blog post
		newItem.postType = '知乎专栏';
		let targetUrl = urlHash[ztype] + zid;
		var textJson = await requestJSON(targetUrl);
		newItem.title = textJson.title ? textJson.title : textJson.question.title;
		newItem.abstractNote = textJson.share_text.replace(/ [（(]想看更多.*$/, '');
		let createdTime = textJson.created ? textJson.created : textJson.created_time;
		newItem.date = new Date(createdTime * 1000).toISOString();
		newItem.websiteType = "知乎专栏文章";
		newItem.blogTitle = textJson.column ? textJson.column.title : '回答';
		let content = textJson.content.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, "<img src='$1'/>");
		content = content.replace(/<sup.*?data-text="(.*?)".*?data-url="(.*?)".*?>\[(\d+)\]<\/sup>/g, '<sup><a title="$1" href="$2">[$3]</a></sup>');
		content = "<h1>正文详情</h1>" + content;
		newItem.creators.push({ lastName: textJson.author.name, creatorType: "author" });
		newItem.notes.push({ note: content });
		if (textJson.topics) {
			textJson.topics.forEach(t => newItem.tags.push({ tag: t.name }));
		}
		newItem.extra = `赞数:${textJson.voteup_count};`;
		// optimal DOM for zhuanlan post 
		optimalDOM(doc);
	}
	newItem.language = 'zh-CN';
	newItem.attachments.push({title: 'Snapshot', document: doc});
	newItem.complete();
}


//Loop to delete the node
function _delElem(elems) {
  while (elems[0] != undefined) {
    let parent = elems[0].parentElement
    parent.removeChild(elems[0])
  }
}

// Define delete function
function delElemByClassName(doc, className) {
  let elems = doc.getElementsByClassName(className)
  _delElem(elems)
}

function load_lazy(doc) {
  // Page scrolling speed (the time required to scroll through one screen height, the shorter the time, the faster).
  // If there is slow internet speed, fast scrolling, and lazy loading images cannot be fully displayed, increase this number to try.
  let scrollInterval = 100
  let scrollHeight = doc.documentElement.scrollHeight
  let clientHeight = doc.documentElement.clientHeight
  let lastHeight = 0
  let task = setInterval(function () {
    if (lastHeight < scrollHeight) {
      window.scrollTo(lastHeight, lastHeight + clientHeight)
      lastHeight += clientHeight
    } else {
      clearInterval(task)
			// After loading the image, delete the <noscript> tag.
			let elems = doc.getElementsByTagName("noscript")
			_delElem(elems)
			
    }
  }, scrollInterval)
}

// Remove tag elements
function delElemByTagName(doc, tagName) {
  let noscriptElements = doc.getElementsByTagName(tagName)
  for (var i = 0; i < noscriptElements.length; i++) {
    var noscriptElement = noscriptElements[i];
    noscriptElement.parentNode.removeChild(noscriptElement);
  }
}

function beautifyHtml(doc) {
	var cssCode = `
		/* Insert your CSS code here */
		.Post-RichTextContainer {
			width: 690px !important;
			margin: 0 auto !important;
		}
		
		.ContentItem-time {
			width: 690px !important;
			margin: 0 auto !important;
		}
		
		.Post-Main, .Post-Sub {
			width: 690px !important;
			margin: 0 auto !important;
		}
	`;

	var styleElement = document.createElement('style');
	styleElement.innerHTML = cssCode;

	doc.head.insertAdjacentElement('beforeend', styleElement);
}


function optimalDOM(doc) {
  // Remove the top status bar.
	delElemByClassName(doc, "ColumnPageHeader-Wrapper")
	// Delete top image
	delElemByClassName(doc, "css-78p1r9")
	// Delete follow button
	delElemByClassName(doc, "FollowButton")
	// Delete the left directory.
	delElemByClassName(doc, "Catalog")
	// Remove bottom share.
	delElemByClassName(doc, "Sticky")
	// Delete return to top.
	delElemByClassName(doc, "CornerButtons")
	// Delete recommended reading
	delElemByClassName(doc, "Recommendations-Main")
	// Delete column
	delElemByClassName(doc, "PostIndex-Contributions")
	// Remove appreciation
	delElemByClassName(doc, "Reward")
	// Delete topic
	delElemByClassName(doc, "Post-topicsAndReviewer")
	// beautify html
	beautifyHtml(doc)
	// Delete comment.
	// delElemByClassName(doc, "Post-Sub Post-NormalSub")
  // Scroll the page, load images
  load_lazy(doc)
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://zhuanlan.zhihu.com/p/351547307",
		"items": [
			{
				"itemType": "blogPost",
				"title": "Zotero CNKI翻译器更新(适合在家使用知网)-20210207",
				"creators": [
					{
						"lastName": "l0o0",
						"creatorType": "author"
					}
				],
				"date": "2021-02-19T15:04:50.000Z",
				"abstractNote": "Zotero CNKI翻译器更新(适合在家使用知网)-20210207 - 来自知乎专栏「闲时弄斧」，作者: l0o0 https://zhuanlan.zhihu.com/p/351547307",
				"blogTitle": "闲时弄斧",
				"extra": "赞数:17;",
				"language": "zh-CN",
				"url": "https://zhuanlan.zhihu.com/p/351547307",
				"websiteType": "知乎专栏文章",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [
					{
						"tag": "Zotero"
					},
					{
						"tag": "知网"
					}
				],
				"notes": [
					{
						"note": "<h1>正文详情</h1><p data-pid=\"ie_wjLoK\">在春节前上班的最后几天，我更新了知网翻译器的匹配格式，初衷是为了同学们更方便地在家使用 Zotero 抓取知网上的信息。在此之前我也尝试过一些方法</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://zhuanlan.zhihu.com/p/111857132\" class=\"internal\"><span class=\"invisible\">https://</span><span class=\"visible\">zhuanlan.zhihu.com/p/11</span><span class=\"invisible\">1857132</span><span class=\"ellipsis\"></span></a><p data-pid=\"CIraXM20\">比如用 Zotero 的代理设置对 URL 网址进行重定向或者利用 <a href=\"https://link.zhihu.com/?target=http%3A//fsso.cnki.net\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">http://</span><span class=\"visible\">fsso.cnki.net</span><span class=\"invisible\"></span></a> 达到在校园网使用知网的效果。后面也遇到一些同学的反馈，比如 Zotero 的代理对知网抓取的 API 造成影响，也有一些同学的学校没有在 <a href=\"https://link.zhihu.com/?target=http%3A//fsso.cnki.net\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">http://</span><span class=\"visible\">fsso.cnki.net</span><span class=\"invisible\"></span></a> 的列表上。</p><p data-pid=\"dhH3lqOQ\">其实我也试过其他的一些方法，感觉还是直接修改翻译器的网址匹配是最简单的。只要把知网翻译器的网址匹配处理得当，在使用上是不需要做额外的设置的，当然前提是要登录学校的 VPN 代理。</p><p data-pid=\"dDNionZq\">在群里，大家也帮我收集了各自学校 VPN 代理的网址，我发现还是有一些共同之处。代理后的知网搜索页面和知网文献详情页面都会有一些固定的字符串。利用这些固定字符串，可以实现对知网 URL 的识别。同时我发现，一些像浙江省图书馆，杭州图书馆之类的新版知网代理也是可以实现识别的，可能也满足少部分朋友的需求。</p><h2>1. 翻译器的更新</h2><p data-pid=\"-2vzvCH4\">翻译器的更新，建议是使用 Jasminum 插件来更新</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://zhuanlan.zhihu.com/p/290730737\" class=\"internal\"><span class=\"invisible\">https://</span><span class=\"visible\">zhuanlan.zhihu.com/p/29</span><span class=\"invisible\">0730737</span><span class=\"ellipsis\"></span></a><p data-pid=\"w_d3t0p-\">当然你也可以到 Github 下载 CNKI.js 文件手动更新，文件和详细地更新过程在下面链接</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//github.com/l0o0/translators_CN\" data-image=\"https://pic4.zhimg.com/v2-46be882ea44e3e504e31572fcfc806d3_ipico.jpg\" data-image-width=\"163\" data-image-height=\"163\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">l0o0/translators_CN</a><p data-pid=\"Df71-dgo\"><b>重要：替换了CNKI.js 文件后，需要更新浏览器的翻译器信息，如果一次不成功，请多更新几次。更新浏览器翻译器的操作步骤，可参考下面这个简陋的视频</b></p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//www.bilibili.com/video/BV1F54y1k73n/\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">https://www.</span><span class=\"visible\">bilibili.com/video/BV1F</span><span class=\"invisible\">54y1k73n/</span><span class=\"ellipsis\"></span></a><p class=\"ztext-empty-paragraph\"><br/></p><h2>2. 功能上的更新</h2><p data-pid=\"vwLlLdAc\">新的知网翻译器添加了文献引用次数的信息，在文献详情页面抓取时，还可以添加中文核心期刊的数据。信息会保存在其他栏目中，格式类似</p><div class=\"highlight\"><pre><code class=\"language-text\">3743 citations(CNKI)[2021-02-19]&lt;北大核心&gt;</code></pre></div><p class=\"ztext-empty-paragraph\"><br/></p><p data-pid=\"aV1qFg2z\">其他使用上的问题，可在下方留言或到 Github 上提 Issue。最近也整理了一个 <a href=\"https://zhuanlan.zhihu.com/p/349871853\" class=\"internal\">林知：Zotero Translator 开发文档</a> ，想一起完善中文翻译器的同学，可以联系我，东西不会可以慢慢学。</p><p data-pid=\"VPZ4rmIH\">如果初识 Zotero 的同学可以看看 <a class=\"member_mention\" href=\"https://www.zhihu.com/people/268c1f41a479e6ee24a9c0969a06e188\" data-hash=\"268c1f41a479e6ee24a9c0969a06e188\" data-hovercard=\"p$b$268c1f41a479e6ee24a9c0969a06e188\">@johnmy</a> 整理的 Zotero 入门 </p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//github.com/redleafnew/Zotero_introduction\" data-image=\"https://pic3.zhimg.com/v2-7e831b9bb399b979306d739025b85e26_ipico.jpg\" data-image-width=\"420\" data-image-height=\"420\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">redleafnew/Zotero_introduction</a><p data-pid=\"4dVGtPWw\">如果你觉得我们的工作对你有帮助，就请帮我们点赞或分享吧</p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/search?type=content&q=Zotero",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/292241691",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/column/c_1218192088992534528",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/533166415/answer/2491983922",
		"items": [
			{
				"itemType": "forumPost",
				"title": "请问各路大神，在zotero里面打开PDF版硕士/博士论文，是不显示目录的，有没有插件可以显示目录？",
				"creators": [
					{
						"lastName": "BeWater",
						"createType": "author"
					}
				],
				"date": "2022-05-19 09:54",
				"abstractNote": "从知网下载的学位论文页数很多，但pdf文件又没有目录，阅读起来比较麻烦。如何解决呢？\n\n\n需要软件\npdftk Server\nhttps://www.pdflabs.com/tools/pdftk-server/\n\n\nZotero茉莉花插件（使用教程）\n\n\n配置\nPdftk Server下载之后，进...",
				"extra": "赞数:21",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/533166415/answer/2491983922",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [
					{
						"tag": "Zotero"
					},
					{
						"tag": "博士"
					},
					{
						"tag": "目录"
					},
					{
						"tag": "硕士"
					},
					{
						"tag": "论文"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"UKDJFsMg\">从知网下载的学位论文页数很多，但pdf文件又没有目录，阅读起来比较麻烦。如何解决呢？</p><h3><br><b>需要软件</b></h3><p data-pid=\"vr0CI1Aq\"><br><b>pdftk Server</b><br><a href=\"https://link.zhihu.com/?target=https%3A//www.pdflabs.com/tools/pdftk-server/\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">https://www.</span><span class=\"visible\">pdflabs.com/tools/pdftk</span><span class=\"invisible\">-server/</span><span class=\"ellipsis\"></span></a></p><p data-pid=\"L-oB97X-\"><br><b>Zotero茉莉花插件</b>（<u><a href=\"https://link.zhihu.com/?target=http%3A//mp.weixin.qq.com/s%3F__biz%3DMzA4OTk0NDA0Nw%3D%3D%26mid%3D2654860337%26idx%3D1%26sn%3Db772974b85fce702ab5c7479de642142%26chksm%3D8bda6eb1bcade7a7deceb493fa05b02faa7ff9ff2b0a19ae8359dcc183f42cb7e8a8748a2cab%26scene%3D21%23wechat_redirect\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">使用教程</a></u>）</p><h3><br><b>配置</b></h3><p data-pid=\"8__GDnxH\"><br>Pdftk Server下载之后，进行安装，记一下<b>安装目录</b>。</p><p data-pid=\"YHWnauRX\"><br>在<b>Zotero &gt; 编辑 &gt; 首选项</b>中选择茉莉花插件，设置 <b>PDFtk Server路径设置</b>，选择刚才的PDftk Server安装目录即可。如果茉莉花成功识别到路径后，后面会出现对勾的标志。<br></p><img src='https://pic1.zhimg.com/50/v2-34c7b9d8b30518976d14007959fbcdd9_720w.jpg?source=1940ef5c'/><p data-pid=\"CI1ZlS2h\">配置成功后，关闭Zotero重启即可。</p><h3><br><b>使用</b></h3><p data-pid=\"5Mlvsiya\"><br>再次打开Zotero，选择一篇中文文献的pdf文件，右键选择<b>知网助手</b> 即可看到 <b>添加PDF书签</b> 功能，即可完成对PDF文件目录的生成。<br></p><img src='https://picx.zhimg.com/50/v2-4cd7c60863432698508867ab8b4489e5_720w.jpg?source=1940ef5c'/><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"IkDW0yya\">推一下自己的文章</p><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/514025295\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"be water：Zotero中文文献那些事\" class=\"LinkCard new\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"jKjL9Ofe\">更多文献管理的内容可以关注专栏</p><a target=\"_blank\" href=\"https://www.zhihu.com/column/c_1447680839576842240\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-image=\"https://pic2.zhimg.com/v2-52a669542a8699d42a3c5796c7e536e9_ipico.jpg\" data-image-width=\"200\" data-image-height=\"200\" data-text=\"文献管理\" class=\"LinkCard new\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a><p></p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/440729199/answer/1702311609",
		"items": [
			{
				"itemType": "forumPost",
				"title": "深度学习领域，你心目中 idea 最惊艳的论文是哪篇？",
				"creators": [
					{
						"lastName": "邱锡鹏",
						"createType": "author"
					}
				],
				"date": "2021-01-28 13:09",
				"abstractNote": "大家都提到了ResNet、Transformer、GAN、BERT等，虽然他们很成功，但说到惊艳，我个人认为Memory Networks更胜一筹，读后拓展了我对机器学习模型的认知，也逼得DeepMind几天后就赶快放出了Neural Turing Machines。\n\n\n\n...",
				"extra": "赞数:446",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/440729199/answer/1702311609",
				"attachments": [
					{
						"title": "Snapshot"
					}
				],
				"tags": [
					{
						"tag": "学术论文"
					},
					{
						"tag": "强化学习 (Reinforcement Learning)"
					},
					{
						"tag": "深度学习（Deep Learning）"
					},
					{
						"tag": "自然语言处理"
					},
					{
						"tag": "计算机视觉"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"nLec8XPy\">大家都提到了ResNet、Transformer、GAN、BERT等，虽然他们很成功，但说到惊艳，我个人认为Memory Networks更胜一筹，读后拓展了我对机器学习模型的认知，也逼得DeepMind几天后就赶快放出了Neural Turing Machines。</p><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/1410.3916\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Memory Networks\" class=\"LinkCard new\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a><p></p>"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

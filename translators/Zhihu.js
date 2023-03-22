{
	"translatorID": "b06ddb30-55db-49dd-b550-4eb63d184277",
	"label": "Zhihu",
	"creator": "Lin Xingzhong",
	"target": "https?://(zhuanlan|www)\\.zhihu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-03-22 14:57:25"
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
			title = i + ' ' + rows[i].querySelector("h2 a span").textContent;
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

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var itemInfo = {};
		Zotero.selectItems(getSearchResults(doc, false, itemInfo), function (selectedItems) {
			var ZIDs = [];
			for (let url in selectedItems) {
				ZIDs.push(itemInfo[url]);
			}
			scrape(ZIDs);
		});
	}
	else {
		var ZID = getIDFromUrl(url);
		scrape([ZID]);
	}
}

function scrape(ZIDs) {
	if (!ZIDs.length) return false;
	var { ztype, zid, url } = ZIDs.shift();
	let targetUrl = urlHash[ztype] + zid;
	if (ztype === 'answer') targetUrl = url;
	ZU.doGet(targetUrl, function (text) {
		var newItem = new Zotero.Item(ztype === 'answer' ? 'forumPost' : 'blogPost');
		newItem.url = url;
		if (ztype === 'answer') {  // For Zhihu answer
			newItem.postType = '知乎回答';
			newItem.forumTitle = '知乎';
			let author = '匿名用户';
			let parser = new DOMParser();
			let html = parser.parseFromString(text, 'text/html');
			newItem.title = html.title.replace(" - 知乎", '');
			let noteContent = ZU.xpath(html, "//div[@class='RichContent-inner']//span")[0].innerHTML;
			noteContent = noteContent.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, "<img src='$1'/>");
			newItem.abstractNote = ZU.cleanTags(noteContent).slice(0, 150) + "...";
			newItem.notes.push({ note: noteContent });
			newItem.date = ZU.xpath(html, "//span[@data-tooltip]")[0].innerText.split(' ').slice(1).join(" ");
			newItem.websiteType = '知乎回答';
			let authorMatch = ZU.xpath(html, "//div[@class='AuthorInfo-head']//a");
			if (authorMatch)  author = authorMatch[0].innerText;
			newItem.creators.push({lastName: author, createType: 'author'});
			if (ZU.xpath(html, "//meta[@itemprop='keywords']")) {
				ZU.xpath(html, "//meta[@itemprop='keywords']")[0].content.split(",").forEach(t => newItem.tags.push({ tag: t }));
			}
			let vote = html.querySelector("button.Button.VoteButton.VoteButton--up").innerText.match("[0-9]+$");
			if (vote) newItem.extra = `赞数:${vote[0]}`;
		} else {  // For Zhihu blog post
			newItem.postType = '知乎专栏';
			var textJson = JSON.parse(text);
			// Z.debug(text);
			newItem.title = textJson.title ? textJson.title : textJson.question.title;
			newItem.abstractNote = textJson.share_text.replace(/ [（(]想看更多.*$/, '');
			let createdTime = textJson.created ? textJson.created : textJson.created_time;
			newItem.date = new Date(createdTime * 1000).toLocaleString();
			newItem.websiteType = "知乎专栏文章";
			newItem.blogTitle = textJson.column ? textJson.column.title : '回答';
			let content = textJson.content.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, "<img src='$1'/>");
			content = content.replace(/<sup.*?data-text="(.*?)".*?data-url="(.*?)".*?>\[(\d+)\]<\/sup>/g, '<sup><a title="$1" href="$2">[$3]</a></sup>');
			content = "<p><h1>正文详情</h1></p>" + content;
			newItem.creators.push({ lastName: textJson.author.name, creatorType: "author" });
			newItem.notes.push({ note: content });
			if (textJson.topics) {
				textJson.topics.forEach(t => newItem.tags.push({ tag: t.name }));
			}
			newItem.extra = `赞数:${textJson.voteup_count};`;
		}
		newItem.language = 'zh-CN';
		newItem.attachments.push({ url: url, title: "Snapshot" });
		newItem.complete();
		if (ZIDs.length > 0) {
			scrape(ZIDs);
		}
	});
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
				"date": "2021/2/19 下午11:04:50",
				"abstractNote": "Zotero CNKI翻译器更新(适合在家使用知网)-20210207 - 来自知乎专栏「闲时弄斧」，作者: l0o0 https://zhuanlan.zhihu.com/p/351547307",
				"blogTitle": "闲时弄斧",
				"extra": "赞数:16;",
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
						"note": "<p><h1>正文详情</h1></p><p data-pid=\"ie_wjLoK\">在春节前上班的最后几天，我更新了知网翻译器的匹配格式，初衷是为了同学们更方便地在家使用 Zotero 抓取知网上的信息。在此之前我也尝试过一些方法</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://zhuanlan.zhihu.com/p/111857132\" class=\"internal\"><span class=\"invisible\">https://</span><span class=\"visible\">zhuanlan.zhihu.com/p/11</span><span class=\"invisible\">1857132</span><span class=\"ellipsis\"></span></a><p data-pid=\"CIraXM20\">比如用 Zotero 的代理设置对 URL 网址进行重定向或者利用 <a href=\"https://link.zhihu.com/?target=http%3A//fsso.cnki.net\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">http://</span><span class=\"visible\">fsso.cnki.net</span><span class=\"invisible\"></span></a> 达到在校园网使用知网的效果。后面也遇到一些同学的反馈，比如 Zotero 的代理对知网抓取的 API 造成影响，也有一些同学的学校没有在 <a href=\"https://link.zhihu.com/?target=http%3A//fsso.cnki.net\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">http://</span><span class=\"visible\">fsso.cnki.net</span><span class=\"invisible\"></span></a> 的列表上。</p><p data-pid=\"dhH3lqOQ\">其实我也试过其他的一些方法，感觉还是直接修改翻译器的网址匹配是最简单的。只要把知网翻译器的网址匹配处理得当，在使用上是不需要做额外的设置的，当然前提是要登录学校的 VPN 代理。</p><p data-pid=\"dDNionZq\">在群里，大家也帮我收集了各自学校 VPN 代理的网址，我发现还是有一些共同之处。代理后的知网搜索页面和知网文献详情页面都会有一些固定的字符串。利用这些固定字符串，可以实现对知网 URL 的识别。同时我发现，一些像浙江省图书馆，杭州图书馆之类的新版知网代理也是可以实现识别的，可能也满足少部分朋友的需求。</p><h2>1. 翻译器的更新</h2><p data-pid=\"-2vzvCH4\">翻译器的更新，建议是使用 Jasminum 插件来更新</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://zhuanlan.zhihu.com/p/290730737\" class=\"internal\"><span class=\"invisible\">https://</span><span class=\"visible\">zhuanlan.zhihu.com/p/29</span><span class=\"invisible\">0730737</span><span class=\"ellipsis\"></span></a><p data-pid=\"w_d3t0p-\">当然你也可以到 Github 下载 CNKI.js 文件手动更新，文件和详细地更新过程在下面链接</p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//github.com/l0o0/translators_CN\" data-image=\"https://pic4.zhimg.com/v2-46be882ea44e3e504e31572fcfc806d3_ipico.jpg\" data-image-width=\"163\" data-image-height=\"163\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">l0o0/translators_CN</a><p data-pid=\"Df71-dgo\"><b>重要：替换了CNKI.js 文件后，需要更新浏览器的翻译器信息，如果一次不成功，请多更新几次。更新浏览器翻译器的操作步骤，可参考下面这个简陋的视频</b></p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//www.bilibili.com/video/BV1F54y1k73n/\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">https://www.</span><span class=\"visible\">bilibili.com/video/BV1F</span><span class=\"invisible\">54y1k73n/</span><span class=\"ellipsis\"></span></a><p class=\"ztext-empty-paragraph\"><br/></p><h2>2. 功能上的更新</h2><p data-pid=\"vwLlLdAc\">新的知网翻译器添加了文献引用次数的信息，在文献详情页面抓取时，还可以添加中文核心期刊的数据。信息会保存在其他栏目中，格式类似</p><div class=\"highlight\"><pre><code class=\"language-text\">3743 citations(CNKI)[2021-02-19]&lt;北大核心&gt;</code></pre></div><p class=\"ztext-empty-paragraph\"><br/></p><p data-pid=\"aV1qFg2z\">其他使用上的问题，可在下方留言或到 Github 上提 Issue。最近也整理了一个 <a href=\"https://zhuanlan.zhihu.com/p/349871853\" class=\"internal\">林知：Zotero Translator 开发文档</a> ，想一起完善中文翻译器的同学，可以联系我，东西不会可以慢慢学。</p><p data-pid=\"VPZ4rmIH\">如果初识 Zotero 的同学可以看看 <a class=\"member_mention\" href=\"https://www.zhihu.com/people/268c1f41a479e6ee24a9c0969a06e188\" data-hash=\"268c1f41a479e6ee24a9c0969a06e188\" data-hovercard=\"p$b$268c1f41a479e6ee24a9c0969a06e188\">@johnmy</a> 整理的 Zotero 入门 </p><a data-draft-node=\"block\" data-draft-type=\"link-card\" href=\"https://link.zhihu.com/?target=https%3A//github.com/redleafnew/Zotero_introduction\" data-image=\"https://pic3.zhimg.com/v2-7e831b9bb399b979306d739025b85e26_ipico.jpg\" data-image-width=\"420\" data-image-height=\"420\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">redleafnew/Zotero_introduction</a><p data-pid=\"4dVGtPWw\">如果你觉得我们的工作对你有帮助，就请帮我们点赞或分享吧</p>"
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
	}
]
/** END TEST CASES **/

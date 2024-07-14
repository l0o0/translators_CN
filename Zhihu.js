{
	"translatorID": "b06ddb30-55db-49dd-b550-4eb63d184277",
	"label": "Zhihu",
	"creator": "Lin Xingzhong, jiaojiaodubai",
	"target": "^https?://(zhuanlan|www2?)\\.zhihu\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-07-14 08:59:51"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Lin Xingzhong, 2024 jiaojiaodubai
	
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

function detectWeb(doc, url) {
	// .Card > [role="list"]见于个人主页
	const list = doc.querySelector('#SearchMain [role="list"],.Card > [role="list"]');
	if (list) {
		Z.monitorDOMChanges(list, { childList: true });
	}
	if (url.includes('/answer/')) {
		return 'forumPost';
	}
	else if (url.includes('/p/')) {
		return 'blogPost';
	}
	else if (url.includes('/search?') && !url.includes('type=content')) {
		return false;
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('h2.ContentItem-title a,[itemprop="zhihu:question"] > a');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Zotero.Item(detectWeb(doc, url));
	switch (newItem.itemType) {
		case 'forumPost': {
			newItem.title = innerText(doc, '.QuestionHeader-title');
			newItem.abstractNote = ZU.cleanTags(noteContent).slice(0, 150) + '...';
			newItem.forumTitle = '知乎';
			newItem.postType = '知乎回答';
			newItem.date = ZU.strToISO(innerText(doc, 'span[data-tooltip]'));
			let noteContent = doc.querySelector('div.RichContent-inner span').innerHTML;
			noteContent = noteContent.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, '<img src="$1"/>');
			newItem.notes.push({ note: noteContent });
			break;
		}
		case 'blogPost':
			newItem.title = attr(doc, 'meta[property="og:title"]', 'content');
			newItem.abstractNote = attr(doc, 'meta[name="description"]', 'content');
			newItem.blogTitle = innerText(doc, '.ContentItem-title') || attr(doc, 'meta[prperty="og:site_name"]', 'content');
			newItem.websiteType = "知乎专栏文章";
			newItem.date = ZU.strToISO(innerText(doc, '.ContentItem-time'));
			// optimal DOM for zhuanlan post
			optimalDOM(doc);
			break;
	}
	newItem.url = url;
	newItem.language = 'zh-CN';
	const vote = innerText(doc, '.VoteButton--up').match('[0-9]+$');
	if (vote) newItem.extra = `vote: ${vote[0]}`;
	newItem.creators.push({
		lastName: attr(doc, '.AuthorInfo > meta[itemprop="name"]', 'content'),
		creatorType: 'author',
		fieldMode: 1
	});
	newItem.attachments.push({ url: url, title: 'Snapshot', document: doc });
	attr(doc, 'meta[itemprop="keywords"]', 'content').split(",").forEach(t => newItem.tags.push({ tag: t }));
	newItem.complete();
}


//Loop to delete the node
function _delElem(elems) {
	while (elems[0] != undefined) {
		let parent = elems[0].parentElement;
		parent.removeChild(elems[0]);
	}
}

// Define delete function
function delElemByClassName(doc, className) {
	let elems = doc.getElementsByClassName(className);
	_delElem(elems);
}

function loadLazy(doc) {
	// Page scrolling speed (the time required to scroll through one screen height, the shorter the time, the faster).
	// If there is slow internet speed, fast scrolling, and lazy loading images cannot be fully displayed, increase this number to try.
	let scrollInterval = 100;
	let scrollHeight = doc.documentElement.scrollHeight;
	let clientHeight = doc.documentElement.clientHeight;
	let lastHeight = 0;
	let task = setInterval(function () {
		if (lastHeight < scrollHeight) {
			window.scrollTo(lastHeight, lastHeight + clientHeight);
			lastHeight += clientHeight;
		}
		else {
			clearInterval(task);
			// After loading the image, delete the <noscript> tag.
			let elems = doc.getElementsByTagName("noscript");
			_delElem(elems);
		}
	}, scrollInterval);
}

function beautifyHtml(doc) {
	const cssCode = `
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

	var styleElement = doc.createElement('style');
	styleElement.innerHTML = cssCode;

	doc.head.insertAdjacentElement('beforeend', styleElement);
}


function optimalDOM(doc) {
	// Remove the top status bar.
	delElemByClassName(doc, "ColumnPageHeader-Wrapper");
	// Delete top image
	delElemByClassName(doc, "css-78p1r9");
	// Delete follow button
	delElemByClassName(doc, "FollowButton");
	// Delete the left directory.
	delElemByClassName(doc, "Catalog");
	// Remove bottom share.
	delElemByClassName(doc, "Sticky");
	// Delete return to top.
	delElemByClassName(doc, "CornerButtons");
	// Delete recommended reading
	delElemByClassName(doc, "Recommendations-Main");
	// Delete column
	delElemByClassName(doc, "PostIndex-Contributions");
	// Remove appreciation
	delElemByClassName(doc, "Reward");
	// Delete topic
	delElemByClassName(doc, "Post-topicsAndReviewer");
	// beautify html
	beautifyHtml(doc);
	// Delete comment.
	// delElemByClassName(doc, "Post-Sub Post-NormalSub")
	// Scroll the page, load images
	loadLazy(doc);
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
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-02-19",
				"abstractNote": "在春节前上班的最后几天，我更新了知网翻译器的匹配格式，初衷是为了同学们更方便地在家使用 Zotero 抓取知网上的信息。在此之前我也尝试过一些方法 https://zhuanlan.zhihu.com/p/111857132比如用 Zotero 的代理…",
				"blogTitle": "闲时弄斧",
				"language": "zh-CN",
				"url": "https://zhuanlan.zhihu.com/p/351547307",
				"websiteType": "知乎专栏文章",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/search?type=content&q=Zotero",
		"defer": true,
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
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-05-19",
				"abstractNote": "从知网下载的学位论文页数很多，但pdf文件又没有目录，阅读起来比较麻烦。如何解决呢？\n\n\n需要软件\npdftk Server\nhttps://www.pdflabs.com/tools/pdftk-server/\n\n\nZotero茉莉花插件（使用教程）\n\n\n配置\nPdftk Server下载之后，进...",
				"extra": "vote: 40",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/533166415/answer/2491983922",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
						"note": "<p data-first-child=\"\" data-pid=\"UKDJFsMg\">从知网下载的<span><a class=\"RichContent-EntityWord css-b7erz1\" data-za-not-track-link=\"true\" data-paste-text=\"true\" href=\"https://www.zhihu.com/search?q=%E5%AD%A6%E4%BD%8D%E8%AE%BA%E6%96%87&amp;search_source=Entity&amp;hybrid_search_source=Entity&amp;hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2491983922%7D\" target=\"_blank\">学位论文<svg width=\"10px\" height=\"10px\" viewBox=\"0 0 15 15\" class=\"css-1dvsrp\"><path d=\"M10.89 9.477l3.06 3.059a1 1 0 0 1-1.414 1.414l-3.06-3.06a6 6 0 1 1 1.414-1.414zM6 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z\" fill=\"currentColor\"></path></svg></a></span>页数很多，但pdf文件又没有目录，阅读起来比较麻烦。如何解决呢？</p><h3><br><b>需要软件</b></h3><p data-pid=\"vr0CI1Aq\"><br><b>pdftk Server</b><br><a href=\"https://link.zhihu.com/?target=https%3A//www.pdflabs.com/tools/pdftk-server/\" class=\" external\" target=\"_blank\" rel=\"nofollow noreferrer\"><span class=\"invisible\">https://www.</span><span class=\"visible\">pdflabs.com/tools/pdftk</span><span class=\"invisible\">-server/</span><span class=\"ellipsis\"></span></a></p><p data-pid=\"L-oB97X-\"><br><b>Zotero茉莉花插件</b>（<u><a href=\"https://link.zhihu.com/?target=http%3A//mp.weixin.qq.com/s%3F__biz%3DMzA4OTk0NDA0Nw%3D%3D%26mid%3D2654860337%26idx%3D1%26sn%3Db772974b85fce702ab5c7479de642142%26chksm%3D8bda6eb1bcade7a7deceb493fa05b02faa7ff9ff2b0a19ae8359dcc183f42cb7e8a8748a2cab%26scene%3D21%23wechat_redirect\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">使用教程</a></u>）</p><h3><br><b>配置</b></h3><p data-pid=\"8__GDnxH\"><br>Pdftk Server下载之后，进行安装，记一下<b><span><a class=\"RichContent-EntityWord css-b7erz1\" data-za-not-track-link=\"true\" data-paste-text=\"true\" href=\"https://www.zhihu.com/search?q=%E5%AE%89%E8%A3%85%E7%9B%AE%E5%BD%95&amp;search_source=Entity&amp;hybrid_search_source=Entity&amp;hybrid_search_extra=%7B%22sourceType%22%3A%22answer%22%2C%22sourceId%22%3A2491983922%7D\" target=\"_blank\">安装目录<svg width=\"10px\" height=\"10px\" viewBox=\"0 0 15 15\" class=\"css-1dvsrp\"><path d=\"M10.89 9.477l3.06 3.059a1 1 0 0 1-1.414 1.414l-3.06-3.06a6 6 0 1 1 1.414-1.414zM6 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z\" fill=\"currentColor\"></path></svg></a></span></b>。</p><p data-pid=\"YHWnauRX\"><br>在<b>Zotero &gt; 编辑 &gt; 首选项</b>中选择茉莉花插件，设置 <b>PDFtk Server路径设置</b>，选择刚才的PDftk Server安装目录即可。如果茉莉花成功识别到路径后，后面会出现对勾的标志。<br></p><img src=\"https://picx.zhimg.com/50/v2-34c7b9d8b30518976d14007959fbcdd9_720w.jpg?source=2c26e567\"/><p data-pid=\"CI1ZlS2h\">配置成功后，关闭Zotero重启即可。</p><h3><br><b>使用</b></h3><p data-pid=\"5Mlvsiya\"><br>再次打开Zotero，选择一篇中文文献的pdf文件，右键选择<b>知网助手</b> 即可看到 <b>添加PDF书签</b> 功能，即可完成对PDF文件目录的生成。<br></p><img src=\"https://pica.zhimg.com/50/v2-4cd7c60863432698508867ab8b4489e5_720w.jpg?source=2c26e567\"/><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"IkDW0yya\">推一下自己的文章</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/514025295\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"be water：Zotero中文文献那些事\" class=\"LinkCard new css-1vqsdx1\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"jKjL9Ofe\">更多文献管理的内容可以关注专栏</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://www.zhihu.com/column/c_1447680839576842240\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"文献管理\" class=\"LinkCard new css-1vqsdx1\" data-image=\"https://pic2.zhimg.com/v2-52a669542a8699d42a3c5796c7e536e9_ipico.jpg\" data-image-width=\"200\" data-image-height=\"200\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p></p>"
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
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-01-28",
				"abstractNote": "大家都提到了ResNet、Transformer、GAN、BERT等，虽然他们很成功，但说到惊艳，我个人认为Memory Networks更胜一筹，读后拓展了我对机器学习模型的认知，也逼得DeepMind几天后就赶快放出了Neural Turing Machines。\n\n\n\n...",
				"extra": "vote: 586",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/440729199/answer/1702311609",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
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
						"note": "<p data-first-child=\"\" data-pid=\"nLec8XPy\">大家都提到了ResNet、Transformer、GAN、BERT等，虽然他们很成功，但说到惊艳，我个人认为Memory Networks更胜一筹，读后拓展了我对机器学习模型的认知，也逼得DeepMind几天后就赶快放出了Neural Turing Machines。</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/1410.3916\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Memory Networks\" class=\"LinkCard new css-1vqsdx1\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p></p>"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

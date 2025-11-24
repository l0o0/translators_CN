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
	"lastUpdated": "2025-06-25 06:21:19"
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
	else if (url.includes('/collection/') || url.includes('/column/') || url.includes('/posts') || url.includes('/answers')){
		return 'multiple';
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
	const rows = doc.querySelectorAll('.ArticleItem,.AnswerItem');
	for (const row of rows) {
		const titleElm = row.querySelector('.AnswerItem,.ArticleItem a');
		const data = row.getAttribute('data-zop');
		let href, title;
		if (titleElm) {
			href = titleElm.href;
			title = ZU.trimInternal(titleElm.textContent);
		}
		else if (data) {
			const dataObj = JSON.parse(data);
			href = attr(row, '.ContentItem-meta~[itemprop="url"]', 'content');
			title = dataObj.title + ` - ${dataObj.authorName}的回答`;
		}
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
			// 需要完整的浏览器环境
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
			let noteContent = doc.querySelector('div.RichContent-inner').innerHTML;
			// 图片
			noteContent = noteContent.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, '<img src="$1"/>');
			// 公式
			noteContent = noteContent.replace(/<span class="ztext-math".*?data-tex="(.*?)".*?<\/span><\/span><\/span>/g, '$$$1$');
			// 小卡片链接
			noteContent = noteContent.replace(/<a target="_blank" href="(.*?)".*?data-text="(.*?)".*?<\/a>/gi, '<a href="$1">$2</a>');
			// 去掉知乎直达的链接
			noteContent = noteContent.replace(/<span><a class="RichContent-EntityWord.*?blank">(.*?)<svg.*?<\/span>/g, '$1');
			// 去掉知乎跳转
			noteContent = noteContent.replace(/(https:\/\/link.zhihu.com\/\?target=.*?)([">|<])/g, (match, href, quoteOrDelimiter) => {
				try {
					// 提取 target 参数的值
					const url = new URL(href);
					const target = url.searchParams.get("target");
					if (target) {
						// 解码 target 参数的值
						const decodedTarget = decodeURIComponent(target);
						// 返回解码后的 URL 和原来的分隔符
						return decodedTarget + quoteOrDelimiter;
					} else {
						// 如果没有 target 参数，返回原始匹配
						return match;
					}
				} catch (e) {
					// 如果 href 不是有效的 URL，返回原始匹配
					return match;
				}
			});
			newItem.abstractNote = ZU.cleanTags(noteContent).slice(0, 150) + '...';
			newItem.forumTitle = '知乎';
			newItem.postType = '知乎回答';
			newItem.date = ZU.strToISO(innerText(doc, 'a[data-tooltip]'));
			newItem.notes.push({ note: noteContent });
			break;
		}
		case 'blogPost':
			newItem.title = attr(doc, 'meta[property="og:title"]', 'content');
			let noteContent = doc.querySelector('div.RichText').innerHTML;
			// 图片
			noteContent = noteContent.replace(/<figure.*?<img src="(.*?)".*?<\/figure>/g, '<img src="$1"/>');
			// 公式
			noteContent = noteContent.replace(/<span class="ztext-math".*?data-tex="(.*?)".*?<\/span><\/span><\/span>/g, '$$$1$');
			// 小卡片链接
			noteContent = noteContent.replace(/<a target="_blank" href="(.*?)".*?data-text="(.*?)".*?<\/a>/gi, '<a href="$1">$2</a>');
			// 去掉知乎直达的链接
			noteContent = noteContent.replace(/<span><a class="RichContent-EntityWord.*?blank">(.*?)<svg.*?<\/span>/g, '$1');
			// 去掉知乎跳转
			noteContent = noteContent.replace(/(https:\/\/link.zhihu.com\/\?target=.*?)([">|<])/g, (match, href, quoteOrDelimiter) => {
				try {
					// 提取 target 参数的值
					const url = new URL(href);
					const target = url.searchParams.get("target");
					if (target) {
						// 解码 target 参数的值
						const decodedTarget = decodeURIComponent(target);
						// 返回解码后的 URL 和原来的分隔符
						return decodedTarget + quoteOrDelimiter;
					} else {
						// 如果没有 target 参数，返回原始匹配
						return match;
					}
				} catch (e) {
					// 如果 href 不是有效的 URL，返回原始匹配
					return match;
				}
			});
			newItem.abstractNote = ZU.cleanTags(noteContent).slice(0, 150) + '...';
			newItem.blogTitle = innerText(doc, '.ContentItem-title') || attr(doc, 'meta[prperty="og:site_name"]', 'content');
			newItem.websiteType = "知乎专栏文章";
			newItem.date = ZU.strToISO(innerText(doc, '.ContentItem-time'));
			newItem.notes.push({ note: noteContent });
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
		"url": "https://www.zhihu.com/question/6098306614/answer/64053981531",
		"items": [
			{
				"itemType": "forumPost",
				"title": "2024年，你的科研工作进展如何？有什么心得体会想和大家分享？",
				"creators": [
					{
						"lastName": "浅斟低唱",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-12-26",
				"abstractNote": "写在圣诞节，不在加班而是带的研究生大神加油打call的一个晚上：）\n\n科研工作2024年对我来说过的非常的迅速，一年的工作多数建立在我们2023年的发现，做出了很多理解上的突破，主要还是各位懂技术的大佬们带飞的一年。\n\n除了这三篇中我参与的两个（提供样品和光学电学补充数据, Nature 635, ...",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/6098306614/answer/64053981531",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "博士"
					},
					{
						"tag": "博士后"
					},
					{
						"tag": "学术"
					},
					{
						"tag": "年度盘点"
					},
					{
						"tag": "科研"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"zlNmtRpL\">写在圣诞节，不在加班而是带的研究生大神加油打call的一个晚上：）</p><h2>科研工作</h2><p data-pid=\"JMlruUyA\">2024年对我来说过的非常的迅速，一年的工作多数建立在我们2023年的发现，做出了很多理解上的突破，主要还是各位懂技术的大佬们带飞的一年。</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://www.zhihu.com/question/616351382/answer/3159767665\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"如何评价华盛顿大学西雅图分校最近观测到的零场分数量子反常霍尔效应？\" class=\"LinkCard new css-biylet\" data-image=\"https://picx.zhimg.com/v2-c71d5176a5c96e370f51f231bdc2db1b_180x120.jpg\" data-image-width=\"2056\" data-image-height=\"1148\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/10238579311\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"浅斟低唱：tMoTe2进展\" class=\"LinkCard new css-biylet\" data-image=\"https://pic2.zhimg.com/v2-bd3eac78a87b172f79a054f00f0186cd_180x120.jpg\" data-image-width=\"1706\" data-image-height=\"1278\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"Oeriujvp\">除了这三篇中我参与的两个（提供样品和光学电学补充数据, Nature 635, 584-589, Nature, 635, 590-595），还开始尝试在第二条陈带找FCI，arXiv: 2406.09591 (Nature Physics accepted)。</p><p data-pid=\"9Du-Aa68\">说说物理吧，虽然FQAHE做了出来，虽然还是不能理解FQAHE出现的条件(what is essential)，但是现在开始有点感觉了。Topological flat band和高温超导一样是个难题，但是前者似乎更加\"准1D\"，可能是职业生涯里面能弄清楚的事情。如果我们真的靠tMoTe2/RPG/TBG-BN搞清楚了 what is essential for I/F QAHE in topological flat band，室温QAHE甚至FQAHE 是没有理论局限的。(Fu Bound may be tight, but still can be well above 300K)。 </p><p data-pid=\"PeAFawBx\">和师兄终于把MATBG wrap up了(Nature Materials, 23, 224-229, arXiv: 2408.01599)，暂时可能不会再碰MATBG了，等待同行器件质量突破的契机！！！</p><p data-pid=\"_DSXaVUO\">技术上虽然还是什么也不懂，但是逐渐开始和各方大神学习。CAD，画PCB板，三维建模的技术突飞猛进，感谢GPT/B站。</p><p data-pid=\"BfA3U5H-\">物理上又开始挖掘古老文献了，有什么以前做不了现在能做的深刻物理？又开始看/关注暗物质、重力测量之类的文章的，开始学robotics， AI， space tech。。。</p><h2>毕业</h2><p data-pid=\"0l2D6u__\">24年有一两个月都忙着毕业，交毕业论文，毕业答辩，真麻烦，讨厌繁文缛节，无毕业的兴奋感，只有对未来再也没有现在实验室好资源(好老板)的焦虑和恐慌。。。。</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://www.zhihu.com/question/662719751/answer/3576179144\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"课题组的研究方向是二维材料（物理，光学实验方向），想了解一下有没有特别好的教材或者综述？\" class=\"LinkCard new css-biylet\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><h2>加入MIT</h2><p data-pid=\"d5jm8KuM\">年初收到了MIT Pappalardo Fellow和Princeton Dicke Fellow的offer，各相权衡（主要还是适合自己)来到了MIT(Let's see if it's a good choice or not...)。东边的氛围真的和西边很不一样啊。</p><p data-pid=\"u2OB2XHG\">来了东边和家庭医生initial meet，发现身体素质开始急剧下降，赶紧天天开始锻炼。感谢老婆大人料理好全部家务事，不然搬家、搬技术、重新搭生产力环境能忙两三个月。</p><h2>开展更加独立的工作</h2><p data-pid=\"e4MwJBpH\">一开始我的打算是在MIT单打独斗，做一些以前想做但是没敢做的，超高风险超高回报的事情。等接了MIT的offer，meet了MIT的学生，发现还可以带组里学生一起搞能发文章的、且大家可能更关心的事情。那么计划就变了！</p><p data-pid=\"pkoBxHmq\">在一个新的地方重新establish还是很有意思的，思考了很多以前并没有考量的细节工作，疯狂的给实验室写driver，顺便给我们的measurement software打个广告：</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://github.com/nanophys/MeasureIt/tree/master\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"https://github.com/nanophys/MeasureIt/tree/master\" class=\"LinkCard new css-biylet\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://join.slack.com/t/measureit-workspace/shared_invite/zt-2ws3h3k2q-78XfSUNtqCjSUkydRW2MXA\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Join our slack channel!\" class=\"LinkCard new css-biylet\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><h2>最后给参与过的工作打打广告，欢迎讨论</h2><ol><li data-pid=\"zKCiqB8K\">Cai, Jiaqi.<i>Integer and fractional Chern insulators in two-dimensional van der Waals heterostructures</i>. Diss. University of Washington, 2024.</li><li data-pid=\"qqrOmNPK\">He, Minhao, et al. \"Dynamically tunable moiré exciton Rydberg states in a monolayer semiconductor on twisted bilayer graphene.\"<b><i>Nature Materials </i>23.2 (2024): 224-229.</b></li><li data-pid=\"0SCTw8QA\">Yi, Hemian, et al. \"Interface-induced superconductivity in magnetic topological insulators.\"<b><i>Science </i>383.6683 (2024): 634-639</b>.</li><li data-pid=\"dFVvNe6_\">Shi, Yue, et al. \"Absence of Weyl nodes in EuCd 2 As 2 revealed by the carrier density dependence of the anomalous Hall effect.\"<b><i>Physical Review B </i>109.12 (2024): 125202.</b></li><li data-pid=\"zmlm_fjs\">Liu, Zhaoyu, et al. \"Continuously tunable uniaxial strain control of van der Waals heterostructure devices.\"<b><i>Journal of Applied Physics </i>135.20 (2024).</b></li><li data-pid=\"Qj5j-Zg3\">Thompson, Ellis, et al. \"Visualizing the microscopic origins of topology in twisted molybdenum ditelluride.\"<i>arXiv preprint arXiv:2405.19308</i>(2024).</li><li data-pid=\"5mitDAZE\">Park, Heonjoon, et al. \"Ferromagnetism and Topology of the Higher Flat Band in a Fractional Chern Insulator.\"<i>arXiv preprint arXiv:2406.09591</i>(2024).</li><li data-pid=\"qRskbqcr\">He, Minhao, et al. \"Strongly interacting Hofstadter states in magic-angle twisted bilayer graphene.\"<i>arXiv preprint arXiv:2408.01599</i>(2024).</li><li data-pid=\"IS1jWzQC\">Anderson, Eric, et al. \"Trion sensing of a zero-field composite Fermi liquid.\"<b><i>Nature </i>635.8039 (2024): 590-595.</b></li><li data-pid=\"gB-A0BNV\">Redekop, Evgeny, et al. \"Direct magnetic imaging of fractional Chern insulators in twisted MoTe2.\"<b><i>Nature </i>635.8039 (2024): 584-589.</b></li></ol><p></p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/448277911/answer/1781798505",
		"items": [
			{
				"itemType": "forumPost",
				"title": "大学的微积分、线性代数、概率论，它们的难度怎么样？",
				"creators": [
					{
						"lastName": "杨树森",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-03-15",
				"abstractNote": "在考试比较简单的情况下，微积分最难，因为它涉及到的细节最多。如果忽略考试，仅看大纲范围内的理论，肯定是概率论最难。\n\n很久以前我回答过数学专业本科课程的难度问题，认为概率论是简单的，这很明显是受到了考试难度的影响。然而，概率论里有很多看似简单的东西，其实相当难回答。例如数学期望的定义，仅仅把目光放在...",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/448277911/answer/1781798505",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "微积分"
					},
					{
						"tag": "数学"
					},
					{
						"tag": "概率论与数理统计"
					},
					{
						"tag": "线性代数"
					},
					{
						"tag": "高等数学"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"3RchesI8\">在考试比较简单的情况下，微积分最难，因为它涉及到的细节最多。如果忽略考试，仅看大纲范围内的理论，肯定是概率论最难。</p><p data-pid=\"1MGKwOs0\">很久以前我回答过数学专业本科课程的难度问题，认为概率论是简单的，这很明显是受到了考试难度的影响。然而，概率论里有很多看似简单的东西，其实相当难回答。例如数学期望的定义，仅仅把目光放在离散型和连续性随机变量是不恰当的。</p><p data-pid=\"_2cQrv3t\">在定义了离散型随机变量的期望以后，设<span class=\"math-inline\">X</span>是随机变量，构造<span class=\"math-inline\">\\varepsilon</span><span class=\"ztext-math\" data-eeimg=\"1\" data-tex=\"\\left(\\varepsilon>0\\right)\"><span></span><span><script type=\"math/tex;mode=inline\">\\left(\\varepsilon>0\\right)</script><span class=\"tex2jax_ignore math-holder\">\\left(\\varepsilon&gt;0\\right)</span></span></span> - <b>离散化</b>随机变量</p><p data-pid=\"akwf8Nee\"><span class=\"ztext-math\" data-eeimg=\"1\" data-tex=\"X_\\varepsilon=\\varepsilon\\left\\lfloor\\frac{X}{\\varepsilon}\\right\\rfloor,\"><span></span><span><script type=\"math/tex;mode=inline\">X_\\varepsilon=\\varepsilon\\left\\lfloor\\frac{X}{\\varepsilon}\\right\\rfloor,</script><span class=\"tex2jax_ignore math-holder\">X_\\varepsilon=\\varepsilon\\left\\lfloor\\frac{X}{\\varepsilon}\\right\\rfloor,</span></span></span> </p><p data-pid=\"zovvYraR\">然后将<span class=\"math-inline\">X</span>的期望定义为<span class=\"math-inline\">\\textstyle\\lim_{\\varepsilon\\to 0}E\\left(X_\\varepsilon\\right).</span></p><p data-pid=\"MH9YicWx\">为什么要这么复杂呢？因为确实有很多简单的随机变量不是离散型或连续型的，例如将一个离散型随机变量加上一个连续型随机变量。</p><p data-pid=\"dy1GEJFK\">然后，可以证明当<span class=\"math-inline\">X</span>是连续型随机变量时，记<span class=\"math-inline\">X</span>的概率密度为<span class=\"math-inline\">p\\left(x\\right),</span>则在一定条件下成立</p><p data-pid=\"thZ-YN3n\"><span class=\"ztext-math\" data-eeimg=\"1\" data-tex=\"E\\left(X\\right)=\\int_\\mathbb Rxp\\left(x\\right)\\mathrm dx.\"><span></span><span><script type=\"math/tex;mode=inline\">E\\left(X\\right)=\\int_\\mathbb Rxp\\left(x\\right)\\mathrm dx.</script><span class=\"tex2jax_ignore math-holder\">E\\left(X\\right)=\\int_\\mathbb Rxp\\left(x\\right)\\mathrm dx.</span></span></span> </p><p data-pid=\"c0hclsD_\">另外可以证明有关期望的熟知的性质，而这件事是相当复杂的。期望只是一个例子，本科概率论中有相当多的常用结论看似简单，实际上相当不好证明。更别说还有几乎必然收敛、依概率收敛、依分布收敛和几个大数定律了。</p><p data-pid=\"lQZDk5sj\">我过去认为微积分比线性代数容易，那是因为没有入门多元微积分。首先，想要深入了解多元微积分就必须掌握线性代数；其次，多元微积分中的定理比线性代数难多了。放弃说明多元积分学，仅仅简要说明多元微分学。</p><p data-pid=\"qcY4P6o8\">在多元微分学里，首要的问题是可微性，你应该知道可微性远远比可偏导性严格。然而偏导数连续可以推出可微，这个结论就不太平凡。除此以外，还有反函数定理和隐函数定理。</p><p data-pid=\"ZwGFyf9d\">在一维情形下，函数<span class=\"math-inline\">f\\in C^1</span>在点<span class=\"math-inline\">x_0</span>处存在非零导数，就可以推出<span class=\"math-inline\">f</span>限制在<span class=\"math-inline\">x_0</span>的某一邻域上有反函数，并且它在点<span class=\"math-inline\">f\\left(x_0\\right)</span>处的导数是<span class=\"math-inline\">1/f'\\left(x_0\\right).</span>但是在高维情形下呢？</p><p data-pid=\"TMHuQrPO\">设<span class=\"math-inline\">f\\in C^1</span>是的<span class=\"math-inline\">n</span>元<span class=\"math-inline\">n</span>维向量函数，在点<span class=\"math-inline\">x_0</span>处的 Jacobi 行列式非零，则<span class=\"math-inline\">f</span>限制在<span class=\"math-inline\">x_0</span>的某一邻域上有反函数，并且它在点<span class=\"math-inline\">f\\left(x_0\\right)</span>处的导数是<span class=\"math-inline\">\\left(f'\\left(x_0\\right)\\right)^{-1},</span>也就是<span class=\"math-inline\">f</span>点<span class=\"math-inline\">x_0</span>处的 Jacobi 矩阵的逆。这个定理的证明相当繁琐。</p><p data-pid=\"CNkzH5VC\">隐函数比反函数更困难，因为它是对于一个<span class=\"math-inline\">m+n</span>元<span class=\"math-inline\">m</span>维向量函数<span class=\"math-inline\">F\\in C^1,</span>在一定条件下找到唯一确定的<span class=\"math-inline\">n</span>元<span class=\"math-inline\">m</span>维隐函数<span class=\"math-inline\">f,</span>使得<span class=\"math-inline\">F\\left(x,f\\left(x\\right)\\right)=0.</span>不再多说。</p><p data-pid=\"c_f1TEYq\">所谓线性代数没有那么难，也并非过去想象的那样。入门线性代数的标志是抽象地看待线性空间与线性映射。虽然有限维空间同构于（狭义的）向量空间，但是仅仅依靠向量空间看问题是不够的。</p><p data-pid=\"TnBDbbUl\">本科线性代数的核心在于矩阵的相似标准化，这件事有什么用？矩阵是线性变换在线性空间的基下的表示。两个矩阵相似，标志着它们可以看做是同一个线性变换在不同基下的表示。将矩阵相似标准化，意味着找到线性变换的<b>不依赖具体基下表示</b>的内在性质。</p><p data-pid=\"YGlPxj6O\">只有抽象地看待线性空间，才能彻底跳出基的束缚。所谓<span class=\"math-inline\">V</span>是<span class=\"math-inline\">n</span>维线性空间，并不具备<span class=\"math-inline\">V</span>上的哪个元素的坐标是什么的含义。相应地，子空间和商空间也是抽象的。线性代数看似繁琐，但是抽象的观点将复杂的事物变得简单，是这门课的精髓所在。</p>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/283967816/answer/1785586737",
		"items": [
			{
				"itemType": "forumPost",
				"title": "如何看待全国高中数学教材的内容调整？",
				"creators": [
					{
						"lastName": "Dylaaan",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-03-17",
				"abstractNote": "其实还是有一些合理的地方的，比如删去“几何概型”。\n\n\n\n\n事实上，概率的公理化的定义用到了“测度”。\n\n其中最常用的Lebesgue测度，可以被理解为是图形的面积。\n\n在几何概型中，设 $\\Omega$ 表示样本空间， $A$ 表示一个事件，它们都是 $\\mathbb{R}^n$ 中的Lebesg...",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/283967816/answer/1785586737",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "大学数学课程"
					},
					{
						"tag": "教育"
					},
					{
						"tag": "数学教育"
					},
					{
						"tag": "高中数学"
					},
					{
						"tag": "高考"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"u-vJ6q1p\">其实还是有一些合理的地方的，比如删去“几何概型”。</p><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"aO5gPcP9\">事实上，概率的公理化的定义用到了“测度”。</p><p data-pid=\"wj0mrB3X\">其中最常用的Lebesgue测度，可以被理解为是图形的面积。</p><p data-pid=\"0Z1BRKS0\">在几何概型中，设 $\\Omega$ 表示样本空间， $A$ 表示一个事件，它们都是 $\\mathbb{R}^n$ 中的Lebesgue可测集。</p><p data-pid=\"Yxi9c_HK\">那么事件 $A$ 发生的概率为 $P(A)=\\dfrac{L(A)}{L(\\Omega)}$ ，其中 $L$ 表示Lebesgue测度。</p><p data-pid=\"3-aSRtPh\">这一切都是在概率论公理化之后才发生的。</p><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"y63d7gAB\">如果没有公理化的概率论，就会出现如下的问题，这被称为Bertand悖论。<sup data-text=\"苏淳. 概率论（第三版）\" data-url=\"\" data-numero=\"1\" data-draft-node=\"inline\" data-draft-type=\"reference\" data-tooltip=\"苏淳. 概率论（第三版）\" data-tooltip-richtext=\"1\" data-tooltip-preset=\"white\" data-tooltip-classname=\"ztext-reference-tooltip\"><a id=\"ref_1_0\" href=\"#ref_1\" data-reference-link=\"true\" aria-labelledby=\"ref_1\">[1]</a></sup></p><img src=\"https://pica.zhimg.com/50/v2-918ef671b4edad2820531d6953a6f11c_720w.jpg?source=2c26e567\"/><img src=\"https://picx.zhimg.com/50/v2-80b3d45f34653161fa2ca1f2321bc25a_720w.jpg?source=2c26e567\"/><img src=\"https://picx.zhimg.com/50/v2-d4170fc992c5550049773b811b5ee212_720w.jpg?source=2c26e567\"/><img src=\"https://picx.zhimg.com/50/v2-c17e6ca1a60f38060fffc3a878c89d03_720w.jpg?source=2c26e567\"/><p data-pid=\"L_Ian6lV\">可以看到，上面的三种解法，答案分别是 $\\dfrac{1}{3}$ ， $\\dfrac{1}{2}$ 和 $\\dfrac{1}{4}$ 。</p><img src=\"https://picx.zhimg.com/50/v2-1116bcacb05b0a02f09a38f5257ccb69_720w.jpg?source=2c26e567\"/><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"UfvRmFFY\">当然，以上是苏淳教授在《概率论》一书中的看法。接下来还有我自己的看法。</p><p data-pid=\"esMZ1gb4\">看到删除“命题”和“逻辑”之后，就开始觉得有点离谱了。</p><p data-pid=\"D9wp0mki\">一些工科的学生搞不清楚数学在做什么，但也大可不必，直接拿来应用就行了。</p><p data-pid=\"bRCNBfvJ\">但是确实存在一些数学系的学生，有时候连一些最基本的逻辑都没有，甚至有时候不明白“假设”是什么意思，“公理”是什么意思，更离谱的会觉得“定理不需要证明”。</p><p data-pid=\"JWmWGGFA\">就像 <span><span class=\"UserLink\"><div class=\"css-1gomreu\"><a class=\"UserLink-link\" data-za-detail-view-element_name=\"User\" target=\"_blank\" href=\"//www.zhihu.com/people/5c05c9c0be702a0c3966f3def70e3faf\">@Yuhang Liu</a></div></span></span> 所说的，我也开始担心以后的大学生搞不清楚什么是“命题”，什么是“定理”，什么是“假设”了。</p><p data-pid=\"hQPkFcz9\">别吧，有生之年别让我看到这一天。</p><p></p><h2>参考</h2><ol class=\"ReferenceList\"><li id=\"ref_1\" tabindex=\"0\"><a class=\"ReferenceList-backLink\" href=\"#ref_1_0\" aria-label=\"back\" data-reference-link=\"true\">^</a><span>苏淳. 概率论（第三版）</span></li></ol>"
					}
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.zhihu.com/question/6098306614/answer/67036803631",
		"items": [
			{
				"itemType": "forumPost",
				"title": "2024年，你的科研工作进展如何？有什么心得体会想和大家分享？",
				"creators": [
					{
						"lastName": "sonta",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2025-01-18",
				"abstractNote": "1/18 update: 做了一个视频介绍linear attention一些近期进展\n\n[Talk][中文] What's next to Mamba? Towards more expressive recurrent update rule_哔哩哔哩_bilibili​www.bilibili...",
				"forumTitle": "知乎",
				"language": "zh-CN",
				"postType": "知乎回答",
				"url": "https://www.zhihu.com/question/6098306614/answer/67036803631",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "博士"
					},
					{
						"tag": "博士后"
					},
					{
						"tag": "学术"
					},
					{
						"tag": "年度盘点"
					},
					{
						"tag": "科研"
					}
				],
				"notes": [
					{
						"note": "<p data-first-child=\"\" data-pid=\"5Paj0Tfp\">1/18 update: 做了一个视频介绍linear attention一些近期进展</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//www.bilibili.com/video/BV1MDwAeWEoM/%3Fvd_source%3D035872531a338721ba64a57a1cdc1ebc\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"[Talk][中文] What's next to Mamba? Towards more expressive recurrent update rule_哔哩哔哩_bilibili\" class=\"LinkCard new css-biylet\" data-za-detail-view-id=\"172\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title two-line\">[Talk][中文] What's next to Mamba? Towards more expressive recurrent update rule_哔哩哔哩_bilibili</span><span class=\"LinkCard-desc\"><span style=\"display: inline-flex; align-items: center;\">​<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" class=\"Zi Zi--InsertLink\" fill=\"currentColor\"><path fill-rule=\"evenodd\" d=\"M5.327 18.883a3.005 3.005 0 0 1 0-4.25l2.608-2.607a.75.75 0 1 0-1.06-1.06l-2.608 2.607a4.505 4.505 0 0 0 6.37 6.37l2.608-2.607a.75.75 0 0 0-1.06-1.06l-2.608 2.607a3.005 3.005 0 0 1-4.25 0Zm5.428-11.799a.75.75 0 0 0 1.06 1.06L14.48 5.48a3.005 3.005 0 0 1 4.25 4.25l-2.665 2.665a.75.75 0 0 0 1.061 1.06l2.665-2.664a4.505 4.505 0 0 0-6.371-6.372l-2.665 2.665Zm5.323 2.117a.75.75 0 1 0-1.06-1.06l-7.072 7.07a.75.75 0 0 0 1.061 1.06l7.071-7.07Z\" clip-rule=\"evenodd\"></path></svg></span>www.bilibili.com/video/BV1MDwAeWEoM/?vd_source=035872531a338721ba64a57a1cdc1ebc</span></span></a></div><p data-pid=\"HN9u2A8w\"><br>----分割线-----</p><p data-pid=\"Zh074Fj6\">我主要是做LLM新架构（非Transformer）设计相关的工作。这个领域个人理解是属于MLSys偏算法的范畴：主要依然以算法为主，但是如果不会写GPU kernel就（几乎）告别这个领域了，所以多多少少沾点MLSys。今年总的来说是收获非常多的一年，自己从萌新PhD也已经做到了在领域内非常知名了（</p><p data-pid=\"3fBfO-cF\">去年年底挂出来的的<a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2312.06635\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">GLA</a>被ICML ‘24顺利接受（跟<a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2405.21060\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">Mamba2</a>很像，<i>但是时间上早了半年，并且形式更加<b>general。</b></i>给Linear Attention加forget gate是2024年新架构方向的研究重点：包括但不限于<a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2405.04517\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">xLSTM</a>, Mamba2, <a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2405.05254\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">gated RetNet</a>, <a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2404.05892\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">RWKV-6,</a> <a href=\"https://link.zhihu.com/?target=https%3A//openreview.net/forum%3Fid%3DY8YVCOMEpz\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">MetaLA</a>, <a href=\"https://link.zhihu.com/?target=https%3A//openreview.net/forum%3Fid%3DIIVYiJ1ggK\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">Rodimus</a>*...）。自己另外也跟 <span><span class=\"UserLink\"><div class=\"css-1gomreu\"><a class=\"UserLink-link\" data-za-detail-view-element_name=\"User\" target=\"_blank\" href=\"//www.zhihu.com/people/ea59b7e0726d2e15c54e2a87e334d6f6\">@Doraemonzzz</a></div></span></span> 做了一个 <a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/pdf/2311.04823\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">HGRN</a> (NeurIPS '23) 的followup：<a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2404.07904\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\" data-za-detail-view-id=\"1043\">HGRN2</a> (COLM '24)</p><ul><li data-pid=\"qsvgA3dA\">HGRN2最后的形式虽然跟GLA殊途同归，但是HGRN2是从gated linear RNN而不是linear attention的角度来motivate的，从这个角度来说，HGRN2可以看成GLA的改进参数化的方式。这种改进的参数化也被最近的NeurIPS '24 oral MetaLA用到了）。</li></ul><p data-pid=\"REbB0_b1\">之后又跟 <span><span class=\"UserLink\"><div class=\"css-1gomreu\"><a class=\"UserLink-link\" data-za-detail-view-element_name=\"User\" target=\"_blank\" href=\"//www.zhihu.com/people/8d5f4c3b705ef7df799b680515700468\">@yzhangcs</a></div></span></span>  一起做了 <a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2409.07146\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">GSA</a> (NeurIPS '24)</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://www.zhihu.com/question/683517985/answer/4404036401\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"NeurIPS 2024 有哪些值得关注的工作？\" class=\"LinkCard new css-biylet\" data-image=\"https://pica.zhimg.com/v2-476bf405175d4643a018319c313f164e_ipico.jpg\" data-image-width=\"1544\" data-image-height=\"1536\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><ul><li data-pid=\"jmxToeXy\">GSA的核心思路就是一层GSA可以写成一个 中间由softmax 连接的两层GLA，使得模型更加的expressive，同时由于保留了softmax的形式，非常适合把transformer大模型distill到一个RNN上（finetuning Transformers to RNNs)</li></ul><p data-pid=\"39WbpVHJ\">此外四月份跑去Cornell tech给了个Talk (<a href=\"https://link.zhihu.com/?target=https%3A//sustcsonglin.github.io/assets/pdf/talk_240425.pdf\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">slides</a>) (sasha迷妹狂喜+1)，暑假的时候去斯坦福Hazyresearch组朝圣并给了个Talk（chris re迷妹狂喜+2）（<a href=\"https://link.zhihu.com/?target=https%3A//sustcsonglin.github.io/assets/pdf/talk_linear_transformer.pdf\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">slides</a>）， 以及其他各种大大小小的remote talk。明年初打算给一个新架构近两年发展历程的系列talk（感兴趣的group如果想让我给个talk的话可以私信联系）</p><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"92EJcFYk\">除了发paper之外，我觉得（有追求的）PhD student的核心不是堆paper数量，而是要</p><ul><li data-pid=\"UDyKnfja\">带领领域发展</li><li data-pid=\"YptgpB2j\">维护高质量的开源库，方便其他研究者来跟进 &amp; 方便萌新入坑 (99%的Phd student不会干这种事，自己的repo能不coming soon就不错了）</li></ul><p data-pid=\"ht8Znn4E\">个人非常喜欢Omar的一个博客，建议每一个AI PhD student都背一遍</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//github.com/okhat/blog/blob/main/2024.09.impact.md\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"On Impactful AI Research\" class=\"LinkCard new css-biylet\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"lFeawwZM\">对于第一点，上半年做了自己非常满意的一篇<b>并行</b>DeltaNet训练 (NeurIPS '24) 的工作 (<a href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2406.06484\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">paper</a>, <a href=\"https://link.zhihu.com/?target=https%3A//sustcsonglin.github.io/blog/2024/deltanet-1/\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">blog series</a>），算法十分优美（我做了五年算法research的最得意之作，没有之一）并且scalable，审稿分数很不错，只可惜碰到了逆天AC只给了个poster郁闷了一阵子 </p><img src=\"https://picx.zhimg.com/50/v2-908d4fe09c65da2869fabf2c3023d0c9_720w.jpg?source=2c26e567\"/><p data-pid=\"ZV_N-0Zq\">（后来albert安慰我说conference都是__，我想想也是，毕竟Mamba1能被某位不要脸的来自某Tech的AC在ICLR '23给强行拒了）。DeltaNet有一个很不错的ICLR '24高分followup（感觉oral预定）</p><p data-pid=\"iFUV7_FD\"><a href=\"https://link.zhihu.com/?target=https%3A//openreview.net/forum%3Fid%3DUvTo3tVBk2\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">Unlocking State-Tracking in Linear RNNs Through Negative Eigenvalues</a></p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//openreview.net/forum%3Fid%3DUvTo3tVBk2\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Unlocking State-Tracking in Linear RNNs Through Negative Eigenvalues\" class=\"LinkCard new css-biylet\" data-image=\"https://pica.zhimg.com/v2-f379b46dfcd21ef4f1edea0f5ad81a0c_ipico.jpg\" data-image-width=\"512\" data-image-height=\"512\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"3ZR-B8J8\">并且我自己也做了一个Gated DeltaNet的followup</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2412.06464\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Gated Delta Networks: Improving Mamba2 with Delta Rule\" class=\"LinkCard new css-biylet\" data-image=\"https://picx.zhimg.com/v2-4baaae2386ede0213c693947a141a747_180x120.jpg\" data-image-width=\"1200\" data-image-height=\"700\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"XCam-6eq\">此外值得一提的是最近的RWKV7可以被看成是generalized delta rule，</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/9397296254\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"PENG Bo：RWKV-7 as a meta-in-context learner：从第一性原理真正理解\" class=\"LinkCard new css-biylet\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"ZonJuHZ7\">（其meta-learning的视角早在deltanet里为人熟知了）；TTT layer也是跟delta rule有着千丝万缕的关系：</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/707826685\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"sonta：[线性RNN系列] TTT (Test-Time Training) layer\" class=\"LinkCard new css-biylet\" data-image=\"https://pic4.zhimg.com/equation_ipico.jpg\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"koqE3gjZ\">因此，自己DeltaNet的工作也算是为领域做了点贡献。可以预见25年会有更多相关的工作 </p><p data-pid=\"nKJsTUMA\">（25/01/04修改：没想到年初就出了一个Titans，那25年只会更多相关的工作）</p><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://link.zhihu.com/?target=https%3A//arxiv.org/abs/2501.00663\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"Titans: Learning to Memorize at Test Time\" class=\"LinkCard new css-biylet\" data-image=\"https://picx.zhimg.com/v2-4baaae2386ede0213c693947a141a747_180x120.jpg\" data-image-width=\"1200\" data-image-height=\"700\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><div class=\"RichText-LinkCardContainer\"><a target=\"_blank\" href=\"https://zhuanlan.zhihu.com/p/16374862400\" data-draft-node=\"block\" data-draft-type=\"link-card\" data-text=\"sonta：[线性RNN系列] Titans: 将in-context meta learning进行到底，取代Mamba势不可挡\" class=\"LinkCard new css-biylet\" data-image=\"https://pic3.zhimg.com/equation_ipico.jpg\" data-image-width=\"0\" data-image-height=\"0\"><span class=\"LinkCard-contents\"><span class=\"LinkCard-title loading\" data-text=\"true\"></span><span class=\"LinkCard-desc loading\"></span></span><span class=\"LinkCard-image LinkCard-image--default\"></span></a></div><p data-pid=\"so6kgeMk\">（很喜欢albert的一句话：24年很多新架构工作都同质化严重，只有DeltaNet让人眼前一亮。Albert也非常喜欢拿着我DeltaNet paper里的表在各种talk里面cue（受宠若惊））</p><img src=\"https://pic1.zhimg.com/50/v2-aa2b238c2423df9bcd5cd614c5a0326b_720w.jpg?source=2c26e567\"/><p data-pid=\"sIkHkQxa\">在开源库方面，<a href=\"https://link.zhihu.com/?target=https%3A//github.com/fla-org/flash-linear-attention\" class=\" wrap external\" target=\"_blank\" rel=\"nofollow noreferrer\">flash-linear-attention (FLA)</a> 库已经快成为新架构research的既定标准了，有很多其他research组在用，并且业界里也用的很多。我们在年中的时候实现了一个RWKV6的triton的kernel也被RWKV社区广泛使用。</p><p data-pid=\"NFMb6wF3\">最后打个广告：现在FLA库几乎全是由我和 <span><span class=\"UserLink\"><div class=\"css-1gomreu\"><a class=\"UserLink-link\" data-za-detail-view-element_name=\"User\" target=\"_blank\" href=\"//www.zhihu.com/people/8d5f4c3b705ef7df799b680515700468\">@yzhangcs</a></div></span></span> 在维护，但是维护库是一个非常花时间和精力的事情。希望找到一些对MLSys偏算法方向感兴趣的同学来一起维护FLA（我和 <span><span class=\"UserLink\"><div class=\"css-1gomreu\"><a class=\"UserLink-link\" data-za-detail-view-element_name=\"User\" target=\"_blank\" href=\"//www.zhihu.com/people/8d5f4c3b705ef7df799b680515700468\">@yzhangcs</a></div></span></span> 可以Triton包教包会，为领域培养一些新的血液。另外我对用thunderkittens把所有kernel全部重新写一遍也挺有兴趣的，就是精力更不上呜呜 ）</p><p class=\"ztext-empty-paragraph\"><br></p><p data-pid=\"jKvkjiP9\">（建了个fla交流群 想进群私信）</p>"
					}
				],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

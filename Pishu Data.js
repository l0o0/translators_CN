{
	"translatorID": "8651aa89-eb54-47bc-9916-17720fe22a86",
	"label": "Pishu Data",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(www|gf)\\.pishu\\.com\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-11-24 19:50:29"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai23@gmail.com

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
	if (url.includes('/bookDetail?')) {
		return 'book';
	}
	else if (url.includes('contentType=literature') || url.includes('/literature/')) {
		return 'bookSection';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.searCon > .searCon_tit > a');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	var type = detectWeb(doc, url);
	if (type == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			// let newDoc = await requestText(url);
			let newDoc = await requestDocument(url);
			// var parser = new DOMParser();
			// newDoc = parser.parseFromString(newDoc, 'text/html');
			scrape(newDoc, url, detectWeb(newDoc, url));
		}
	}
	else {
		await scrape(doc, url, type);
	}
}

function matchCreator(creator) {
	creator = {
		lastName: creator,
		creatorType: 'author',
		fieldMode: 1
	};
	return creator;
}

async function scrape(doc, url = doc.location.href, type) {
	var data = {
		innerData: {},
		setFromJS: function () {
			this.innerData = {};
			let info = Array.from(doc.querySelectorAll('script[type]')).map(element => element.innerText);
			info = info.find(element => element.includes('#makeCitation')).match(/var .* = ".*"/g);
			info.forEach((element) => {
				let item = element.match(/var (.+) = "(.*)"/);
				this.innerData[item[1]] = item[2];
			});
		},
		setFromTable: function (node = doc) {
			this.innerData = {};
			let info = text(node, 'div.books.margintop10 > table');
			info = info
				? info.replace(/^(\s\n?)*/mg, '').replace('订阅\n', '').match(/(^.+：)\n(.*)/mg)
				: [];
			// Z.debug(info);
			info.forEach((element) => {
				let item = element.split('\n');
				this.innerData[item[0].replace(/[\s：]/g, '')] = item[1];
			});
		},
		get: function (key) {
			return this.innerData.hasOwnProperty(key) ? this.innerData[key] : '';
		}
		
	};
	var newItem = new Z.Item(type);
	newItem.extra = '';
	data.setFromJS();
	// Z.debug(data.innerData);
	newItem.title = data.get('title');
	newItem.date = data.get('publishdate');
	newItem.place = data.get('province');
	newItem.publisher = data.get('publishname');
	newItem.abstractNote = ZU.trimInternal(text(doc, 'div.summaryCon')).replace(/<*$/, '');
	newItem.extra += `\nabstractTranslation: ${ZU.trimInternal(text(doc, 'en_summaryCon')).replace(/<*$/, '')}`;
	let author = data.get('author');
	newItem.creators = author.replace(/(<a.*?>)(.+?)(<\/a>)/g, '$2 ').split(/[, ]/).map(element => matchCreator(element));
	if (type == 'book') {
		data.setFromTable();
		// Z.debug(data.innerData);
		newItem.extra += `\ntitleTranslation: ${data.get('英文名')}`;
		newItem.series = data.get('从书名');
		newItem.ISBN = data.get('ISBN');
		newItem.tags = data.get('关键词').trim().split(/\s/)
			.map(element => ({ tag: element }));
	}
	else {
		newItem.bookTitle = data.get('pertainbook');
		newItem.pages = data.get('ebookNumber');
		newItem.ISBN = await (async function () {
			try {
				let boookDoc = await requestDocument(attr('ul.baogao-list1 a[href*="book"]', 'href'));
				data.setFromTable(boookDoc);
				return data.get('ISBN');
			}
			// 以防所属书籍的链接不可用
			catch (error) {
				return '';
			}
		})();
		newItem.series = (function () {
			try {
				let seriesName = text(doc, '.baogao-list1 a[href*="book"]', 1);
				return seriesName
					? seriesName
					: Array.from(doc.querySelectorAll('.baogao-list1 li'))
						.find(element => element.innerText.includes('所属丛书：'))
						.textContent
						.match(/所属丛书：(.*)/)[1];
			}
			// 以防无此字段
			catch (error) {
				return '';
			}
		})();
		newItem.tags = Array.from(doc.querySelectorAll('.d-keyword a')).map(element => ({ tag: element.innerText }));
		newItem.seeAlso.push(attr(doc, 'a[href*="bookdetail"]', 'href'));
		// Z.debug(newItem.seeAlso);
	}
	newItem.attachments.push({
		tittle: 'Snapshot',
		document: doc,
	});
	newItem.url = /^https?:\/\/.+(www|gf)\.pishu\.com\.cn/.test(url)
		? `https://${url.match(/(www|gf)\.pishu\.com\.cn.*/)[0]}`
		: url;
	newItem.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/literature/6334/14724751.html",
		"items": [
			{
				"itemType": "bookSection",
				"title": "以平台经济增加中低收入群体要素收入",
				"creators": [
					{
						"lastName": "端利涛",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-08",
				"ISBN": "9787522821092",
				"abstractNote": "按要素分配是中国特色社会主义市场经济分配制度的重要内容，探索多种渠道增加中低收入群体要素收入是当下推进共同富裕的重要任务。本文梳理了平台经济中的劳动要素收入分配情况，认为平台经济可以作为增加中低收入群体要素收入的重要途径。增加劳动就业、优化收入分配和改善公共服务是平台经济增加要素收入的三个着力点。在此基础上，本文提出平台经济增加中低收入群体要素收入的实现路径：第一，规范和保障零工经济发展；第二，加快推进平台经济均衡发展；第三，大力推广基于平台模式的共享经济。",
				"bookTitle": "中国五年规划发展报告（2022～2023）",
				"extra": "abstractTranslation:",
				"libraryCatalog": "Pishu Data",
				"pages": "597-613",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"series": "发展规划蓝皮书",
				"url": "https://www.pishu.com.cn/skwx_ps/literature/6334/14724751.html",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "中低收入群体"
					},
					{
						"tag": "平台经济"
					},
					{
						"tag": "要素收入"
					}
				],
				"notes": [],
				"seeAlso": [
					"https://www.pishu.com.cn/skwx_ps/bookdetail?SiteID=14&ID=14722402"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/initDatabaseDetail?siteId=14&contentId=13484900&contentType=literature",
		"items": [
			{
				"itemType": "bookSection",
				"title": "从“无理论”的教育到“无教育”的理论",
				"creators": [
					{
						"lastName": "吴永胜",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-07",
				"ISBN": "9787520184342",
				"abstractNote": "正如杰克·古迪所说：“人类思维的细分能力，是与社会生活不断分化的进程相随发展的。”伴随着实践领域的日益细分，理论领域也日益走向专业化，各个实践领域都有相对应的理论类型。在教育领域中，“无理论”的教育现象与“无教育”的理论现象的普遍存在，造成了教育理论与实践之间的长期疏离。通过对教育理论的实践性问题的探讨，对这个老问题做出尝试性的新回答，既是学术之需，亦为个人之趣。文献和现实的双重阅读，要求在探讨教育理论的实践性问题时，改变从理论建设的立场去谈教育理论之实践性的原有研究套路。实践之于理论的框架或基底作用决定了有必要尝试彻底地转换思路，即教育实践到底需要什么样的教育理论，已有理论能否满足教育实践的需要，什么样的理论路径才能使之满足教育实践的需要。如此，不再是为理论而理论，而是为实践而理论。",
				"bookTitle": "从批判到重构",
				"extra": "abstractTranslation:",
				"libraryCatalog": "Pishu Data",
				"pages": "1-29",
				"place": "北京",
				"publisher": "社会科学文献出版社",
				"url": "https://www.pishu.com.cn/skwx_ps/initDatabaseDetail?siteId=14&contentId=13484900&contentType=literature",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "“无教育”"
					},
					{
						"tag": "“无理论”"
					},
					{
						"tag": "教育理论"
					}
				],
				"notes": [],
				"seeAlso": [
					"https://www.pishu.com.cn/skwx_ps/bookdetail?SiteID=14&ID=13484778"
				]
			}
		]
	},
	{
		"type": "web",
		"url": "https://gf.pishu.com.cn/skwx_ps/search?query=%25E6%2595%2599%25E8%2582%25B2&resourceType=all&field=All&search=1&SiteID=14&firstSublibID=",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.pishu.com.cn/skwx_ps/bookDetail?SiteID=14&ID=13395521",
		"items": [
			{
				"itemType": "book",
				"title": "上海合作组织20年",
				"creators": [
					{
						"lastName": "李进峰",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-07",
				"ISBN": "9787520178181",
				"abstractNote": "2021年是上海合作组织成立20周年。20年来，上合组织经受了来自本地区和外部世界的种种考验，不断发展、壮大，自2017年扩员后，上合组织已成为全球人口最多、幅员最辽阔的地区组织，也成为维护世界和平与稳定的重要力量之一。本书对上合组织20年来的发展历程进行了全面回顾和梳理，总结了20年来上合组织在政治、安全、经济、人文和对外关系五大领域的合作成就，深入分析了上合组织在发展过程中存在的问题和面临的内、外部挑战，以及上合组织未来发展的机遇与前景，提出上合组织的理论基础有三个来源、上合组织发展经历了五次理论创新、上合组织未来发展壮大将取决于三个因素，并对上合组织未来发展预测了三种可能的模式，这些研究结论具有创新性。本书对上合组织20年发展状况的论述，既有实践分析，又有理论探讨；既有量化研究，也有定性研判；既有问题意识，也有政策建议。本书是上合组织研究领域非常重要也相当权威的一部参考书和工具书。",
				"extra": "abstractTranslation: \ntitleTranslation: 20 YEARS OF SHANGHAI COOPERATION ORGANIZATION",
				"libraryCatalog": "Pishu Data",
				"url": "https://www.pishu.com.cn/skwx_ps/bookDetail?SiteID=14&ID=13395521",
				"attachments": [
					{
						"tittle": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "上海合作组织"
					},
					{
						"tag": "人文合作"
					},
					{
						"tag": "安全合作"
					},
					{
						"tag": "政治合作"
					},
					{
						"tag": "经济合作"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

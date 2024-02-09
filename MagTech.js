{
	"translatorID": "69614630-f9e8-440d-9a7c-1f4fd7edf191",
	"label": "MagTech",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(/CN/)?.*(.shtml)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-27 17:51:55"
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
const webType = [
	// http://cea.ceaj.org/CN/10.3778/j.issn.1002-8331.2302-0361
	{
		name: 'flat',
		issingle: true,
		pagekey: 'body[id="goTop"]',
	},
	// http://www.zgxdyyzz.com.cn/CN/10.3969/j.issn.1672-9463.2022.03.019
	{
		name: 'flat_float',
		issingle: true,
		pagekey: 'body[id="metaVue"]',
	},
	// http://www.zgyj.ac.cn/CN/abstract/abstract9973.shtml
	{
		name: 'notebook_classic',
		issingle: true,
		pagekey: 'div[id="tabsDiv"]',
	},
	// http://jst.tsinghuajournals.com/CN/Y2015/V55/I1/50
	{
		name: 'notebook_morden',
		issingle: true,
		pagekey: 'ul[class="tabs-nav"]'
	},
	// http://jst.tsinghuajournals.com/CN/1000-0054/home.shtml
	{
		name: 'notebook_flat',
		issingle: true,
		pagekey: 'div[class="center row"] ul[class="nav nav-tabs"]',
	},
	// https://www.ams.org.cn/CN/0412-1961/home.shtml
	{
		name: 'biaoti',
		issingle: false,
		pagekey: 'li[class="biaoti"] a:first-of-type'
	},
	// http://www.syxb-cps.com.cn/CN/0253-2697/home.shtml
	{
		name: 'wenzhang',
		issingle: false,
		pagekey: 'div[class="wenzhang"] dd:first-of-type a:first-of-type'
	},
	// http://www.sykjlt.com/CN/1002-302X/home.shtml
	{
		name: 'txt_biaoti',
		issingle: false,
		pagekey: 'form[id="AbstractList"] td > a[class="txt_biaoti"]:first-child'
	},
	// http://www.zgswfz.com.cn/CN/2095-039X/home.shtml
	{
		name: 'form+title',
		issingle: false,
		pagekey: 'form[name="AbstractList"] span[class="title"]'
	},
	// http://www.zgyxcx.com/CN/volumn/home.shtml
	{
		name: 'title',
		issingle: false,
		pagekey: 'div[class="article-list"] div[class="j-title"] a:first-of-type'
	},
	// http://www.suidaojs.com/CN/2096-4498/home.shtml
	{
		name: "title-1-hight",
		issingle: false,
		pagekey: 'ul[class="article-list article-list-height"] div[class="j-title-1"] > a:first-child'
	},
	// http://www.cjn.org.cn/CN/home
	{
		name: "title-1",
		issingle: false,
		pagekey: 'ul[class="article-list"]  div[class="j-title-1"] > a:first-child'
	},
	// http://www.dwjs.com.cn
	{
		name: "manytable",
		issingle: false,
		pagekey: 'form[name="AbstractList"] > table td > table td > table td > a:nth-child(1) > u'
	}
];

/* 外来的Metadata.js水土不服，决定自己造轮子 */
class Metas {
	constructor(doc) {
		this.doc = doc;
	}

	getMeta(recipes, lang) {
		var result;
		try {
			var recipe = recipes.find(element => (this.doc.querySelectorAll(`head > meta[name="${element.name}"]`).length));
			// if (recipe) {
			result = this.doc.querySelectorAll(`head > meta[name="${recipe.name}"]`);
			result = Array.from(result);
			Z.debug(`In recipe ${JSON.stringify(recipe)},I got:\n${result.map(element => (element.content))}`);
			result = result.filter(element => (!element.getAttribute('xml:lang') || (element.getAttribute('xml:lang') == lang)));
			result = result.map(element => (element.content));
			// Z.debug(`after filtrating, result is ${result}`);
			if (recipe.callback) {
				result = recipe.callback(result);
				// Z.debug(`after callbacking, result is ${result}`);
			}
			else {
				result = (result.length == 1) ? result[0] : result;
			}
			return result;
			// }
		}
		catch (error) {
			return '';
		}
	}
}

const metaMap = {
	title: [
		{ name: "citation_title", },
		{ name: "DC.Title", },
		{ name: "dc.title" }
	],
	abstractNote: [
		{ name: "dc.description" },
		{ name: "Description" },
		{ name: "description" }
	],
	publicationTitle: [
		{ name: "prism.publicationName" },
		{ name: "citation_journal_title" },
		{ name: "dc.source" }
	],
	volume: [
		{ name: "citation_volume" }
	],
	issue: [
		{ name: "citation_issue" }
	],
	firstpage: [
		{ name: "prism.startingPage" },
		{ name: "citation_firstpage" }
	],
	lastpage: [
		{ name: "prism.endingPage" },
		{ name: "citation_lastpage" }
	],
	date: [
		{ name: "prism.publicationDate" },
		{ name: "citation_publication_date" },
		{ name: "citation_online_date" },
		{ name: "citation_date" },
		{ name: "dc.date" }
	],
	journalAbbreviation: [
		{ name: "citation_journal_abbrev" },
	],
	DOI: [
		{ name: "citation_doi" },
		{ name: "DOI" },
		{ name: "prism.doi" }
	],
	ISSN: [
		{ name: "prism.issn" },
		{ name: "citation_issn" }
	],
	rights: [
		{ name: "prism.copyright" },
		{ name: "dc.copyright" }
	],
	// extra: "其他",
	creators: [
		{
			name: "citation_author",
			callback: cleanAutorArr
		},
		{
			name: "citation_authors",
			callback: cleanAutorStr
		},
		{
			name: "dc.creator",
			callback: cleanAutorArr
		},
		{
			name: "DC.Contributor",
			callback: cleanAutorArr
		},
		{
			name: "authors",
			callback: cleanAutorStr
		}
	],
	tags: [
		{
			name: "dc.subject",
			callback: cleanKeywordsArr
		},
		{
			name: "citation_keywords",
			callback: cleanKeywordsArr
		},
		{
			name: "DC.Keywords",
			callback: cleanKeywordsStr
		},
		{
			name: "keywords",
			callback: cleanKeywordsStr
		}
	],
};

const tagMap = {
	title: "T",
	date: "D",
	DOI: "R",
	publicationTitle: "J",
	pages: "P",
	volume: "V",
	issue: "N",
	abstractNote: "X",
	url: "U"
};

function isItem(doc) {
	let insite = doc.querySelector('a[href*="www.magtech.com"]');
	let havetitle = (new Metas(doc)).getMeta(metaMap.title);
	let like = doc.querySelector('[class*="magtech"]');
	if (havetitle && (insite || like)) {
		return {
			name: 'Unknown-type',
			issingle: true
		};
	}
	return false;
}

function detectWeb(doc, _url) {
	var type = webType.find(element => (doc.querySelector(element.pagekey)));
	if (!type) type = isItem(doc);
	if (!type) return false;
	Z.debug(type);
	if (type.issingle) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, type, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, type, checkOnly) {
	var items = {};
	var found = false;
	if (type.name == 'manytable') {
		Z.debug('type is manytable');
		let elements = Array.from(doc.querySelectorAll('form[name="AbstractList"] > table:only-child td:only-child > table td > table'));
		// Z.debug(elements.map((element) => (element.innerText)));
		for (let element of elements) {
			let innerText = element.querySelector('td > a:nth-child(1) > u');
			if (innerText && innerText.textContent == '摘要') {
				let href = innerText.parentElement.href;
				let title = element.querySelector('td > b').innerText;
				Z.debug(`${href}\n${title}`);
				if (!href || !title) continue;
				if (checkOnly) return true;
				found = true;
				items[href] = title;
			}
		}
		return found ? items : false;
	}
	else {
		var rows = doc.querySelectorAll(type.pagekey);
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
}

async function doWeb(doc, url) {
	var type = webType.find(element => (doc.querySelector(element.pagekey)));
	if (!type) type = isItem(doc);
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, type, false));
		if (!items) return;
		Z.debug(items);
		for (let url of Object.keys(items)) {
			await doWeb(await requestDocument(url), url);
		}
	}
	else {
		await scrape(doc, type, url);
	}
}

function cleanAutorArr(creators) {
	creators = creators.map(creator => (matchCreator(creator)));
	return creators;
}

function cleanAutorStr(creators) {
	creators = str2arr(creators[0]);
	return cleanAutorArr(creators);
}

function matchCreator(creator) {
	if (/[A-Za-z]/.test(creator)) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/g, '');
		creator = {
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		};
	}
	return creator;
}

function cleanKeywordsArr(keywords) {
	keywords = keywords.map(keyword => ({ tag: keyword }));
	return keywords;
}

function cleanKeywordsStr(keywords) {
	keywords = str2arr(keywords[0]);
	keywords = cleanKeywordsArr(keywords);
	return keywords;
}

function str2arr(string) {
	return string.split(/[,;，；]\s?/);
}

async function scrape(doc, type, url = doc.location.href) {
	// Z.debug(type);
	var metas = new Metas(doc);
	var newItem = new Z.Item('journalArticle');
	var language = [
		{ name: "citation_language" },
		{ name: "DC.Language" },
		{ name: "dc.language" }
	];
	language = metas.getMeta(language).toLowerCase();
	// Z.debug(`document language is ${language}`);
	var fields = Object.keys(metaMap);
	for (let i = 0; i < fields.length; i++) {
		let key = fields[i];
		newItem[key] = metas.getMeta(metaMap[key], language);
	}
	newItem.pages = (function () {
		let firstpage = newItem.firstpage;
		let lastpage = newItem.lastpage;
		delete newItem.firstpage;
		delete newItem.lastpage;
		return (firstpage == lastpage || !lastpage) ? firstpage : `${firstpage}-${lastpage}`;
	})();
	newItem.language = (function () {
		return (['zh', 'cn', 'zh-cn', 'chi'].includes(language)) ? 'zh-CN' : 'en-US';
	})();
	newItem.url = url;
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.attachments.push({
		url: metas.getMeta([{ name: "citation_pdf_url" }]),
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	if (type.name == 'flat' || type.name == 'notebook_classic') {
		let risURL = doc.querySelector('#ris_export').href;
		// Z.debug(risURL)
		let risText = await requestText(risURL);
		risText = risText.split('\r\n');
		// Z.debug(risText);
		for (const field in tagMap) {
			const tag = tagMap[field];
			var value;
			try {
				value = (risText.find(line => (line.charAt(1) == tag))).substring(3);
			}
			catch (erro) {
				value = '';
			}
			if (!newItem.field || field == 'abstractNote') {
				newItem.field = value;
			}
		}
	}
	// Z.debug(newItem);
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.xdfyjs.cn/CN/1009-086X/home.shtml",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.zgswfz.com.cn/CN/10.16409/j.cnki.2095-039x.2018.01.002",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "植食性害虫食诱剂的研究与应用",
				"creators": [
					{
						"lastName": "蔡晓明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李兆群",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "潘洪生",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陆宴辉",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-02-08",
				"DOI": "10.16409/j.cnki.2095-039x.2018.01.002",
				"ISSN": "2095-039X",
				"abstractNote": "植食性害虫主要取食植物的茎叶、果实、花蜜等，并且常对某些食物...",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "MagTech",
				"pages": "8",
				"publicationTitle": "中国生物防治学报",
				"url": "http://www.zgswfz.com.cn/CN/10.16409/j.cnki.2095-039x.2018.01.002",
				"volume": "34",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "偏好选择"
					},
					{
						"tag": "寄主植物"
					},
					{
						"tag": "挥发物"
					},
					{
						"tag": "绿色防控"
					},
					{
						"tag": "行为调控"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://jst.tsinghuajournals.com/CN/Y2015/V55/I1/50",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "施工粉尘健康损害量化评价",
				"creators": [
					{
						"lastName": "李小冬",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "苏舒",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "黄天健",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-01-20",
				"ISSN": "1000-0054",
				"issue": "1",
				"journalAbbreviation": "清华大学学报（自然科学版）",
				"language": "zh-CN",
				"libraryCatalog": "MagTech",
				"pages": "50-55",
				"publicationTitle": "清华大学学报（自然科学版）",
				"url": "http://jst.tsinghuajournals.com/CN/Y2015/V55/I1/50",
				"volume": "55",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "健康损害"
					},
					{
						"tag": "施工粉尘"
					},
					{
						"tag": "环境影响评价"
					},
					{
						"tag": "量化评价"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.dwjs.com.cn/T2JUSGUU2P9AedAuY61LaRnnjULDzh%2Bv_w8bZtqBahG9wUCJsceKzRtv6B_%2B%2B9%2BO?encrypt=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "新型电力系统的“碳视角”：科学问题与研究框架",
				"creators": [
					{
						"lastName": "康重庆",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "杜尔顺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李姚旺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张宁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈启鑫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "郭鸿业",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "王鹏",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-03-05",
				"DOI": "10.13335/j.1000-3673.pst.2021.2550",
				"ISSN": "1000-3673",
				"abstractNote": "电力在我国能源消费与碳排放中占据重要地位。电力系统低碳转型,构建以新能源为主体的新型电力系统将对我国碳达峰、碳中和战略目标的实现起到关键作用。该文首先分析了从“电视角”到“碳视角”下电力学科研究体系的转变趋势,并对当前“碳视角”下的电力系统研究概况进行了综述。基于“碳视角”下的电力系统研究路径,从电力系统全环节碳排放计量和“战略-技术-市场”协同低碳化解决方案2个方面,分析了电力低碳转型过程中的关键科学问题。在此基础上,从碳计量与碳追踪、碳规划与碳轨迹、碳减排与碳优化、碳市场与碳交易4个方面提出了新型电力系统“碳视角”的研究框架,并对关键研究内容进行了分析和阐述。",
				"issue": "3",
				"language": "zh-CN",
				"libraryCatalog": "MagTech",
				"pages": "821-833",
				"publicationTitle": "电网技术",
				"url": "http://www.dwjs.com.cn/T2JUSGUU2P9AedAuY61LaRnnjULDzh%2Bv_w8bZtqBahG9wUCJsceKzRtv6B_%2B%2B9%2BO?encrypt=1",
				"volume": "46",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "新型电力系统"
					},
					{
						"tag": "碳减排与碳优化"
					},
					{
						"tag": "碳市场与碳交易"
					},
					{
						"tag": "碳规划与碳轨迹"
					},
					{
						"tag": "碳计量和碳追踪"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

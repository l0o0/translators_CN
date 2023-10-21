{
	"translatorID": "69614630-f9e8-440d-9a7c-1f4fd7edf191",
	"label": "MagTech",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(/CN/)?.*(.shtml)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 330,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-21 10:00:30"
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
const WEBTYPE = [
	{
		name: 'flat',
		issingle: true,
		pagekey: 'body[id="goTop"]',
	},
	{
		name: 'flat_float',
		issingle: true,
		pagekey: 'body[id="metaVue"]',
	},
	{
		name: 'notebook_classic',
		issingle: true,
		pagekey: 'div[id="tabsDiv"]',
	},
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
	{
		name: "manytable",
		issingle: false,
		pagekey: 'form[name="AbstractList"] > table td > table td > table td > a:nth-child(1) > u'
	}
	// http://www.dwjs.com.cn
];

/* 外来的Metadata.js水土不服，决定自己造轮子 */
function Metas(doc) {
	this.doc = doc,
		this.getMeta = function (recipes, lang) {
			var result;
			try {
				var recipe = recipes.find((element) => (this.doc.querySelectorAll(`head > meta[name="${element.name}"]`).length));
				// if (recipe) {
				result = this.doc.querySelectorAll(`head > meta[name="${recipe.name}"]`);
				result = Array.from(result);
				Z.debug(`In recipe ${JSON.stringify(recipe)},I got:\n${result.map((element) => (element.content))}`);
				result = result.filter((element) => (!element.getAttribute('xml:lang') || (element.getAttribute('xml:lang') == lang)));
				result = result.map((element) => (element.content));
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
			} catch (error) {
				return "";
			}
		}
}

const METAMAP = {
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
	// series: "系列",
	// seriesTitle: "系列标题",
	// seriesText: "系列描述",
	journalAbbreviation: [
		{ name: "citation_journal_abbrev" },
	],
	DOI: [
		{ name: "prism.doi" },
		{ name: "citation_doi" },
		{ name: "DOI" }
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
}

const TAGMAP = {
	title: "T",
	date: "D",
	DOI: "R",
	publicationTitle: "J",
	pages: "P",
	volume: "V",
	issue: "N",
	abstractNote: "X",
	url: "U"
}

function isItem(doc) {
	var insite = doc.querySelector('a[href^="http://www.magtech.com"]');
	var havetitle = (new Metas(doc)).getMeta(METAMAP.title);
	if (havetitle && insite) {
		return {
			name: 'Unknown-type',
			issingle: true
		}
	};
	return false
}

function detectWeb(doc, url) {
	var type = WEBTYPE.find((element) => (doc.querySelector(element.pagekey)));
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
		var rows = doc.querySelectorAll(type.pagekey)
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
	var type = WEBTYPE.find((element) => (doc.querySelector(element.pagekey)));
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, type, false));
		if (!items) return;
		Z.debug(items);
		for (let url of Object.keys(items)) {
			await doWeb(await requestDocument(url), url);
		}
	}
	else {
		await scrape(doc, type, url)
	}
}

function cleanAutorArr(creators) {
	creators = creators.map((creator) => (matchCreator(creator)));
	return creators;
}

function cleanAutorStr(creators) {
	creators = str2arr(creators[0]);
	return cleanAutorArr(creators);
}

function matchCreator(creator) {
	if (creator.search(/[A-Za-z]/) !== -1) {
		creator = ZU.cleanAuthor(creator, 'author');
	}
	else {
		creator = creator.replace(/\s/g, '');
		creator = {
			"lastName": creator,
			"creatorType": "author",
			"fieldMode": true
		}
	}
	return creator;
}

function cleanKeywordsArr(keywords) {
	keywords = keywords.map((keyword) => ({ "tag": keyword }));
	return keywords;
}

function cleanKeywordsStr(keywords) {
	keywords = str2arr(keywords[0]);
	keywords = cleanKeywordsArr(keywords);
	return keywords;
}

function str2arr(string) {
	return string.split(/[(,\s?)|，]/);
}

async function scrape(doc, type, url = doc.location.href) {
	var metas = new Metas(doc);
	var newItem = new Z.Item('journalArticle');
	var language = [
		{ name: "citation_language" },
		{ name: "DC.Language" },
		{ name: "dc.language" }
	];
	language = metas.getMeta(language).toLowerCase();
	// Z.debug(`document language is ${language}`);
	var fields = Object.keys(METAMAP);
	for (let i = 0; i < fields.length; i++) {
		let key = fields[i];
		newItem[key] = metas.getMeta(METAMAP[key], language);
	}
	newItem.pages = (function () {
		let firstpage = newItem.firstpage;
		let lastpage = newItem.lastpage;
		delete newItem.firstpage;
		delete newItem.lastpage;
		return (firstpage == lastpage || !lastpage) ? firstpage : `${firstpage}-${lastpage}`;
	})();
	newItem.language = (function () {
		return (['zh', 'cn', 'zh-cn', 'chi'].indexOf(language) < 0) ? 'en-US' : 'zh-CN';
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
		let risURL = doc.querySelector('a[id="ris_export"]').href;
		// Z.debug(risURL)
		let risText = await requestText(risURL);
		risText = risText.split('\r\n');
		var itemPatch = {};
		// Z.debug(risText);
		for (const field in TAGMAP) {
			const tag = TAGMAP[field];
			var value;
			try {
				value = (risText.find((line) => (line.charAt(1) == tag))).substring(3);
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
						"fieldMode": true
					},
					{
						"lastName": "李兆群",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "潘洪生",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "陆宴辉",
						"creatorType": "author",
						"fieldMode": true
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
						"fieldMode": true
					},
					{
						"lastName": "苏舒",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "黄天健",
						"creatorType": "author",
						"fieldMode": true
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
		"url": "http://www.dwjs.com.cn/f9hw47gJN5D3gkNCvL3iBQnAh7Jlvn6Wu%2BMxbNfFU1fhERdp5zZIVDS2jBgioUot?encrypt=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "智能配电网柔性互联研究现状及发展趋势",
				"creators": [
					{
						"lastName": "祁琪",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "姜齐荣",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "许彦平",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "2020-12-05",
				"DOI": "doi:10.13335/j.1000-3673.pst.2019.2670",
				"ISSN": "1000-3673",
				"abstractNote": "分布式电源的大规模接入、用电负荷的多元化增长及直流负荷比例的增加,给传统配电网的结构形态与运行方式带来了巨大影响。利用全控型电力电子器件对配电网进行柔性互联改造,有助于提高系统的可控性、可靠性与安全性,促进分布式电源消纳、满足高质量供电需求,是向未来智能配电网演变的重要手段。文章首先介绍了柔性互联配电网的关键环节——柔性互联装置(flexible interconnection device,FID)的基本结构与工作原理;然后结合国内外示范工程,对柔性互联系统3种典型形态及特点进行分析,对运行控制和规划设计方面的关键技术进行了讨论及研究现状总结,并指出现阶段亟需突破的关键问题;最后,为实现柔性互联配电网更广泛的应用,对其发展趋势进行了展望。",
				"issue": "12",
				"language": "zh-CN",
				"libraryCatalog": "MagTech",
				"pages": "4664-4676",
				"publicationTitle": "电网技术",
				"url": "http://www.dwjs.com.cn/f9hw47gJN5D3gkNCvL3iBQnAh7Jlvn6Wu%2BMxbNfFU1fhERdp5zZIVDS2jBgioUot?encrypt=1",
				"volume": "44",
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
						"tag": "分布式电源"
					},
					{
						"tag": "柔性互联装置"
					},
					{
						"tag": "电力电子"
					},
					{
						"tag": "示范工程"
					},
					{
						"tag": "配电网运行控制"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

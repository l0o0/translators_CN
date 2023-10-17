{
	"translatorID": "d611008a-850d-4860-b607-54e1ecbcc592",
	"label": "E-Tiller",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(/ch/)?.*(.aspx)?",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-17 07:09:31"
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
		name: 'table_richsapn',
		pagekey: 'table.front_table #Author',
		issingle: true
	},
	// 缺失关键信息，无法解析
	// {
	// 	name: 'table_lessspan',
	// 	pagekey: '#QueryUI td > table td > table:nth-child(1) td > table tr:nth-child(4) > td > table #FileTitle',
	// 	issingle: true
	// },
	{
		name: 'exportable',
		pagekey: '#ExportUrl',
		issingle: true
	},
	{
		name: 'view_abstract',
		pagekey: 'a[href*="reader/view_abstract.aspx?file_no="]',
		issingle: false
	},
	{
		name: 'artical_abstract',
		pagekey: 'a[href*="/article/abstract/"]',
		issingle: false
	}
]

function detectWeb(doc, url) {
	var atts = [
		'class',
		'id'
	];
	let insite = atts.some((element) => {
		let foots = Array.from(doc.querySelectorAll(`div[${element}*="foot"]`));
		return foots.some((foot) => (foot.innerText.match(/(技术支持)?.*北京勤云科技发展有限公司/)));
	});
	if (!insite) return false;
	let validtype = WEBTYPE.find((element) => (
		doc.querySelector(element.pagekey)
	));
	// Z.debug(`detect type as\n${JSON.stringify(validtype)}`);
	if (!validtype) return false;
	if (validtype.issingle) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, validtype, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, type, checkOnly) {
	var items = {};
	var found = false;
	let temp_rows = Array.from(doc.querySelectorAll(type.pagekey));
	var rows = temp_rows.filter((element) => (!(element.textContent.startsWith('摘要'))));
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
		// Z.debug(`add\n${href}\n${title}\nas item`);
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	let validtype = WEBTYPE.find((element) => (
		doc.querySelector(element.pagekey)
	));
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, validtype, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await doWeb(await requestDocument(url), url);
		}
	}
	else {
		switch (validtype.name) {
			case 'table_richsapn':
				await scrapeElement(doc, url);
				break;
			case 'exportable':
				await scrapeRis(doc, url);
			default:
				break;
		}
	}
}

const TABLEIDMAP = {
	title: { path: '#FileTitle' },
	'titleTranslation': { path: '#EnTitle' },
	abstractNote: { path: '#Abstract' },
	'abstractTranslation': { path: '#EnAbstract' },
	publicationTitle: {
		path: '#ReferenceText',
		callback: function (text) {
			text.split('.').split(',')[0]
		}
	},
	volume: { 
		path: '#ReferenceText',
		callback: function (text) {
			text = text.split('.').pop().split(',').pop();
			return text.match(/\d+(?=())/)[0];
		}
	},
	issue: { 
		path: '#ReferenceText',
		callback: function (text) {
			text = text.split('.').pop().split(',').pop();
			return text.match(/\(\d+\)/)[0].slice(1, -1);
		}
	},
	pages: { 
		path: '#ReferenceText',
		callback: function (text) {
			return text.split(':').pop();
		}
	},
	date: { 
		path: '#ReferenceText',
		callback: function (text) {
			return text.split('.').pop().split(',')[0];
		}
	},
	DOI: { path: '#DOI' },
	creators: {
		path: '#Author > table tr td:first-of-type',
		multiple: true,
		callback: function (arr) {
			if (arr[0] == '作者') {arr.shift()};
			arr = arr.map((element) => (element.replace(/\d/g, '')));
			arr = cleanArr(arr);
			arr = arr.filter((element) => (element.length > 1));
			return arr.map((element) => (matchCreator(element)));
		}
	},
	tags: { 
		path: '#KeyWord a',
		multiple: true,
		callback: function (arr) {
			arr = cleanArr(arr);
			return arr.map((keyword) => (
				{
					tag: keyword
				}
			));
		}
	}
}

function cleanArr(arr) {
	seprator = new RegExp('[,，；;]\s?');
	if (arr.length == 1 && arr[0].match(seprator)) {
		arr = arr[0].split(seprator);
	}
	return arr;
}

function matchCreator(creator) {
	// Z.debug(creators);
	if (creator.search(/[A-Za-z]/) !== -1) {
		creator = ZU.cleanAuthor(creator, "author");
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

async function scrapeElement(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	for (const field in TABLEIDMAP) {
		const recipe = TABLEIDMAP[field];
		// Z.debug(`for ${field}, use selector path ${recipe.path}`);
		var result;
		try {
			if (recipe.multiple) {
				result = Array.from(doc.querySelectorAll(recipe.path)).map(
					(element) => (element.innerText)
					);
			}
			else {
				result = doc.querySelector(recipe.path);
				result = result.innerText;
			}
			if (recipe.callback) {
				result = recipe.callback(result);
			}
			// Z.debug(`return result:`);
			// Z.debug(result);
		} catch (error) {
			result = "";
		}
		newItem[field] = result;
	}
	// 有些网页加载异常就会获取不到标题，只能用英文标题暂替
	if (newItem['title'] == '') newItem['title'] = newItem['titleTranslation'];
	var pdfURL = doc.querySelector('#URL').href;
	newItem.attachments.push({
		url: pdfURL,
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	newItem.attachments.push({
		url : url,
		title : "Snapshot", 
		mimeType : "text/html"
	});
	newItem.complete();
}

const RISMAP = {
	'title': { tag: 'TI' },
	'abstractNote': { tag: 'AB'},
	'publicationTitle': { tag: 'JF' },
	'volume': { tag: 'VL' },
	'issue': { tag: 'IS' },
	'date': { tag: 'PY'},
	'journalAbbreviation': { tag: 'JA' },
	'DOI': { tag: 'ID' },
	'firstpage': { tag: 'SP'},
	'lastpage': { tag: 'EP'},
	'tags': {
		tag: 'KW',
		callback: function (text) {
			text = cleanArr([text]);
			return text.map((keyword) => (
				{
					tag: keyword
				}
			));
		}
	}
}

const METAMAP = {
	'volume': {
		tag: 'name',
		value: 'citation_volume'
	},
	'issue': {
		tag: 'name',
		value: 'citation_issue'
	},
	'date': {
		tag: 'name',
		value: 'citation_date'
	},
	'journalAbbreviation': {
		tag: 'name',
		value: 'citation_journal_abbrev'
	},
	'language': {
		tag: 'http-equiv',
		value: 'Content-Language'
	},
	'ISSN': {
		tag: 'name',
		value: 'citation_issn'
	},
	'firstpage': {
		tag: 'name',
		value: 'citation_firstpage'
	},
	'lastpage': {
		tag: 'name',
		value: 'citation_lastpage'
	}
}

async function scrapeRis(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	var risURL = doc.querySelector('#ExportUrl').href.split('/');
	let id = risURL.pop();
	var risURL = risURL.join('/');
	// Z.debug(risURL)
	let pdfURL = doc.querySelector('#PdfUrl').href;
	// Z.debug(pdfURL);
	let risText = await requestText(
		risURL, 
		{
			method: 'POST',
			body: `export_type=ris&include_content=2&article_list=${id}&action_type=export`
		});
	var risData = {
		lines: risText.split('\n'),
		getTag: function (tag) {
			try {
				return this.lines.find((line) => (line.slice(0,2) == tag)).substring(6);
			} catch (error) {
				return '';
			}
		},
		getTags: function (tag) {
			try {
				return this.lines.filter(
					(line) => (line.slice(0,2) == tag)).map(
						(line) => (line.substring(6)));
			} catch (error) {
				return '';
			}
		},
	};
	for (const field in RISMAP) {
		const recipe = RISMAP[field];
		var result = risData.getTag(recipe.tag);
		if (result && recipe.callback) {
			result = recipe.callback(result);
		}
		newItem[field] = result;
	}
	newItem['creators'] = risData.getTags('AU').map((element) => (matchCreator(element)));
	// Z.debug(newItem);
	for (const field in METAMAP) {
		const recipe = METAMAP[field];
		var result;
		try {
			result = doc.querySelector(`head > meta[${recipe.tag}="${recipe.value}"]`).content;
		} catch (error) {
			result = '';
		}
		// Z.debug(`in field ${field},`)
		// Z.debug(`we already have:\n${newItem[field]}`);
		// Z.debug(`and now we get from meta:\n${result}`);
		if (!newItem[field] && result) {
			newItem[field] = result;
		}
	}
	newItem['pages'] = (function () {
		let firstpage = newItem.firstpage;
		let lastpage = newItem.lastpage;
		delete newItem.firstpage;
		delete newItem.lastpage;
		if (firstpage && lastpage) {
			if (firstpage == lastpage) {
				return firstpage;
			}
			return `${firstpage}-${lastpage}`
		}
		else if (firstpage || lastpage) {
			return [firstpage, lastpage].find((page) => (page));
		} else {
			return '';
		}
		
	})();
	newItem.attachments.push({
		url: pdfURL,
		title: 'Full Text PDF',
		mimeType: 'application/pdf'
	});
	newItem.attachments.push({
		url : url,
		title : "Snapshot", 
		mimeType : "text/html"
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://wltb.ijournal.cn/ch/reader/view_abstract.aspx?file_no=20222015&flag=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "大学物理课程教学设计撰写方法探讨",
				"creators": [
					{
						"lastName": "王升",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "李贤丽",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "赵鹏程",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "康云",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "物理通报",
				"abstractNote": "课程教学设计中不仅包含了课程教学内容, 还蕴含了授课思路、 方式与方法, 以及课程思政元素的融入等因素, 教学设计质量与水平是讲好一堂课的关键. 本研究以绪论课为例, 探讨了大学物理课程教学设计撰写思路与方法",
				"issue": "9",
				"libraryCatalog": "E-Tiller",
				"pages": "8-13",
				"volume": "42",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "大学物理"
					},
					{
						"tag": "教学设计"
					},
					{
						"tag": "课程思政"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://hkfdj.ijournals.cn/hkfdj/ch/reader/view_abstract.aspx?file_no=20230408&flag=1",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "航空发动机吞鸟要求的发展",
				"creators": [
					{
						"lastName": "张清",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "沈锡钢",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "牛坤",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "李娜",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "航空发动机",
				"abstractNote": "针对中国军用大涵道比涡扇发动机吞鸟验证需求，从美国、欧洲、俄罗斯和中国民用航空发动机适航规章和军用发动机通用规范、适航规章及吞鸟要求衍变历程、衍变内容和应用情况出发，对比分析军、民用吞鸟要求内容和内涵的差异。通过分析航空发动机吞鸟要求与应用的发展，研究吞鸟要求与发动机研制技术的关联性，提出中国自主研制的大涵道比发动机吞鸟要求应用建议。吞鸟要求的升级以更高的安全性需求为出发点，并随航空发动机设计技术提高得以实施和颁布；吞鸟要求的升级又指导着下一代发动机的研制，二者相辅相成螺旋提升；吞鸟要求的具体参数逐渐统一，并呈现越来越严格的特点。根据中国适航规章和通用规范吞鸟要求演变发展特点，结合中国军用大涵道比涡扇发动机研制技术现状，建议目前中国自主研制的大涵道比发动机按照FAR 33.77吞鸟要求的参数进行验证，并最终依托于发动机技术进步实现与现行吞鸟要求的一致性。",
				"issue": "4",
				"libraryCatalog": "E-Tiller",
				"pages": "54-67",
				"volume": "49",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "吞鸟要求"
					},
					{
						"tag": "航空发动机"
					},
					{
						"tag": "适航规章"
					},
					{
						"tag": "通用规范"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://zyytbzz.cn/zyytb/article/abstract/20221148",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "以症为效：对中医临床疗效评价的再思考<sup>※</sup>",
				"creators": [
					{
						"lastName": "陈志强",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "蒋志",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "肖英超",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "曹立幸",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "2023-10-13",
				"ISSN": "1671-2749",
				"abstractNote": "基于中医和西医是两个完全不同的医学体系，“以症为病”是中医识病之源，“以症（证）为治”是中医最具特色治疗方法的客观事实，提出守正中医也应“以症为效”。开展“以症为效”的中医临床疗效评价研究，将为开展中西医结合、发展中医，以及构建以健康为目标的临床疗效评价体系提供新的思路与启迪。",
				"issue": "7",
				"journalAbbreviation": "《中医药通报》杂志",
				"language": "zh-cn",
				"libraryCatalog": "E-Tiller",
				"pages": "21-23",
				"publicationTitle": "中医药通报",
				"volume": "22",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "中医"
					},
					{
						"tag": "疗效评价"
					},
					{
						"tag": "病"
					},
					{
						"tag": "症"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.jos.org.cn/jos/article/abstract/3464",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "复杂网络聚类方法",
				"creators": [
					{
						"lastName": "杨博",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "刘大有",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"firstName": "L. I. U.",
						"lastName": "Jiming",
						"creatorType": "author"
					},
					{
						"lastName": "金弟",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "马海宾",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"ISSN": "1000-9825",
				"abstractNote": "网络簇结构是复杂网络最普遍和最重要的拓扑属性之一,具有同簇节点相互连接密集、异簇节点相互连接稀疏的特点.揭示网络簇结构的复杂网络聚类方法对分析复杂网络拓扑结构、理解其功能、发现其隐含模式、预测其行为都具有十分重要的理论意义,在社会网、生物网和万维网中具有广泛应用.综述了复杂网络聚类方法的研究背景、研究意义、国内外研究现状以及目前所面临的主要问题,试图为这个新兴的研究方向勾画出一个较为全面和清晰的概貌,为复杂网络分析、数据挖掘、智能Web、生物信息学等相关领域的研究者提供有益的参考.",
				"issue": "1",
				"journalAbbreviation": "软件学报",
				"language": "zh-cn",
				"libraryCatalog": "E-Tiller",
				"pages": "54-66",
				"publicationTitle": "软件学报",
				"volume": "20",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "复杂网络"
					},
					{
						"tag": "网络簇结构"
					},
					{
						"tag": "网络聚类"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://lyspkj.ijournal.cn/lyspkj/home",
		"items": "multiple"
	}
]
/** END TEST CASES **/

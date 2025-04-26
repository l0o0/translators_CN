{
	"translatorID": "262ecedb-bb92-4845-a281-cc79af979fbe",
	"label": "TOAJ",
	"creator": "jiaojiaodubai",
	"target": "^https://toaj\\.stpi\\.niar\\.org\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-04-26 06:28:31"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/article/')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.title > a[href*="/article/"], .card > a[href*="/article/"]');
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
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item('journalArticle');
	const data = getLabeledData(
		doc.querySelectorAll('.article-field__outer > div'),
		row => text(row, '.brown-label'),
		row => row.querySelector('.brown-label+*'),
		doc.createElement('div')
	);
	const zhTitle = text(doc, '.main-title').replace(/(\p{Unified_Ideograph})\s+(\p{Unified_Ideograph})/gu, '$1$2');
	const enTitle = ZU.capitalizeTitle(text(doc, '.sub-title'));
	if (zhTitle) {
		newItem.title = zhTitle;
		newItem.setExtra('original-title', enTitle);
	}
	else {
		newItem.title = enTitle;
	}
	newItem.abstractNote = data('中文摘要');
	try {
		const pubDoc = await requestDocument(attr(doc, '[x-data="content"] a[href*="/index/journal/"]', 'href'));
		newItem.publicationTitle = text(pubDoc, '.article__banner__text > div');
		newItem.setExtra('original-container-title', text(pubDoc, '.article__banner__text > div', 1));
	}
	catch (error) {
		Z.debug(error);
	}
	const groups = text(doc, '.font-Space_Grotesk', 1)
		.replace(/\s/g, '')
		.replace(/第(\d+)卷/, '$1')
		.replace(/第(\d+)期/, '($1)')
		.match(/^(?<volume>\d+|)(?<issue>\(\d+\))?\/(?<year>\d{4})\/(?<month>\d{1,2})\/\D*(?<pages>[\d-]+)/)
		.groups;
	newItem.volume = groups.volume;
	newItem.issue = groups.issue ? groups.issue.slice(1, -1) : '';
	newItem.pages = groups.pages;
	newItem.date = ZU.strToISO(`${groups.year}-${groups.month}`);
	newItem.language = zhTitle ? 'zh-TW' : 'en-US';
	newItem.url = url;
	newItem.libraryCatalog = '臺灣學術期刊開放取用平台';
	const creatorsExt = [];
	data('作者', true).querySelectorAll('div.gap-1').forEach((elm) => {
		const name = text(elm, 'div:first-child').replace(/\s*\*\s*$/, '');
		if (/\p{Unified_Ideograph}/u.test(name)) {
			const zhName = tryMatch(name, /^\p{Unified_Ideograph}+/u);
			const creator = {
				firstName: '',
				lastName: zhName,
				creatorType: 'author',
				fieldMode: 1
			};
			newItem.creators.push(creator);
			const original = ZU.cleanAuthor(name.substring(zhName.length), 'author');
			if (original) {
				newItem.extra = (newItem.extra || '').trim() + `\noriginal-author: ${original.lastName} || ${original.firstName}`;
				creatorsExt.push({
					...creator,
					original
				});
			}
		}
		else {
			newItem.creators.push(ZU.cleanAuthor(name, 'author'));
		}
	});
	if (creatorsExt.some(creator => creator.original)) {
		newItem.setExtra('creatorsExt', JSON.stringify(creatorsExt));
	}
	const pdfLink = doc.querySelector('a.text-decoration-underline');
	if (pdfLink) {
		Z.debug(pdfLink.href);
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.tags = `${data('中文關鍵字')}；${data('英文關鍵字')}`.split(/[;；、,]\s*/);
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f987544c340187593d5ce801b6",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "談戀愛對青少年認知能力與非認知能力的影響：來自中國教育追蹤調查的證據",
				"creators": [
					{
						"firstName": "",
						"lastName": "駱為祥",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "趙孟珂",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "靳永愛",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-09",
				"abstractNote": "在西方國家，戀愛關係被看成青少年成長的一部分；在中國，青少年的戀愛關係被稱為早戀，通 常被認為是不合適宜的。談戀愛真的對中國青少年成長不利嗎？基於中國教育追蹤調查（2013— 2014 學年、2014—2015 學年）資料，使用傾向值加權的方法，本研究系統評估了談戀愛對中學生 的認知能力與非認知能力的影響。認知能力以認知能力測試得分、語數外成績班內標準分、班級 名次來測量；非認知能力以自我效能、抑鬱程度、對未來的信心、教育期望、學習態度來測量。 研究發現，相對於未談過戀愛的中學生，談過戀愛的中學生在認知能力和非認知能力方面的表現 顯著更差。在談戀愛影響認知能力的機制中，學業投入時間是一個重要的中介變項（mediator）， 談戀愛會透過減少學業投入時間來降低認知能力方面的表現。研究進一步發現，談戀愛的負面影 響在女學生當中表現得更為明顯。戀愛捲入程度愈深，其給青少年帶來的負面影響愈大。",
				"extra": "original-title: Effects of Romantic Involvement on Adolescents’ Cognitive and Noncognitive Skills: Evidence from China Education Panel Survey\noriginal-container-title: Bulletin of Educational Psychology\noriginal-author:  ||\noriginal-author:  ||\noriginal-author: * || \ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"駱為祥\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"趙孟珂\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"\",\"lastName\":\"\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"靳永愛\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"\",\"lastName\":\"*\",\"creatorType\":\"author\"}}]",
				"issue": "1",
				"language": "zh-TW",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "179-204",
				"publicationTitle": "教育心理學報",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f987544c340187593d5ce801b6",
				"volume": "54",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "adolescent"
					},
					{
						"tag": "cognitive skills"
					},
					{
						"tag": "non-cognitive skills"
					},
					{
						"tag": "propensity score weighting"
					},
					{
						"tag": "romantic involvement"
					},
					{
						"tag": "傾向值加權"
					},
					{
						"tag": "戀愛"
					},
					{
						"tag": "認知能力"
					},
					{
						"tag": "青少年"
					},
					{
						"tag": "非認知能力"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f9961ac13801961e97fa1601ae",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "青年教育分流、學用相符、工作滿意及快樂感之縱向關係",
				"creators": [
					{
						"firstName": "",
						"lastName": "李宗諭",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邱皓政",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "蘇宜芬",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2025-03",
				"abstractNote": "本研究以縱貫方法，探討青年在 25 歲、30 歲、33 歲三個時間點的生涯發展過程中，學用相符、 工作滿意及快樂感的關聯，並將高中職階段的教育分流（普通類、技職類）及相關預測變項納入 模型。分析資料來自臺灣教育長期追蹤資料庫（TEPS）及其後續調查資料庫（TEPS-B）的 SH 樣 本，共 1,637 人，以隨機截距交叉滯後模型（RI-CLPM）為分析方法。結果顯示，臺灣青年的學 用相符、工作滿意度及快樂感三者成正相關。在滯後效果方面，三波次間的學用相符及快樂感有 自回歸效果，工作滿意度則僅在後二波有自回歸效果；而除了 30 歲的快樂感能正向預測 33 歲的 工作滿意度，其餘交叉滯後效果皆未顯著。在預測變項方面，學歷對三個主要變項皆有正向預測 力；高三時後悔所選組科別對後來生涯的工作滿意度及快樂感有負向預測力。整體而言，教育分 流的調節作並不明顯，僅 25 歲到 30 歲間的少數路徑有差異；在二種教育分流各別樣本模型中， 發現高三時後悔所選科別對技職分流者的工作滿意度及快樂感有負向預測力，而生涯嘗試對普通 分流者的學用相符有正向預測力。最後，提供未來研究與實務建議。",
				"extra": "original-title: Longitudinal Relationships among Educational Tracking, Job-Education Match, Job Satisfaction, and Happiness of Taiwan Youth\noriginal-container-title: Bulletin of Educational Psychology\noriginal-author: Li || Tsung-Yu\noriginal-author: Chiou || Haw-Jeng\noriginal-author: Su || Yi-Fen\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"李宗諭\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Tsung-Yu\",\"lastName\":\"Li\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"邱皓政\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Haw-Jeng\",\"lastName\":\"Chiou\",\"creatorType\":\"author\"}},{\"firstName\":\"\",\"lastName\":\"蘇宜芬\",\"creatorType\":\"author\",\"fieldMode\":1,\"original\":{\"firstName\":\"Yi-Fen\",\"lastName\":\"Su\",\"creatorType\":\"author\"}}]",
				"issue": "3",
				"language": "zh-TW",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "599-630",
				"publicationTitle": "教育心理學報",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f9961ac13801961e97fa1601ae",
				"volume": "56",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					{
						"tag": "educational tracking"
					},
					{
						"tag": "happiness"
					},
					{
						"tag": "job satisfaction"
					},
					{
						"tag": "job-education match"
					},
					{
						"tag": "youth"
					},
					{
						"tag": "交叉延宕"
					},
					{
						"tag": "學用落差"
					},
					{
						"tag": "縱貫研究"
					},
					{
						"tag": "青年職涯"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99584be0601958d748349051e",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "CSR as a framework for sustainability in SMEs: The relationship between company size, industrial sector, and triple bottom line activities",
				"creators": [
					{
						"firstName": "Zdeněk",
						"lastName": "Caha",
						"creatorType": "author"
					},
					{
						"firstName": "Renata",
						"lastName": "Skýpalová",
						"creatorType": "author"
					},
					{
						"firstName": "Tomáš",
						"lastName": "Mrhálek",
						"creatorType": "author"
					}
				],
				"date": "2024-12",
				"extra": "original-container-title: Asia Pacific Management Review",
				"issue": "4",
				"language": "en-US",
				"libraryCatalog": "臺灣學術期刊開放取用平台",
				"pages": "451-461",
				"shortTitle": "CSR as a framework for sustainability in SMEs",
				"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/article/4b1141f99584be0601958d748349051e",
				"volume": "29",
				"attachments": [],
				"tags": [
					{
						"tag": "3BL"
					},
					{
						"tag": "Company size"
					},
					{
						"tag": "Corporate social responsibility CSR activity"
					},
					{
						"tag": "Industrial sector"
					},
					{
						"tag": "SMEs"
					},
					{
						"tag": "TBL"
					},
					{
						"tag": "Triple bottom line"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/search?queryText=%E4%B8%80%E5%80%8B%E4%B8%AD%E5%9C%8B",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://toaj.stpi.niar.org.tw/index/journal/volume/4b1141f99035f52901906a85c6f30dcf",
		"items": "multiple"
	}
]
/** END TEST CASES **/

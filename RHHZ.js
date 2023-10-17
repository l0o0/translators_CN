{
	"translatorID": "3b4e0da7-d9b2-41e8-b4d3-38701241b872",
	"label": "RHHZ",
	"creator": "jiaojiaodubai23",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-10-17 07:01:33"
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
	let insite = doc.querySelector('div[class*="foot"] p > a[href*="www.rhhz.net"]');
	let itemID = doc.querySelector('meta[name="citation_id"]');
	if (insite && itemID) {
		return 'journalArticle';
	}
	else if (insite && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('div.article-list-title a:first-of-type');
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
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

function matchCreator(creator) {
	// Z.debug(creator);
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

async function scrape(doc, url = doc.location.href) {
	let translator = Zotero.loadTranslator('web');
	var pdfURL = '';
	let pdfButton = doc.querySelector('div.pdfView');
	let socallURL = doc.querySelector('head > meta[name="citation_pdf_url"]').content;
	if (socallURL.endsWith('.pdf')) {
		pdfURL = socallURL;
	}
	else if (pdfButton) {
		pdfURL = pdfButton.parentElement.href;
	} else {
		let id = doc.querySelector('head > meta[name="citation_id"]').content;
		let host = (new URL(url)).host;
		pdfURL = `${url.split('//')[0]}//${host}/article/exportPdf?id=${id}`
	}
	Z.debug(pdfURL);
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		item.creators = item.creators.map((creator) => (matchCreator(creator.lastName)));
		item.language = (item.language == 'zh') ? 'zh-CN' : 'en-US';
		item.attachments = [
			{
				url: pdfURL,
				title: "Full Text PDF",
				mimeType: "application/pdf"
			}
		];
		item.attachments.push({
			url: url,
			document: doc,
			title: 'Snapshot',
			mimeType: 'text/html'
		})
		item.complete();
	});
	let em = await translator.getTranslatorObject();
	em.itemType = 'journalArticle';
	await em.doWeb(doc, url);
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.hjbhkx.cn/article/doi/10.16803/j.cnki.issn.1004-6216.202307018",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "面向生态环境科技成果转化的产业基金研究及实践案例分析",
				"creators": [
					{
						"lastName": "曹茜",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "周雯",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "魏东洋",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "段丽杰",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "洪曼",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "2023-08-20",
				"DOI": "10.16803/j.cnki.issn.1004-6216.202307018",
				"ISSN": "1004-6216",
				"abstractNote": "生态环境科技专项产生了一大批高水准的生态环境科研成果以及专业技术，但这些成果都停留在科学阶段，尚未形成产品，发挥社会价值。目前，国内外已经有很多成功的生态环境产业基金，如美国的清洁水州周转基金和国内的深圳清华大学研究院的力合科创投资孵化基金以及南京扬子江生态文明创新中心的源创基金，可以作为研究案例。文章选取国际国内代表性的运营多年和新兴的产业基金案例，分析生态环境产业基金在产业化过程中发挥的作用，结合调研内容总结产业基金运行模式的特点，根据先进经验提出针对我国生态环境产业基金运行主要存在问题的相关建议。",
				"issue": "4",
				"language": "zh-CN",
				"libraryCatalog": "www.hjbhkx.cn",
				"pages": "1-8",
				"publicationTitle": "环境保护科学",
				"rights": "http://creativecommons.org/licenses/by/3.0/",
				"url": "http://hjbh.cbpt.cnki.net//article/doi/10.16803/j.cnki.issn.1004-6216.202307018",
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
						"tag": "产业基金"
					},
					{
						"tag": "成果转化"
					},
					{
						"tag": "案例研究"
					},
					{
						"tag": "生态环境"
					},
					{
						"tag": "科技金融"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.lczcyj.com/cn/article/doi/10.12344/lczcyj.2023.01.10.0003",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "宁夏退耕还林还草成果巩固问题探讨",
				"creators": [
					{
						"lastName": "王治啸",
						"creatorType": "author",
						"fieldMode": true
					},
					{
						"lastName": "高红军",
						"creatorType": "author",
						"fieldMode": true
					}
				],
				"date": "2023-03-30",
				"DOI": "10.12344/lczcyj.2023.01.10.0003",
				"ISSN": "2096-9546",
				"abstractNote": "退耕还林还草是中共中央、国务院在20世纪末着眼中华民族长远发展和国家生态安全作出的重大决策。23年来的退耕还林还草工程实践取得了巨大的生态、经济和社会效益,赢得了社会各界赞誉。\"十四五\"以来,国家基于粮食安全和耕地保护考虑,已将工程重心转移到巩固已有建设成果上来。文中基于宁夏回族自治区退耕还林还草工程现状,总结退耕还林还草成果巩固的经验做法,梳理分析现存问题,并提出今后推动退耕还林还草高质量发展的建议:1)深挖后续产业发展潜力,促进\"以林养林\";2)合理优化退耕林地树种组成和植被配置模式,改善退耕林质量;3)提高生态效益补偿标准;4)稳定基层管理队伍。",
				"issue": "1",
				"journalAbbreviation": "lczcyj",
				"language": "zh-CN",
				"libraryCatalog": "www.lczcyj.com",
				"pages": "18-23",
				"publicationTitle": "林草政策研究",
				"rights": "http://creativecommons.org/licenses/by/3.0/",
				"url": "http://www.lczcyj.com/cn/article/doi/10.12344/lczcyj.2023.01.10.0003",
				"volume": "3",
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
						"tag": "宁夏回族自治区"
					},
					{
						"tag": "成果巩固"
					},
					{
						"tag": "生态补偿机制"
					},
					{
						"tag": "退耕还林还草"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.yndxxb.ynu.edu.cn/yndxxbzrkxb/",
		"items": "multiple"
	}
]
/** END TEST CASES **/

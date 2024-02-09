{
	"translatorID": "3b4e0da7-d9b2-41e8-b4d3-38701241b872",
	"label": "RHHZ",
	"creator": "jiaojiaodubai23",
	"target": "",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 150,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-02 15:55:53"
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


function detectWeb(doc, _url) {
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

async function scrape(doc, url = doc.location.href) {
	let translator = Zotero.loadTranslator('web');
	var pdfURL = '';
	let pdfButton = doc.querySelector('div.pdfView');
	let socallURL = attr(doc, 'head > meta[name="citation_pdf_url"]', 'content');
	if (socallURL.endsWith('.pdf')) {
		pdfURL = socallURL;
	}
	else if (pdfButton) {
		pdfURL = pdfButton.parentElement.href;
	}
	else {
		let id = attr(doc, 'head > meta[name="citation_id"]', 'content');
		let host = (new URL(url)).host;
		pdfURL = `${url.split('//')[0]}//${host}/article/exportPdf?id=${id}`;
	}
	Z.debug(pdfURL);
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);
	translator.setHandler('itemDone', (_obj, item) => {
		item.creators = item.creators.map(creator => (matchCreator(creator.lastName)));
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
			title: "Snapshot",
			mimeType: "text/html"
		});
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
		"url": "https://www.hplpb.com.cn/cn/article/doi/10.11884/HPLPB202335.230046",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "抗弯曲大模场面积少模光子晶体光纤",
				"creators": [
					{
						"lastName": "解国兴",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "谭芳",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "张云龙",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "高斌豪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "崔顺发",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "穆伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "朱先和",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-15",
				"DOI": "10.11884/HPLPB202335.230046",
				"ISSN": "1001-4322",
				"abstractNote": "为更好地解决少模光纤在传输中由于模式耦合过强而导致的信号串扰问题，对弱耦合光子晶体光纤中的线偏振（LP）模式以及矢量模的传输特性进行了研究，设计了一种可传输20种矢量模的双包层光子晶体光纤。通过有限元法模拟光纤参数对相邻LP模式间最小有效折射率差的影响，优化结构参数，使光纤支持稳定传输6种LP模式并满足弱耦合要求。最后分析了不同模式的有效模场面积、弯曲损耗。结果表明：各模式之间的最小有效折射率差达到1.12×10<sup>−4</sup>，表明模式间的串扰可忽略。基模有效模场面积达到了1040 μm<sup>2</sup>，且其相应的非线性系数低至1.07×10<sup>−10</sup>。此外，在弯曲半径为38 mm时，各模式弯曲损耗最大仅为5.65×10<sup>−8</sup> dB/km。与主流的单模光纤及少模单包层相比，该结构具有大模场面积，低模间串扰及更强的抗弯曲能力，丰富了空分复用技术的开发思路。在大数据、虚拟现实、网络传输容量等新兴业务以及光纤传感方面提供了有益的参考方案。",
				"issue": "12",
				"journalAbbreviation": "qjgylzs",
				"language": "zh-CN",
				"libraryCatalog": "www.hplpb.com.cn",
				"pages": "121002-7",
				"publicationTitle": "强激光与粒子束",
				"rights": "http://creativecommons.org/licenses/by/3.0/",
				"url": "https://www.hplpb.com.cn/cn/article/doi/10.11884/HPLPB202335.230046",
				"volume": "35",
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
						"tag": "光子晶体光纤"
					},
					{
						"tag": "大模场面积"
					},
					{
						"tag": "弱耦合少模"
					},
					{
						"tag": "抗弯曲"
					},
					{
						"tag": "空分复用技术"
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
						"fieldMode": 1
					},
					{
						"lastName": "高红军",
						"creatorType": "author",
						"fieldMode": 1
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

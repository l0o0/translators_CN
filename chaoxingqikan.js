{
	"translatorID": "f7c9342d-3672-4899-b315-3d09ac1b38a8",
	"label": "chaoxingqikan",
	"creator": "jiaojiaodubai23",
	"target": "^https?://qikan\\.chaoxing\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-14 17:18:27"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 YOUR_NAME <- TODO

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
	Z.debug('---------- chaoxingqikj.js 2023-12-15 01:07:54 ----------');
	if (url.includes('/detail_')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#zhaiyaoDivId > div > dl > dt > a');
	for (let row of rows) {
		let href = row.href;
		let title = ZU.trimInternal(row.title);
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

async function scrape(doc, url = doc.location.href) {
	var newItem = new Z.Item('journalArticle');
	newItem.extra = '';
	newItem.title = attr(doc, '#articleTitle', 'value');
	newItem.abstractNote = text(doc, '#generateCatalog_0');
	newItem.publicationTitle = text(doc, 'a.jourName').replace(/^《|》$/g, '');
	let labels = new Labels(doc, '[class^="Fmian"] tr, #generateCatalog_1, #other > p');
	Z.debug(labels.innerData.map(arr => [arr[0], arr[1].innerText]));
	let pubInfo = labels.getWith('来源');
	Z.debug(pubInfo);
	newItem.volume = tryMatch(attr(doc, '#GBTInputId', 'value'), /第(\d+)卷/, 1);
	newItem.issue = tryMatch(pubInfo, /(\d+)期/, 1);
	newItem.pages = tryMatch(pubInfo, /([\d-,+]*)$/, 1);
	newItem.date = tryMatch(pubInfo, /(\d+)年/, 1);
	newItem.DOI = labels.getWith('DOI');
	newItem.url = url;
	let creators = text(doc, 'p.F_name').split(/[\d,;，；]\s*/);
	creators.forEach((creator) => {
		newItem.creators.push(ZU.cleanAuthor(creator, 'author'));
	});
	newItem.creators.forEach((element) => {
		if (/[\u4e00-\u9fa5]/.test(element.lastName)) {
			element.fieldMode = 1;
		}
	});
	let tags = labels.getWith('关键词').split(/[,;，；]/);
	tags.forEach((tag) => {
		newItem.tags.push(tag);
	});
	newItem.extra = addExtra('titleTranslation', text(doc, '.title_translate'));
	try {
		let journalDoc = await requestDocument(attr(doc, 'div[class^="sTopImg"] > p:first-of-type > a', 'href'));
		let labels = new Labels(journalDoc, '.FbPcon > p, .FbPcon > div > div');
		newItem.language = {
			中文: 'zh-CN',
			英文: 'en-US'
		}[labels.getWith('语言')];
		newItem.ISSN = labels.getWith('ISSN');
	}
	catch (error) {
		Z.debug('some error occured while geting journalDoc');
	}
	let pdfLink = attr(doc, 'a[class*="pdf-down"]', 'href');
	Z.debug(pdfLink);
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/* Util */
class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
				this.innerData.push([key, elementCopy]);
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(element => this.getWith(element))
				.filter(element => element);
			return result.length
				? result.find(element => element)
				: '';
		}
		let pattern = new RegExp(label);
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
			: '';
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://qikan.chaoxing.com/searchjour?sw=%E9%87%8F%E5%AD%90%E5%8A%9B%E5%AD%A6&size=50&x=0_646",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://qikan.chaoxing.com/detail_38502727e7500f263a85bd7ab02fcce7f45d0936666427011921b0a3ea255101fc1cf1fbb4666ae6b3d8bb7c40980615f75d1dedbca8bf1556c8add879a320654132304f5496fb7010bc92a6ec065159",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "410 t/h燃煤电站高温除尘技术试验研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "司桐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王春波",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈亮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "任育杰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "任福春",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.19805/j.cnki.jcspe.2023.07.003",
				"ISSN": "1674-7607",
				"abstractNote": "摘 要：针对燃煤电站SCR脱硝技术中高浓度飞灰造成的催化剂使用寿命缩短、大量氨逃逸及空气预热器堵灰的问题,将高温除尘器布置在SCR反应器之前。在410 t/h燃煤锅炉上对高温除尘技术进行了工程示范研究,分析了高温除尘器的除尘特性对下游脱硝单元和空气预热器性能的影响。结果表明:在70%和90%锅炉负荷下,高温除尘器出口烟尘平均质量浓度均小于8 mg/m3;90%负荷下,烟气流经高温除尘器的压降仅为500 Pa左右,大幅低于传统布袋除尘器的烟气压降;与典型的超低排放烟气后处理技术相比,应用高温除尘器能实现在相同脱硝效率下显著降低SCR反应器的烟气压降,并能减少相应的气氨消耗量与氨逃逸量;与常规布置布袋除尘器的锅炉环保岛相比,高温除尘器+SCR脱硝单元+空气预热器的模块的烟气压降可降低约500 Pa。",
				"extra": "titleTranslation: Experimental Research of High Temperature Dust Removal Technology in a 410 t/h Coal-fired Power Station",
				"issue": "7",
				"language": "zh-CN",
				"libraryCatalog": "chaoxingqikan",
				"pages": "829-834",
				"publicationTitle": "动力工程学报",
				"url": "https://qikan.chaoxing.com/detail_38502727e7500f263a85bd7ab02fcce7f45d0936666427011921b0a3ea255101fc1cf1fbb4666ae6b3d8bb7c40980615f75d1dedbca8bf1556c8add879a320654132304f5496fb7010bc92a6ec065159",
				"volume": "43",
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
						"tag": " 压降"
					},
					{
						"tag": " 烟尘"
					},
					{
						"tag": " 能耗"
					},
					{
						"tag": " 高温除尘"
					},
					{
						"tag": "空气预热器"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://qikan.chaoxing.com/detail_38502727e7500f26ca0861a3adbe5e606a145e816f7b417b1921b0a3ea255101fc1cf1fbb4666ae63e6eb506682179a64e4da1f03d3b11a394230ac99639719849c21da7b26113148a360c694190388d",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "重庆市小水电退出机制研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "肖妮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "金华频",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"DOI": "10.16232/j.cnki.1001-4179.2023.04.005",
				"ISSN": "1001-4179",
				"abstractNote": "摘要：为引导重庆市部分老旧或有用水纠纷的小水电有序退出,缓解水资源利用矛盾,开展了小水电退出机制研究。在总结国内外小水电退出现状的基础上,基于重庆市老旧小水电调研成果,结合该市实际情况,提出了小水电退出衡量指标、退出方式、奖补标准(市场法、收益法、重置成本法、推荐测算法)、退出程序等。分析认为小水电退出工作应做好科学论证、综合评估,社会风险防控,宣传指导,后评估等4个方面工作,从而确保退出工作平稳有序推进。研究成果可为重庆市小水电退出政策制定提供参考。",
				"extra": "titleTranslation: Withdrawal mechanism of small hydropower in Chongqing City",
				"issue": "4",
				"language": "zh-CN",
				"libraryCatalog": "chaoxingqikan",
				"pages": "30-35",
				"publicationTitle": "人民长江",
				"url": "https://qikan.chaoxing.com/detail_38502727e7500f26ca0861a3adbe5e606a145e816f7b417b1921b0a3ea255101fc1cf1fbb4666ae63e6eb506682179a64e4da1f03d3b11a394230ac99639719849c21da7b26113148a360c694190388d",
				"volume": "54",
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
						"tag": " 奖补标准"
					},
					{
						"tag": " 报废退出"
					},
					{
						"tag": " 退出机制"
					},
					{
						"tag": " 重庆市"
					},
					{
						"tag": "小水电"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

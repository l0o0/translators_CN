{
	"translatorID": "7ffde69e-dd36-4158-98bf-2c3b5ba026e3",
	"label": "China Judgements Online",
	"creator": "Zeping Lee",
	"target": "^https?://wenshu\\.court\\.gov\\.cn/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-14 23:05:19"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 Zeping Lee

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
	if (url.includes('/181107ANFZ0BXSK4/')) {
		return 'case';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.LM_list h4 > a.caseName[href*="/181107ANFZ0BXSK4/"]');
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

async function scrape(doc, url = doc.location.href) {
	var newItem = new Zotero.Item('case');
	newItem.extra = '';
	let labels = new Labels(doc, '.gaiyao_box h4');
	let pdfTitle = text(doc, '.PDF_title');
	let caseType = tryMatch(pdfTitle, /(刑事|民事|行政)/)
		|| labels.getWith('案件类型').replace(/案件$/, '');
	let caseName = pdfTitle
			.replace(/(一审|二审|再审).*?$/, '')
			.replace(/一案$/, '案')
			.replace('与', '诉')
			.replace('其他', labels.getWith('案由'));
	newItem.caseName = `${caseName}${caseName.endsWith('案') ? '' : '案'}`;
	newItem.court = labels.getWith('审理法院');
	newItem.dateDecided = labels.getWith('裁判日期');
	newItem.docketNumber = text(doc, '#ahdiv');
	let docType = `${caseType}${tryMatch(pdfTitle, /(判决书|裁定书|调解书|决定书|通知书|令)$/)}`;
	newItem.extra += addExtra('type', docType);
	newItem.url = url;
	newItem.language = 'zh-CN';
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
		"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=8uT/bLVGgtGbCEfXD1fGwRjonlu27L7bE9KWzYhQhrN5Pz5TEm1FHZO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PELWUlJ6s2F5fFuFZdL2RpR",
		"items": [
			{
				"itemType": "case",
				"caseName": "胡令国开设赌场案",
				"creators": [],
				"dateDecided": "2023-06-13",
				"court": "南昌高新技术产业开发区人民法院",
				"docketNumber": "（2023）赣0191刑初162号",
				"extra": "type: 刑事判决书",
				"language": "zh-CN",
				"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=8uT/bLVGgtGbCEfXD1fGwRjonlu27L7bE9KWzYhQhrN5Pz5TEm1FHZO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PELWUlJ6s2F5fFuFZdL2RpR",
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
		"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=jE7iRRnAuVjEio1Wd3wtu9OjiYZqvBTqqfB43om8Hn6ThtwkCS4jSZO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PEPvebusFpLSzxHNLTvyVXc",
		"items": [
			{
				"itemType": "case",
				"caseName": "田永诉北京科技大学教育行政管理（教育）案",
				"creators": [],
				"dateDecided": "1999-04-26",
				"court": "北京市第一中级人民法院",
				"docketNumber": "（1999）一中行终字第73号",
				"extra": "type: 行政判决书",
				"language": "zh-CN",
				"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=jE7iRRnAuVjEio1Wd3wtu9OjiYZqvBTqqfB43om8Hn6ThtwkCS4jSZO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PEPvebusFpLSzxHNLTvyVXc",
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
		"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=yBQdAKheX74FetbBCY9HbwUbrqcXhlxmT1vIZPOsOruWb+MBWQW0jpO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PGszuyelsyjUPc+SGKerqMp",
		"items": [
			{
				"itemType": "case",
				"caseName": "榆林市凯奇莱能源投资有限公司诉榆林市工商行政管理局案",
				"creators": [],
				"dateDecided": "2017-07-31",
				"court": "陕西省榆林市中级人民法院",
				"docketNumber": "（2017）陕赔辖1号",
				"extra": "type: 行政裁定书",
				"language": "zh-CN",
				"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=yBQdAKheX74FetbBCY9HbwUbrqcXhlxmT1vIZPOsOruWb+MBWQW0jpO3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PGszuyelsyjUPc+SGKerqMp",
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
		"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=h7gy3em4cb/nEfjW7sMKRpH1M7o33PzGR5xc9mCW/4wvTIXG95ra/5O3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PELWUlJ6s2F5fFuFZdL2RpR",
		"items": [
			{
				"itemType": "case",
				"caseName": "马玉刚、马玉行、马玉营、王恩荣诉马君真、马玉林、马玉建、胡昌成土地承包经营权转让合同纠纷案",
				"creators": [],
				"dateDecided": "2013-09-10",
				"court": "山东省济宁市中级人民法院",
				"docketNumber": "（2013）济民终字第567号",
				"extra": "type: 民事判决书",
				"language": "zh-CN",
				"url": "https://wenshu.court.gov.cn/website/wenshu/181107ANFZ0BXSK4/index.html?docId=h7gy3em4cb/nEfjW7sMKRpH1M7o33PzGR5xc9mCW/4wvTIXG95ra/5O3qNaLMqsJrtmSoLGZMrRbw4YYlPxcEO55A1guaDK+t4Hw4I001PELWUlJ6s2F5fFuFZdL2RpR",
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
	}
]
/** END TEST CASES **/

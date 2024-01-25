{
	"translatorID": "cd01cf63-90ba-42b4-a505-74d8d14f79d6",
	"label": "National Public Service Platform for Standards Information - China",
	"creator": "Zeping Lee, rnicrosoft",
	"target": "https?://(std\\.samr\\.gov\\.cn/)|(.bba\\.sacinfo\\.org\\.cn)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-25 19:45:20"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 Zeping Lee

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
	if (url.includes('Detail')) {
		return 'standard';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// 依赖浏览器环境
	var rows = doc.querySelectorAll('.s-title td > a');
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
	var newItem = new Z.Item('standard');
	let labels = new CellLabels(doc.querySelector('.basic-info'), 'dl > .basicInfo-item');
	Z.debug(labels.innerData.map(arr => [arr[0], arr[1].innerText]));
	newItem.title = url.includes('/gj/')
		? text(doc, '.page-header+p')
		// 有时会在标题处塞进来一些额外的元素（如附件）
		: text(doc, '.page-header > h4').split('\n')[0];
	newItem.extra = '';
	newItem.number = labels.getWith('标准号').replace('-', '—');
	newItem.type = text(doc, '.label-info');
	newItem.status = text(doc, '.label-primary');
	newItem.date = labels.getWith(['发布日期', '实施日期']);
	newItem.url = url;
	newItem.language = /en/i.test(labels.getWith('标准语言'))
		? 'en-US'
		: 'zh-CN';
	newItem.libraryCatalog = '全国标准信息公共服务平台';
	newItem.extra += addExtra('applyDate', labels.getWith('实施日期'));
	newItem.extra += addExtra('substitute', labels.getWith('代替标准').replace(/-/g, '—'));
	newItem.extra += addExtra('CCS', labels.getWith('中国标准分类号'));
	newItem.extra += addExtra('ICS', labels.getWith('国际标准分类号'));
	newItem.extra += addExtra('industry', labels.getWith('行业分类'));
	labels.getWith(['归口单位', '归口部门', '技术归口', '标准发布组织']).split('、').forEach((creator) => {
		newItem.creators.push({
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		});
	});
	let pdfLink = doc.querySelector('.page-header a[href*="/attachment/"]');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
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

class CellLabels {
	constructor(doc, selector) {
		this.innerData = [];
		let cells = Array.from(doc.querySelectorAll(selector)).filter(element => !element.querySelector(selector));
		let i = 0;
		while (cells[i + 1]) {
			this.innerData.push([cells[i].textContent.replace(/\s*/g, ''), cells[i + 1]]);
			i += 2;
		}
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
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

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D8055ED3A7E05397BE0A0AB82A",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献  参考文献著录规则",
				"creators": [
					{
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"extra": "applyDate: 2015-12-01\nsubstitute: GB/T 7714—2005\nCCS: A14\nICS: 01.140.20",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "GB/T 7714—2015",
				"status": "现行",
				"type": "国家标准",
				"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D8055ED3A7E05397BE0A0AB82A",
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
		"url": "https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F23645BB19E05397BE0A0AB44A",
		"items": [
			{
				"itemType": "standard",
				"title": "中文出版物夹用英文的编辑规范",
				"creators": [
					{
						"lastName": "全国新闻出版标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-04-17",
				"extra": "applyDate: 2017-04-17\nCCS: A19\nICS: 01.140.40\nindustry: 文化、体育和娱乐业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "CY/T 154—2017",
				"status": "现行",
				"type": "行业标准-CY 新闻出版",
				"url": "https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F23645BB19E05397BE0A0AB44A",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=3E25D6F98CDEEE0578BCF0333B17EECF",
		"items": [
			{
				"itemType": "standard",
				"title": "Information and documentation — Guidelines for bibliographic references and citations to information resources",
				"creators": [
					{
						"lastName": "ISO",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-06-11",
				"language": "en-US",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "ISO 690:2021",
				"status": "现行",
				"type": "国际标准",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=3E25D6F98CDEEE0578BCF0333B17EECF",
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
		"url": "https://hbba.sacinfo.org.cn/stdDetail/a3762eff26b8f60e95d5e8b48684b8ef7c07e693e998d3f871f4fd1b63e71e65",
		"items": [
			{
				"itemType": "standard",
				"title": "事故汽车修复技术规范",
				"creators": [
					{
						"lastName": "全国汽车维修标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-11-24",
				"extra": "applyDate: 2024-03-01\nsubstitute: JT/T 795—2011\nCCS: R16\nICS: 43.18\nindustry: 交通运输、仓储和邮政业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "JT/T 795—2023",
				"status": "现行",
				"type": "交通",
				"url": "https://hbba.sacinfo.org.cn/stdDetail/a3762eff26b8f60e95d5e8b48684b8ef7c07e693e998d3f871f4fd1b63e71e65",
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
		"url": "https://dbba.sacinfo.org.cn/stdDetail/55959ea756314d917a5749c3abdd01bf7dc2a23593f3d83e1da0c582c894fb2a",
		"items": [
			{
				"itemType": "standard",
				"title": "地理标志产品  黄陵翡翠梨",
				"creators": [],
				"date": "2023-08-07",
				"extra": "applyDate: 2023-09-06\nCCS: B31\nICS: 67.080.10\nindustry: 农、林、牧、渔业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "DB6106/T 209—2023",
				"status": "现行",
				"type": "延安市",
				"url": "https://dbba.sacinfo.org.cn/stdDetail/55959ea756314d917a5749c3abdd01bf7dc2a23593f3d83e1da0c582c894fb2a",
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
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

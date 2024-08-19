{
	"translatorID": "cc6b64f5-5352-40ea-9196-d154cbb00d9a",
	"label": "National Standards Open System - China",
	"creator": "Zeping Lee, rnicrosoft",
	"target": "https?://openstd\\.samr\\.gov\\.cn/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-29 11:33:52"
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
	if (url.includes('hcno=')) {
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
	var rows = doc.querySelectorAll('.mytxt > a');
	for (let row of rows) {
		let hcno = tryMatch(row.getAttribute('onclick'), /'(\w+)'/, 1);
		let title = ZU.trimInternal(row.textContent);
		if (!hcno || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[`https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=${hcno}`] = title;
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
	var newItem = new Zotero.Item('standard');
	newItem.extra = '';
	let labels = new Cells(doc, '.row div.col-xs-12');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let textLabels = new TextLabels(doc, '.container table:nth-child(2)');
	Z.debug(textLabels.innerData);
	newItem.title = textLabels.getWith('中文标准名称');
	newItem.number = tryMatch(text(doc, 'td > h1'), /：([\w /-]+)/, 1).replace('-', '—');
	newItem.status = textLabels.getWith('标准状态').split(' ')[0];
	newItem.date = labels.get(['发布日期', '实施日期']);
	newItem.url = url;
	newItem.language = 'zh-CN';
	newItem.libraryCatalog = '国家标准全文公开系统';
	newItem.extra += addExtra('original-title', textLabels.getWith('英文标准名称'));
	newItem.extra += addExtra('CCS', labels.get('CCS'));
	newItem.extra += addExtra('ICS', labels.get('ICS'));
	newItem.extra += addExtra('applyDate', labels.get('实施日期'));
	newItem.creators.push({
		firstName: '',
		lastName: labels.get(['归口部门', '主管部门']),
		creatorType: 'author',
		fieldMode: 1
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

class Cells {
	constructor(doc, selector) {
		this.emptyElm = doc.createElement('div');
		this.data = [];
		const cells = Array.from(doc.querySelectorAll(selector)).filter(element => !element.querySelector(selector));
		let i = 0;
		while (cells[i + 1]) {
			this.data.push([cells[i].textContent.replace(/\s*/g, ''), cells[i + 1]]);
			i += 2;
		}
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.get(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label);
		const keyValPair = this.data.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : this.emptyElm;
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
			: '';
	}
}

class TextLabels {
	constructor(doc, selector) {
		// innerText在详情页表现良好，但在多条目表现欠佳，故统一使用经过处理的text
		this.innerData = text(doc, selector)
			.replace(/^[\s\n]*/gm, '')
			.replace(/:\n/g, ': ')
			.replace(/\n([^】\]:：]+?\n)/g, ' $1')
			.split('\n')
			.map(keyVal => [
				tryMatch(keyVal, /^[[【]?([\s\S]+?)[】\]:：]\s*[\s\S]+$/, 1).replace(/\s/g, ''),
				tryMatch(keyVal, /^[[【]?[\s\S]+?[】\]:：]\s*([\s\S]+)$/, 1)
			]);
	}

	getWith(label) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel))
				.find(value => value);
			return result
				? result
				: '';
		}
		let pattern = new RegExp(label);
		let keyVal = this.innerData.find(element => pattern.test(element[0]));
		return keyVal
			? ZU.trimInternal(keyVal[1])
			: '';
	}
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=ADAA308A0BE559EC29E773B71591F463",
		"items": [
			{
				"itemType": "standard",
				"title": "国际单位制及其应用",
				"creators": [
					{
						"firstName": "",
						"lastName": "国家市场监督管理总局",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1993-07-01",
				"extra": "original-title: SI units and recommendations for the use of theirmultiples and of certain other units\nCCS: A51\napplyDate: 1994-07-01",
				"language": "zh-CN",
				"libraryCatalog": "国家标准全文公开系统",
				"number": "GB 3100—1993",
				"status": "现行",
				"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=ADAA308A0BE559EC29E773B71591F463",
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
		"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=7FA63E9BBA56E60471AEDAEBDE44B14C",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献 参考文献著录规则",
				"creators": [
					{
						"firstName": "",
						"lastName": "国家标准化管理委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"extra": "original-title: Information and documentation—Rules for bibliographic references and citations to information resources\nCCS: A14\nICS: 01.140.20\napplyDate: 2015-12-01",
				"language": "zh-CN",
				"libraryCatalog": "国家标准全文公开系统",
				"number": "GB/T 7714—2015",
				"status": "现行",
				"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=7FA63E9BBA56E60471AEDAEBDE44B14C",
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
		"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=38E0F18A7D25ECAA7257073408F63277",
		"items": [
			{
				"itemType": "standard",
				"title": "月球与行星原位探测相机通用规范",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国科学院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-11-27",
				"extra": "original-title: General specification of lunar and planetary in-situ exploration camera\nCCS: N38\nICS: 17.180.01\napplyDate: 2023-11-27",
				"language": "zh-CN",
				"libraryCatalog": "国家标准全文公开系统",
				"number": "GB/Z 43082—2023",
				"status": "现行",
				"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=38E0F18A7D25ECAA7257073408F63277",
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
		"url": "https://openstd.samr.gov.cn/bzgk/gb/std_list_type?p.p1=1&p.p90=circulation_date&p.p91=desc",
		"items": "multiple"
	}
]
/** END TEST CASES **/

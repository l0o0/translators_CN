{
	"translatorID": "cc6b64f5-5352-40ea-9196-d154cbb00d9a",
	"label": "National Standards Open System - China",
	"creator": "Zeping Lee",
	"target": "https?://openstd\\.samr\\.gov\\.cn/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2022-10-18 13:36:12"
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

function detectWeb(_doc, _url) {
	return 'report';
}

function doWeb(doc, url) {
	var item = new Zotero.Item('report');

	item.language = 'zh-CN';
	item.url = url;
	item.libraryCatalog = '国家标准全文公开系统';
	item.extra = 'Type: standard';

	item.reportNumber = doc.querySelector('title').textContent.split('|')[1].replace('-', '—');

	for (let td of doc.querySelectorAll('.tdlist td')) {
		let parts = td.textContent.split('：', 2);
		if (parts.length === 2) {
			let field = parts[0];
			let value = parts[1].trim();
			if (field === '中文标准名称') {
				item.title = value;
				break;
			}
		}
	}

	let fields = doc.querySelectorAll('.row .title');
	let values = doc.querySelectorAll('.row .content');

	for (var i = 0; i < fields.length; ++i) {
		let field = fields[i].textContent.trim();
		let value = values[i].textContent.trim();

		if (value.length === 0) {
			continue;
		}

		switch (field) {
			case '发布日期':
				item.date = value;
				break;
			case '实施日期':
				if (!item.date || item.date.length === 0) {
					item.date = value;
				}
				break;
			case '归口部门':
			// case '归口单位':
				for (var institute of value.split('、')) {
					item.creators.push({
						lastName: institute,
						creatorType: 'author',
						fieldMode: 1
					});
				}
				break;
			default:
				break;
		}
	}

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=ADAA308A0BE559EC29E773B71591F463",
		"items": [
			{
				"itemType": "report",
				"title": "国际单位制及其应用",
				"creators": [
					{
						"lastName": "国家市场监督管理总局",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1993-07-01",
				"extra": "Type: standard",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "GB 3100—1993",
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
				"itemType": "report",
				"title": "信息与文献  参考文献著录规则",
				"creators": [
					{
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"extra": "Type: standard",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "GB/T 7714—2015",
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
	}
]
/** END TEST CASES **/

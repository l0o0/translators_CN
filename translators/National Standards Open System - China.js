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
	"lastUpdated": "2023-06-27 17:01:40"
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

function addExtra(newItem, extra) {
	newItem.extra = (newItem.extra ? newItem.extra + "\n" : "") + extra[0].trim().replace(/[：:]$/, '') + ": " + extra.slice(1).join('; ');
}

function detectWeb(_doc, _url) {
	return 'standard';
}

function doWeb(doc, url) {
	var item = new Zotero.Item('standard');

	item.language = 'zh-CN';
	item.url = url;
	item.libraryCatalog = '国家标准全文公开系统';

	item.number = doc.querySelector('title').textContent.split('|')[1].replace('-', '—');

	for (let td of doc.querySelectorAll('.tdlist td')) {
		let parts = td.textContent.split('：', 2);
		if (parts.length === 2) {
			let field = parts[0];
			let value = parts[1].trim();
			switch (field) {
				case '中文标准名称':
					item.title = value;
					break;
				case '标准状态':
					item.status = value;
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
				} else {
					addExtra(item, [field, value]);
				}
				break;
			case '归口部门':
				for (var institute of value.split('、')) {
					item.creators.push({
						lastName: institute,
						creatorType: 'author',
						fieldMode: 1
					});
				}
				break;
			case '发布单位':
				item.publisher = value;
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
		"detectedItemType": "standard",
		"items": [
			{
				"itemType": "standard",
				"title": "国际单位制及其应用",
				"creators": [
					{
						"lastName": "国家市场监督管理总局",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1993-07-01",
				"extra": "实施日期: 1994-07-01",
				"language": "zh-CN",
				"libraryCatalog": "国家标准全文公开系统",
				"number": "GB 3100—1993",
				"publisher": "国家技术监督局",
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
		"detectedItemType": "standard",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献  参考文献著录规则",
				"creators": [
					{
						"lastName": "国家标准化管理委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"extra": "实施日期: 2015-12-01",
				"language": "zh-CN",
				"libraryCatalog": "国家标准全文公开系统",
				"number": "GB/T 7714—2015",
				"publisher": "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
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
	}
]
/** END TEST CASES **/

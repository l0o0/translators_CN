{
	"translatorID": "cd01cf63-90ba-42b4-a505-74d8d14f79d6",
	"label": "National Public Service Platform for Standards Information - China",
	"creator": "Zeping Lee",
	"target": "https?://std\\.samr\\.gov\\.cn/",
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
	item.libraryCatalog = '全国标准信息公共服务平台';
	item.extra = 'Type: standard';

	if (doc.querySelector('.label-info').textContent === '国际标准') {
		item.title = doc.querySelector('.page-header + p').textContent;
	}
	else {
		item.title = doc.querySelector('.page-header h4').textContent;
	}

	var dtList = doc.querySelectorAll('dt.basicInfo-item.name');
	var ddList = doc.querySelectorAll('dd.basicInfo-item.value');

	for (var i = 0; i < dtList.length; ++i) {
		var name = dtList[i].textContent;
		var span = ddList[i].querySelector('span');
		let value = ddList[i].textContent;
		if (span) {
			value = span.textContent;
		}
		else {
		}
		value = value.trim();

		if (value.length === 0) {
			continue;
		}

		switch (name) {
			case '标准号':
				var standardType = doc.querySelector('.label-info');
				if (!(standardType && standardType.textContent.startsWith('国际标准'))) {
					// 国标编号使用一字线
					value = value.replace('-', '—');
				}
				item.reportNumber = value;
				break;
			case '发布日期':
				item.date = value;
				break;
			case '实施日期':
				if (!item.date || item.date.length === 0) {
					item.date = value;
				}
				break;
			case '归口部门':
			case '归口单位':
			case '标准发布组织':
				for (var institute of value.split('、')) {
					item.creators.push({
						lastName: institute,
						creatorType: 'author',
						fieldMode: 1
					});
				}
				break;
			case '标准语言':
				item.language = value.toLowerCase();
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
		"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D7AA78D3A7E05397BE0A0AB82A",
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
				"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D7AA78D3A7E05397BE0A0AB82A",
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
		"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D8055ED3A7E05397BE0A0AB82A",
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
				"itemType": "report",
				"title": "中文出版物夹用英文的编辑规范",
				"creators": [
					{
						"lastName": "全国新闻出版标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-04-17",
				"extra": "Type: standard",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "CY/T 154—2017",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=63A23D3AFA47E60C29392465F6A791C3",
		"items": [
			{
				"itemType": "report",
				"title": "Information and documentation — Guidelines for bibliographic references and citations to information resources",
				"creators": [
					{
						"lastName": "ISO",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-06-11",
				"extra": "Type: standard",
				"language": "en",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "ISO 690:2021",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=63A23D3AFA47E60C29392465F6A791C3",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=DE5099AC5B0BE767513328A92BB85614",
		"items": [
			{
				"itemType": "report",
				"title": "Information technology — Universal coded character set (UCS)",
				"creators": [
					{
						"lastName": "ISO/IEC",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020-12-21",
				"extra": "Type: standard",
				"language": "en",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "ISO/IEC 10646:2020",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=DE5099AC5B0BE767513328A92BB85614",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=B918D134293DC9AF17BD9A5FCB5C24B2",
		"items": [
			{
				"itemType": "report",
				"title": "Quantities and units — Part 2: Mathematics",
				"creators": [
					{
						"lastName": "ISO",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-08-26",
				"extra": "Type: standard",
				"language": "en",
				"libraryCatalog": "全国标准信息公共服务平台",
				"reportNumber": "ISO 80000-2:2019",
				"shortTitle": "Quantities and units — Part 2",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=B918D134293DC9AF17BD9A5FCB5C24B2",
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

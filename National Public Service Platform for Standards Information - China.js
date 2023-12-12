{
	"translatorID": "cd01cf63-90ba-42b4-a505-74d8d14f79d6",
	"label": "National Public Service Platform for Standards Information - China",
	"creator": "Zeping Lee, rnicrosoft",
	"target": "https?://std\\.samr\\.gov\\.cn/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-12 08:42:32"
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
	item.libraryCatalog = '全国标准信息公共服务平台';

	if (doc.querySelector('.label-info').textContent === '国际标准') {
		item.title = doc.querySelector('.page-header + p').textContent;
	}
	else {
		item.title = doc.querySelector('.page-header h4').textContent;
	}

	for (let status of doc.querySelectorAll('.page-header .s-status')) {
		let label = status.textContent;
		switch (label) { // 英文标准
			case '现行':
			case '被代替':
			case '修订':
			case '废止':
				item.status = label;
			default:
				// Z.debug(label);
		}
	}

	for (let panel of doc.querySelectorAll('.panel')) {
		let heading = panel.querySelector('.panel-heading').textContent.trim();
		switch (heading) {
			case '当前标准':
			case '当前标准计划':
				let status = panel.querySelector('.panel-body .s-status').textContent;
				item.status = status;
				break;
		}
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
				item.number = value;
				break;
			case '发布日期':
				item.date = value;
				break;
			case '实施日期':
				if (!item.date || item.date.length === 0) {
					item.date = value;
				} else {
					addExtra(item, [name, value]);
				}
				break;
			case '全部代替标准':
				addExtra(item, [name, value]);
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
				let language = value.toLowerCase();
				if (language === 'en') {
					language = 'en-US';
				}
				item.language = language;
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
				"extra": "实施日期: 1994-07-01\n全部代替标准: GB 3100-1986",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "GB 3100—1993",
				"status": "现行",
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
				"extra": "实施日期: 2015-12-01\n全部代替标准: GB/T 7714-2005",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "GB/T 7714—2015",
				"status": "现行",
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
				"extra": "实施日期: 2017-04-17",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "CY/T 154—2017",
				"status": "现行",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=373C3505A9085559695051CCF9F59895",
		"items": [
			{
				"itemType": "standard",
				"title": "Information technology — Universal coded character set (UCS)",
				"creators": [
					{
						"lastName": "ISO/IEC",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020-12-21",
				"language": "en-US",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "ISO/IEC 10646:2020",
				"status": "现行",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=373C3505A9085559695051CCF9F59895",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=90EA7F0D4DF6771A08464E35E322E8BE",
		"items": [
			{
				"itemType": "standard",
				"title": "Quantities and units — Part 2: Mathematics",
				"creators": [
					{
						"lastName": "ISO",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-08-26",
				"language": "en-US",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "ISO 80000-2:2019",
				"shortTitle": "Quantities and units — Part 2",
				"status": "现行",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=90EA7F0D4DF6771A08464E35E322E8BE",
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

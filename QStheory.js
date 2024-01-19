{
	"translatorID": "85862c7a-5acd-410b-88a3-6d0fdf39479d",
	"label": "QStheory",
	"creator": "jiaojiaodubai",
	"target": "^http://www\\.qstheory\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-09 06:41:46"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/dukan/')) {
		if (doc.querySelector('p > strong > a')) {
			return 'multiple';
		}
		return 'journalArticle';
	}
	// 必须要有标题才能顺利保存条目
	else if (doc.querySelector('.inner > h1')) {
		return 'webpage';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll('a')).filter(element => new RegExp('/\\w+/\\d{4}-\\d{2}/\\d{2}/').test(element.href));
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
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, '.inner > h1') + text(doc, '.inner > h2');
	newItem.shortTitle = text(doc, '.inner > h1');
	switch (newItem.itemType) {
		case 'journalArticle': {
			let pubInfo = text(doc, '.appellation');
			newItem.publicationTitle = tryMatch(pubInfo, /：《?(.+?)》?\d+/, 1);
			if (newItem.publicationTitle == '求是') {
				newItem.ISSN = '1002-4980';
			}
			newItem.issue = tryMatch(pubInfo, /0*([1-9]\d*)$/, 1);
			newItem.date = tryMatch(pubInfo, /\d{4}/);
			break;
		}
		case 'webpage':
			newItem.websiteTitle = '求是网';
			newItem.date = ZU.strToISO(text(doc, '.pubtime'));
			break;
	}
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.creators = [...processName(text(doc, '.appellation', 1), 'author'), ...processName(text(doc, '.pull-right'), 'contributor')];
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

function processName(creators, creatorType) {
	creators = creators
		.trim()
		.replace(/^[(（［【[]|[)）］】\]]$/g, '')
		.replace(/([^\u4e00-\u9fff][\u4e00-\u9fff])\s+([\u4e00-\u9fff](?:[^\u4e00-\u9fff]|$))/g, '$1$2')
		.split(/[(?:\s+)、：:]/g)
		.filter(creator => !/(编|校对|审校|记者|作者|图|文|-)/.test(creator));
	Z.debug(creators);
	creators = creators.map((creator) => {
		creator = ZU.cleanAuthor(creator, creatorType);
		creator.fieldMode = 1;
		return creator;
	});
	return creators;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.qstheory.cn/laigao/ycjx/2023-12/12/c_1130019251.htm",
		"items": [
			{
				"itemType": "webpage",
				"title": "“枫桥经验”是来自人民群众的实践创造",
				"creators": [
					{
						"firstName": "",
						"lastName": "是说新语",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "汤宝兰",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023-12-12",
				"language": "zh-CN",
				"url": "http://www.qstheory.cn/laigao/ycjx/2023-12/12/c_1130019251.htm",
				"websiteTitle": "求是网",
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
		"url": "http://www.qstheory.cn/dukan/qs/2023-01/01/c_1129246885.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "铁人队伍永向前",
				"creators": [
					{
						"firstName": "",
						"lastName": "周昭成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈聪",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张芯蕊",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "徐勇林",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "夏明月",
						"creatorType": "contributor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈嵘",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "2023",
				"issue": "1",
				"language": "zh-CN",
				"libraryCatalog": "QStheory",
				"url": "http://www.qstheory.cn/dukan/qs/2023-01/01/c_1129246885.htm",
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
		"url": "http://www.qstheory.cn/dukan/qs/2014/2023-01/01/c_1129247031.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.qstheory.cn/",
		"items": "multiple"
	}
]

/** END TEST CASES **/

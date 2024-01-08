{
	"translatorID": "6a540908-0419-4876-b2ae-0bcc50d99b4b",
	"label": "Encyclopedia of China 3rd",
	"creator": "pixiandouban, jiaojiaoduabi",
	"target": "^https?://www.zgbk.com",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-08 13:46:35"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 pixiandouban, jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/ecph/words?')) {
		return 'encyclopediaArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// .name见于首页推荐
	// h2见于搜索页
	var rows = doc.querySelectorAll('a[href*="/ecph/words"].name, h2 > a[href*="/ecph/words"]');
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
	var newItem = new Zotero.Item("encyclopediaArticle");
	newItem.extra = '';
	newItem.title = text(doc, '.title >  h2');
	newItem.abstractNote = text(doc, '.summary');
	newItem.encyclopediaTitle = '中国大百科全书';
	newItem.edition = '第三版·网络版';
	newItem.publisher = '中国大百科全书出版社';
	newItem.date = text(doc, '.time > span');
	newItem.url = url;
	newItem.url = url;
	newItem.libraryCatalog = '中国大百科全书';
	newItem.extra += addExtra('original-title', text(doc, '.enname i'));
	// https://www.zgbk.com/ecph/words?SiteID=1&ID=456852&Type=bkzyb&SubID=99947
	doc.querySelectorAll('.author:not([style^="display: none"]) .n-author > span').forEach((element) => {
		let creator = element.innerText.replace(/(撰|修订)$/, '');
		creator = ZU.cleanAuthor(creator, 'author');
		if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
			creator.lastName = creator.firstName + creator.lastName;
			creator.firstName = '';
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});
	newItem.language = 'zh-CN';
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
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
		"url": "https://www.zgbk.com/ecph/words?SiteID=1&ID=86055",
		"items": [
			{
				"itemType": "encyclopediaArticle",
				"title": "章锡琛",
				"creators": [
					{
						"firstName": "",
						"lastName": "钟仁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张文彦",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-07-05",
				"abstractNote": "（1889-08-27～1969-06-06）\n中国编辑出版家。别名雪村。",
				"edition": "第三版·网络版",
				"encyclopediaTitle": "中国大百科全书",
				"language": "zh-CN",
				"libraryCatalog": "中国大百科全书",
				"publisher": "中国大百科全书出版社",
				"url": "https://www.zgbk.com/ecph/words?SiteID=1&ID=86055",
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
		"url": "https://www.zgbk.com/ecph/search/result?SiteID=1&Alias=all&Query=%E5%AD%94%E5%AD%90",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zgbk.com/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.zgbk.com/ecph/subject?SiteID=1&ID=42424",
		"items": "multiple"
	}
]
/** END TEST CASES **/

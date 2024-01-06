{
	"translatorID": "b9d2e5ab-1e1b-49c8-b1e7-7d26d35064d8",
	"label": "SKCTK",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.skctk\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-06 08:16:18"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai12@gmail.com>

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
	if (url.includes('/html/')) {
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
	var rows = doc.querySelectorAll('li > a[href*="/html/"], .title > a[href*="/html/"]');
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
	var newItem = new Z.Item('encyclopediaArticle');
	newItem.extra = '';
	newItem.title = text(doc, '#content > .title');
	newItem.abstractNote = text(doc, '.intro .txt');
	newItem.encyclopediaTitle = '中国社会科学词条库';
	newItem.publisher = '中国大百科全书出版社';
	newItem.date = text(doc, '.last_udpate');
	newItem.url = tryMatch(url, /^.+?html.+?html/);
	newItem.language = 'zh-CN';
	newItem.libraryCatalog = '中国社会科学词条库';
	newItem.rights = '中国大百科全书出版社有限公司';
	text(doc, '.author').replace(/^（作者：/, '').replace(/）$/, '')
.split(/\s/)
.forEach((creator) => {
	creator = creator.replace(/(撰|修订)$/, '');
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


function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.skctk.cn/html/1/1-177466-1.html?is_search=hot_search&t=1704526856",
		"items": [
			{
				"itemType": "encyclopediaArticle",
				"title": "唯物主义",
				"creators": [
					{
						"firstName": "",
						"lastName": "赵光武",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "谢地坤",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "最后更新 2022-12-01",
				"abstractNote": "哲学上的两大基本派别之一；与唯心主义对立的理论体系。",
				"encyclopediaTitle": "中国社会科学词条库",
				"language": "zh-CN",
				"libraryCatalog": "中国社会科学词条库",
				"publisher": "中国大百科全书出版社",
				"rights": "中国大百科全书出版社有限公司",
				"url": "https://www.skctk.cn/html/1/1-177466-1.html",
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
		"url": "https://www.skctk.cn/index.php?g=portal&m=search&a=index",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.skctk.cn/index.php?m=list&a=hot",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.skctk.cn/",
		"items": "multiple"
	}
]
/** END TEST CASES **/

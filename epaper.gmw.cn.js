{
	"translatorID": "c7f4a1df-1d53-433d-8c04-26fd55791459",
	"label": "epaper.gmw.cn",
	"creator": "jiaojiaodubai",
	"target": "^https://epaper\\.gmw\\.cn/gmrb",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-02-13 13:42:04"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	// publicationCode_yyyyMMdd_page_order
	if (/[a-z]+_\d{8}_\d+-\d+.htm/.test(url)) {
		return 'newspaperArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('#titleList li > a');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) === 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item('newspaperArticle');
	newItem.title = text(doc, 'h1');
	const pubInfo = text(doc, '.lai > b');
	newItem.publicationTitle = tryMatch(pubInfo, /^《(.+)》/, 1);
	newItem.place = '北京';
	newItem.date = tryMatch(pubInfo, /\d{4}年\d{2}月\d{2}/).replace(/\D/g, '-');
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	text(doc, '.lai > :first-child').substring(2).split(' ')
		.filter(name => !name.includes('记者'))
		.forEach(name => newItem.creators.push(cleanAuthor(name)));
	newItem.url = url;
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

function cleanAuthor(name, creatorType = 'author') {
	return {
		firstName: '',
		lastName: name,
		creatorType,
		fildMode: 1
	};
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://epaper.gmw.cn/gmrb/html/2025-02/12/nw.D110000gmrb_20250212_4-01.htm",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "浙江义乌：“世界超市”有了新“法宝”",
				"creators": [
					{
						"firstName": "",
						"lastName": "陆健",
						"creatorType": "author",
						"fildMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘习",
						"creatorType": "author",
						"fildMode": 1
					}
				],
				"date": "2025-02-12",
				"libraryCatalog": "epaper.gmw.cn",
				"place": "北京",
				"publicationTitle": "光明日报",
				"url": "https://epaper.gmw.cn/gmrb/html/2025-02/12/nw.D110000gmrb_20250212_4-01.htm",
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
		"url": "https://epaper.gmw.cn/gmrb/html/2025-02/13/nbs.D110000gmrb_01.htm",
		"items": "multiple"
	}
]
/** END TEST CASES **/

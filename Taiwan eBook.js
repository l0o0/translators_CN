{
	"translatorID": "9f7194d8-785e-4aec-b85c-63126f0f5368",
	"label": "Taiwan eBook",
	"creator": "jiaojiaodubai",
	"target": "^https://taiwanebook\\.ncl\\.edu\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-09 09:30:22"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/book/')) {
		if (url.includes('/reader')) {
			return false;
		}
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.ui.divided.items > .item .header');
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
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Z.selectItems(getSearchResults(doc, false));
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
	const newItem = new Z.Item(detectWeb(doc, url));
	const titleNode = doc.querySelector('.sixteen.wide.row h2').cloneNode(true);
	const label = titleNode.querySelector('a');
	if (label) {
		label.remove();
	}
	newItem.title = titleNode.innerText;
	const raw = {};
	const row = doc.querySelector('.ui.four.column.grid > .row:nth-child(2)');
	for (let i = 0; i < row.children.length; i += 2) {
		const label = ZU.trimInternal(row.children[i].innerText)
			.replace(/\s?(\p{Unified_Ideograph})\s?/gu, '$1')
			.replace(/:$/, '');
		const value = row.children[i+1].innerText.trim()
		raw[label] = value;
	}
	const data = new Proxy(raw, {
		get: (target, prop) => {
			const value = target[prop];
			return value || "";
		}
	});
	newItem.edition = data.版次;
	newItem.date = data.出版年;
	newItem.publisher = data.出版者;
	newItem.place = data.出版地;
	newItem.numPages = data.頁數;
	newItem.ISBN = data.國際書號;
	newItem.language = 'zh-TW';
	newItem.url = url;
	newItem.archiveLocation = data.典藏機構;
	data.作者.split(/\s?;\s?/).forEach((group) => {
		const roleMap = {
			author: /编?著$/,
			editor: /编輯?$/,
			translator: /譯$/,
			contributor: /校[勘刊]$/
		}
		let creatorType = 'author';
		for (const [type, regx] of Object.entries(roleMap)) {
			if (regx.test(group)) {
				creatorType = type;
				group = group.replace(regx, '');
				break;
			}
		}
		group.replace(/(([圖文]|動畫)\.?)+$/g, '').split(/\s?,\s?/).forEach((name) => {
			// trim dynasty
			name = name.replace(/^\([^)]+\)/, '');
			if (/\p{Unified_Ideograph}/u.test(name)) {
				newItem.creators.push({
					lastName: name,
					creatorType,
					fieldMode: 1
				});
			}
			else {
				newItem.creators.push(ZU.cleanAuthor(name, creatorType));
			}
		});
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://taiwanebook.ncl.edu.tw/zh-tw/book/NCL-9900011541",
		"items": [
			{
				"itemType": "book",
				"title": "三角法 : 二角和差之三角函數",
				"creators": [
					{
						"lastName": "林鶴一",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "矢袋喜一",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "駱師曾",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1929",
				"libraryCatalog": "Taiwan eBook",
				"numPages": "166",
				"place": "上海市",
				"publisher": "商務",
				"shortTitle": "三角法",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://taiwanebook.ncl.edu.tw/zh-tw/book/NCL-9900012351",
		"items": [
			{
				"itemType": "book",
				"title": "1923等待的季節",
				"creators": [
					{
						"lastName": "蔡幸妤",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"ISBN": "9789860459982",
				"archiveLocation": "國家圖書館",
				"libraryCatalog": "Taiwan eBook",
				"numPages": "37",
				"place": "雲林縣斗六市",
				"publisher": "雲林縣文化處",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://taiwanebook.ncl.edu.tw/zh-tw/category/agriculture/maintitle/asc/grid",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/

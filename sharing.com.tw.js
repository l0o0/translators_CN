{
	"translatorID": "5e4fd469-f673-4dbf-b00b-b43b9822f02a",
	"label": "sharing.com.tw",
	"creator": "jiaojiaodubai",
	"target": "^https://sharing\\.com\\.tw",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-03-10 20:24:36"
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
	if (url.includes('/product/')) {
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
	const rows = doc.querySelectorAll('a[href*="/product/"][aria-label]');
	for (const row of rows) {
		const href = row.href;
		const title = row.getAttribute('aria-label');
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Zotero.selectItems(getSearchResults(doc, false));
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
	const newItem = new Z.Item('book');
	newItem.title = text(doc, '.product-in-2 > .stk_L_txt')
		.replace(/\(調貨中\)$/, '')
		.replace(/\((\p{Unified_Ideograph}+?)\)/u, '（$1）');
	const data = {
		innerData: {},
		set(key, value) {
			this.innerData[key] = value;
		},
		get(key) {
			return this.innerData[key] || '';
		}
	};
	const rows = doc.querySelectorAll('.product-in-2 .stk_S_txt');
	for (const row of rows) {
		data.set(
			tryMatch(row.innerText, /^(.+?)\s:\s/, 1),
			tryMatch(row.innerText, /\s:\s(.+)$/, 1)
		);
	}
	// https://sharing.com.tw/product/index/8AD45
	newItem.series = data.get('書系');
	const volume = tryMatch(newItem.title, /第(\d+)期$/, 1);
	if (volume) {
		newItem.title = newItem.title.slice(0, -(volume.length + 2));
		newItem.volume = volume;
	}
	// https://sharing.com.tw/product/index/UAE008
	newItem.edition = data.get('版別').replace(/(\d+)版/, '$1');
	newItem.publisher = data.get('出版社');
	newItem.date = ZU.strToISO(data.get('出版日期'));
	newItem.language = 'zh-TW';
	newItem.ISBN = ZU.cleanISBN(data.get('ISBN'));
	newItem.url = url;
	newItem.libraryCatalog = '新學林網路書店';
	newItem.setExtra('ISSN', data.get('ISSN'));
	const groups = data.get('編/著者').split(/\s?；\s?/);
	for (const group of groups) {
		let names = group;
		let creatorType = 'author';
		const prefixRole = tryMatch(group, /^\p{Unified_Ideograph}+：/u);
		const suffixRole = tryMatch(group, / \p{Unified_Ideograph}+/u);
		const role = prefixRole || suffixRole;
		if (role) {
			names = names.slice(prefixRole.length, -suffixRole.length);
			if (!/[著繪]/.test(role)) {
				if (/編/.test(role)) {
					creatorType = 'editor';
				}
				else if (/譯/.test(role)) {
					creatorType = 'translator';
				}
				else {
					creatorType = 'contributor';
				}
			}
		}
		names.split(/[、．]/).forEach((name) => {
			// prefer real name than pseudomym
			// https://sharing.com.tw/product/index/UCAF15
			name = tryMatch(name, /（(.+?)）$/, 1) || name;
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
	}
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://sharing.com.tw/product/index/U8CF10",
		"items": [
			{
				"itemType": "book",
				"title": "這個時候你怎麼說？戀愛華語（電子書）",
				"creators": [
					{
						"lastName": "舒兆民",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "宋怡南",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陳玉明",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "歐喜強",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Daniel S.",
						"lastName": "Parilla",
						"creatorType": "translator"
					}
				],
				"date": "2020-10-19",
				"ISBN": "9789865532697",
				"extra": "ISSN:",
				"language": "zh-TW",
				"libraryCatalog": "新學林網路書店",
				"publisher": "新學林電子書",
				"url": "https://sharing.com.tw/product/index/U8CF10",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://sharing.com.tw/product/index/ZZ5D683R",
		"items": [
			{
				"itemType": "book",
				"title": "數位轉型與公法變遷",
				"creators": [
					{
						"lastName": "李建良",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Jan",
						"lastName": "Ziekow",
						"creatorType": "author"
					},
					{
						"firstName": "Bettina",
						"lastName": "Engewald",
						"creatorType": "author"
					},
					{
						"lastName": "詹鎮榮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Meinhard",
						"lastName": "Schröder",
						"creatorType": "author"
					},
					{
						"lastName": "陳錫平",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "林昱梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Matthias",
						"lastName": "Knauff",
						"creatorType": "author"
					},
					{
						"lastName": "李長曄",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "黃松茂",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Stefan",
						"lastName": "Korte",
						"creatorType": "author"
					},
					{
						"lastName": "陳陽升",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "Thorsten",
						"lastName": "Siegel",
						"creatorType": "author"
					}
				],
				"date": "2024-07-01",
				"ISBN": "9786263691841",
				"edition": "1",
				"extra": "ISSN:",
				"language": "zh-TW",
				"libraryCatalog": "新學林網路書店",
				"publisher": "元照",
				"url": "https://sharing.com.tw/product/index/ZZ5D683R",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://sharing.com.tw/product/index/6J040",
		"items": [
			{
				"itemType": "book",
				"title": "台灣法律人",
				"creators": [],
				"date": "2025-01-10",
				"extra": "ISSN: 2789-4908",
				"language": "zh-TW",
				"libraryCatalog": "新學林網路書店",
				"publisher": "泰美斯法學雜誌股份有限公司",
				"url": "https://sharing.com.tw/product/index/6J040",
				"volume": "40",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://sharing.com.tw/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://sharing.com.tw/search/vname/0/%E8%8F%AF%E8%AA%9E",
		"items": "multiple"
	}
]
/** END TEST CASES **/

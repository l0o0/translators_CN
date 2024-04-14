{
	"translatorID": "9f41ad8a-1df6-41d0-928a-0d79d0de7708",
	"label": "stats.gov.cn",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.stats\\.gov\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-14 10:26:36"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiajiaodubai23@gmail.com>

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
	if (url.endsWith('.html')) {
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
	var rows = doc.querySelectorAll('a[href$=".html"]');
	for (let row of rows) {
		let href = row.href;
		let title = row.getAttribute('title') || ZU.trimInternal(row.textContent);
		if (!href || !title || !href.includes('www.stats.gov.cn')) continue;
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
	let isEnglishVer = url.includes('/english/');
	let newItem = new Z.Item('webpage');
	var fieldsMap = {
		title: {
			zh: '.detail-title > h1',
			en: 'h1.con_titles',
			callback: str => text(doc, str)
		},
		websiteTitle: {
			zh: '国家统计局',
			en: 'National Bureau of Statistics of China',
			callback: str => str
		},
		date: {
			zh: '.detail-title-des > h2:first-child > p',
			en: '.info  > span:nth-child(2)',
			callback: str => ZU.strToISO(text(doc, str))
		},
		language: {
			zh: 'zh-CN',
			en: 'en-US',
			callback: str => str
		}
	};
	for (let field in fieldsMap) {
		let obj = fieldsMap[field];
		newItem[field] = obj.callback(isEnglishVer ? obj.en : obj.zh);
	}
	newItem.url = url;
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.stats.gov.cn/english/PressRelease/202404/t20240409_1954339.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "Market Prices of Important Means of Production in Circulation, March 21-31, 2024",
				"creators": [],
				"date": "2024-04-04",
				"language": "en-US",
				"url": "https://www.stats.gov.cn/english/PressRelease/202404/t20240409_1954339.html",
				"websiteTitle": "National Bureau of Statistics of China",
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
		"url": "https://www.stats.gov.cn/sj/zxfb/202404/t20240411_1954447.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "2024年3月份工业生产者出厂价格同比下降2.8%",
				"creators": [],
				"date": "2024-04-11",
				"language": "zh-CN",
				"url": "https://www.stats.gov.cn/sj/zxfb/202404/t20240411_1954447.html",
				"websiteTitle": "国家统计局",
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
		"url": "https://www.stats.gov.cn/zsk/?tab=all&siteCode=tjzsk&qt=&sitePath=true",
		"items": "multiple"
	}
]
/** END TEST CASES **/

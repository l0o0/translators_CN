{
	"translatorID": "7ffde69e-dd36-4158-98bf-2c3b5ba026e3",
	"label": "China Judgements Online",
	"creator": "Zeping Lee",
	"target": "^https?://wenshu\\.court\\.gov\\.cn/",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-06-21 16:59:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 Zeping Lee

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
	if (url.includes('/181107ANFZ0BXSK4/')) {
		return 'case';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.LM_list h4 > a.caseName[href*="/181107ANFZ0BXSK4/"]');
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
	var item = new Zotero.Item('case');

	item.url = url;
	item.language = 'zh-CN';

	let extraFields = {};

	let title = doc.querySelector('.PDF_title');
	if (title) {
		item.caseName = title.textContent;
		let genre = title.textContent.match('(刑事|民事|行政)(判决书|裁定书|调解书|决定书|通知书|令)');
		if (genre) {
			extraFields.Genre = genre[0];
		}
	}

	let number = doc.querySelector('#ahdiv');
	if (number) {
		item.docketNumber = number.textContent;
	}

	for (let h4 of doc.querySelectorAll('.gaiyao_box h4')) {
		let parts = h4.textContent.split('：', 2);
		if (parts.length != 2) {
			continue;
		}
		let field = parts[0].trim();
		let value = parts[1].trim();

		switch (field) {
			case '审理法院':
				item.court = value;
				break;
			case '案件类型':
				if (!extraFields.Genre) {
					extraFields.Genre = value.replace('案件', '判决书');
				}
				break;
			case '裁判日期':
				item.date = value;
				break;
		}
	}

	item.extra = Object.entries(extraFields).map(entry => entry[0] + ': ' + entry[1]).join('\n');

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/

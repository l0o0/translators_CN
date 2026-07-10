{
	"translatorID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	"label": "China National Library - Republic Era",
	"creator": "Zotero User",
	"target": "^https?://read\\.nlc\\.cn/allSearch/(searchDetail|searchList)\\?.*",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-10 17:15:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Zotero User

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
	if (url.includes("/allSearch/searchDetail?") && (doc.querySelector('div.title') || doc.querySelector('input#title'))) {
		return "book";
	}
	if (url.includes("/allSearch/searchList?") && getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}


function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('ul.YMH2019_New_MGZYK_List1.List-TB > li');
	for (var i = 0; i < rows.length; i++) {
		var a = rows[i].querySelector('a');
		if (!a) continue;
		var href = a.href;
		var title = text(rows[i], 'span.tt');
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title.trim();
	}
	return found ? items : false;
}


function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (!items) return;
			ZU.processDocuments(Object.keys(items), scrape);
		});
	}
	else {
		scrape(doc, url);
	}
}


function scrape(doc, url) {
	var item = new Zotero.Item("book");

	item.title = (text(doc, 'div.title') || text(doc, 'input#title')).trim();

	var author = text(doc, 'input#author') || getFieldValue(doc, '责任者');
	if (author) {
		author = author.replace(/[著编译辑撰]+$/, '').trim();
		var authors = author.split(/[,，]/);
		for (var i = 0; i < authors.length; i++) {
			var name = authors[i].trim();
			if (name) {
				item.creators.push({
					lastName: name,
					creatorType: "author",
					fieldMode: 1
				});
			}
		}
	}

	var publisher = getFieldValue(doc, '出版者');
	if (publisher) {
		item.publisher = publisher.trim();
	}

	var date = getFieldValue(doc, '出版时间');
	if (date) {
		item.date = date.trim();
	}

	var subject = getFieldValue(doc, '主题') || text(doc, 'input#Keyword');
	if (subject) {
		item.tags = subject.split(/[;；,，]/).map(function (t) { return t.trim(); }).filter(function (t) { return t; });
	}

	var physicalDesc = getFieldValue(doc, '载体形态');
	if (physicalDesc) {
		item.numPages = physicalDesc.trim();
	}

	var abstract = getFieldValue(doc, '摘要');
	if (abstract) {
		item.abstractNote = abstract.trim();
	}

	var identifier = text(doc, 'input#identifier');
	if (identifier) {
		item.callNumber = identifier.trim();
	}

	item.url = url;
	item.language = "zh-CN";

	item.attachments.push({
		title: "China National Library Record",
		url: url,
		mimeType: "text/html",
		snapshot: false
	});

	item.complete();
}


function getFieldValue(doc, fieldName) {
	var labels = doc.querySelectorAll('.XiangXi label');
	for (var i = 0; i < labels.length; i++) {
		var textContent = labels[i].textContent.trim();
		if (textContent.startsWith(fieldName + '：') || textContent.startsWith(fieldName + ':')) {
			var valueSpan = labels[i].querySelector('span.t1');
			if (valueSpan) {
				return valueSpan.textContent.trim();
			}
		}
	}
	return null;
}


/** BEGIN TEST CASES **/
var testCases = [
];
/** END TEST CASES **/

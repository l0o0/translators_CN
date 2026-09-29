{
	"translatorID": "c9d2e8f4-3b1a-4c5d-9e6f-7a8b9c0d1e2f",
	"label": "Shanghai International Studies University Library",
	"creator": "Zotero User",
	"target": "^https?://findshisu\\.libsp\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-12 13:00:00"
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
	// SPA: monitor body for React rendering before content appears
	var root = doc.querySelector('#app, #root, .ant-app, body');
	if (root) {
		Z.monitorDOMChanges(root, { childList: true, subtree: true });
	}

	if (/bookDetails/.test(url) && hasFields(doc)) {
		return detectType(doc);
	}
	if (/searchList/.test(url) && !/bookDetails/.test(url) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function hasFields(doc) {
	if (doc.querySelector('.col, .marcRight, .marcLeft')) return true;
	// Check for p > span with 【label】 structure (standard doc pages)
	var pEls = doc.querySelectorAll('p');
	for (var i = 0; i < pEls.length; i++) {
		var spans = pEls[i].querySelectorAll('span');
		for (var j = 0; j < spans.length; j++) {
			var t = ZU.trimInternal(spans[j].textContent);
			if (/^【.+?】$/.test(t)) return true;
		}
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.ant-list-item');
	for (var i = 0; i < rows.length; i++) {
		var a = rows[i].querySelector('[class*="infotit"]');
		if (!a) continue;
		var href = a.href;
		if (!href) continue;
		// Clean title: remove number prefix "1. " and type indicator "[图书] "
		var title = ZU.trimInternal(a.textContent)
			.replace(/^\d+\.\s*/, '')
			.replace(/^\[.+?\]\s*/, '');
		if (!title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) === 'multiple') {
		var searchResults = getSearchResults(doc, false);
		Zotero.selectItems(searchResults, function (items) {
			if (!items) return;
			// SPA: processDocuments can't render hash-routed pages
			// Scrape directly from search results page
			for (var itemUrl in items) {
				scrapeFromSearch(doc, itemUrl, items[itemUrl]);
			}
		});
	}
	else {
		scrape(doc, url);
	}
}

function scrapeFromSearch(doc, url, fallbackTitle) {
	// Find the corresponding search result item
	var row = null;
	var rows = doc.querySelectorAll('.ant-list-item');
	for (var i = 0; i < rows.length; i++) {
		var a = rows[i].querySelector('[class*="infotit"]');
		if (a && a.href === url) {
			row = rows[i];
			break;
		}
	}
	if (!row) {
		// Fallback: create minimal item
		var fallback = new Zotero.Item('book');
		fallback.url = url;
		fallback.title = fallbackTitle || 'Untitled';
		fallback.libraryCatalog = '上海外国语大学图书馆';
		fallback.language = 'zh-CN';
		fallback.complete();
		return;
	}

	// Determine item type from [图书] or [学位论文] in title text
	var titleLink = row.querySelector('[class*="infotit"]');
	var rawTitle = titleLink ? ZU.trimInternal(titleLink.textContent) : '';
	var typeMatch = rawTitle.match(/\[(.+?)\]/);
	var itemType = 'book';
	if (typeMatch) {
		if (/学位论文/.test(typeMatch[1])) itemType = 'thesis';
		else if (/标准/.test(typeMatch[1])) itemType = 'standard';
	}

	var item = new Zotero.Item(itemType);
	item.url = url;
	item.libraryCatalog = '上海外国语大学图书馆';
	item.language = 'zh-CN';

	// Title: remove number prefix and [type] indicator
	item.title = rawTitle.replace(/^\d+\.\s*/, '').replace(/^\[.+?\]\s*/, '') || fallbackTitle || 'Untitled';

	// Metadata from .modeInfo spans - determine type by content, not position
	var extraParts = [];
	var modeInfos = row.querySelectorAll('[class*="easymode"] [class*="modeInfo"]');
	for (var j = 0; j < modeInfos.length; j++) {
		var span = modeInfos[j].querySelector('span[title]');
		if (!span) continue;
		var titleAttr = span.getAttribute('title') || '';
		var innerSpans = span.querySelectorAll('span');

		if (innerSpans.length >= 2) {
			// Publisher/Date/ISBN from inner spans
			item.publisher = innerSpans[0].textContent.trim();
			item.date = innerSpans[1].textContent.trim();
			if (innerSpans.length >= 3) {
				var isbn = innerSpans[2].textContent.trim();
				if (/[\dXx-]{10,}/.test(isbn)) item.ISBN = isbn;
			}
		}
		else if (titleAttr && /[A-Za-z]/.test(titleAttr) && /\//.test(titleAttr)) {
			// CLC: alphanumeric with / (e.g. "H059/F9", "H059-092/Q1")
			extraParts.push('CLC: ' + titleAttr);
		}
		else if (titleAttr && /、/.test(titleAttr) && titleAttr.length > 5) {
			// Subject classification (e.g. "语言、文字-写作学与修辞学")
			extraParts.push('Subject: ' + titleAttr);
		}
		else if (titleAttr) {
			// Author (e.g. "顾忆青", "傅敬民等著", "王宏志主编")
			addCreators(item, titleAttr);
		}
	}
	if (extraParts.length > 0) {
		item.extra = extraParts.join('\n');
	}

	// Abstract
	var abstractEl = row.querySelector('[class*="adstract"]');
	if (abstractEl) {
		item.abstractNote = abstractEl.getAttribute('title') || ZU.trimInternal(abstractEl.textContent);
	}

	if (itemType === 'thesis') {
		item.thesisType = '学位论文';
	}

	item.attachments.push({
		title: '上海外国语大学图书馆 Snapshot',
		url: url,
		mimeType: 'text/html',
		snapshot: false
	});
	item.complete();
}

function scrape(doc, url) {
	var itemType = detectType(doc);
	var item = new Zotero.Item(itemType);

	item.url = url;
	item.libraryCatalog = '上海外国语大学图书馆';
	item.language = 'zh-CN';

	var fields = getDetailFields(doc);

	// Title: prefer doc.title (clean title without author), fallback to field
	var rawTitleField = getField(fields, ['题名', '正题名']);
	if (doc.title) {
		item.title = doc.title.trim();
	}
	else if (rawTitleField) {
		// Split "title.author著" or "title:author" -> title only
		var titleMatch = rawTitleField.match(/^([\s\S]+)[\.：:]([\u4e00-\u9fa5]{1,}[著编译辑撰注]*)$/);
		item.title = titleMatch ? titleMatch[1].trim() : rawTitleField.trim();
	}

	// Author: try "个人责任者" field first, fallback to extracting from "题名/责任者"
	var author = getField(fields, ['个人责任者', '作者']);
	if (!author && rawTitleField) {
		// Extract author after last separator: "title:作者" or "title.作者著"
		var authorMatch = rawTitleField.match(/[:：.．]\s*([^:：.．]+)$/);
		if (authorMatch) {
			author = authorMatch[1].trim();
		}
	}
	addCreators(item, author);

	var publisher = getField(fields, ['出版发行', '出版者', '出版社']);
	if (publisher) {
		// "北京:中国社会科学出版社,2024" -> place:publisher,date
		var pubMatch = publisher.match(/^(.+?)[：:]\s*(.+?)[,，;；]\s*(\d{4}[\s\S]*)$/);
		if (pubMatch) {
			item.place = pubMatch[1].trim();
			item.publisher = pubMatch[2].trim();
			item.date = pubMatch[3].trim();
		}
		else {
			// No place prefix, try publisher,date only
			var m = publisher.match(/^(.+?)[,，;；]\s*(\d{4}[\s\S]*)$/);
			if (m) {
				item.publisher = m[1].trim();
				item.date = m[2].trim();
			}
			else if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(publisher.trim()) || /^\d{4}$/.test(publisher.trim())) {
				// It's just a date (e.g. "2015-03-01" or "2024"), not a publisher
				item.date = publisher.trim();
			}
			else {
				item.publisher = publisher;
			}
		}
	}

	var date = getField(fields, ['出版日期', '出版年', '年份', '日期']);
	if (date) item.date = date;

	var isbn = getField(fields, ['ISBN']);
	if (isbn) {
		var isbnMatch = isbn.match(/([\dXx-]{10,})/);
		if (isbnMatch) item.ISBN = isbnMatch[1];
	}

	var physical = getField(fields, ['载体形态', '页数', '总页数']);
	if (physical) {
		var pageMatch = physical.match(/(\d+)\s*[页pP]/);
		if (pageMatch) item.numPages = pageMatch[1];
	}

	var abstract = getField(fields, ['提要', '摘要', '文摘', '内容提要']);
	if (abstract) item.abstractNote = abstract;

	var subject = getField(fields, ['学科主题', '主题', '关键词', '非控制主题词']);
	if (subject) {
		item.tags = subject.split(/[,，;；]/).map(function (t) { return t.trim(); }).filter(function (t) { return t; });
	}

	var clc = getField(fields, ['中图法分类号', '分类号']);
	if (clc) item.extra = addExtra('CLC', clc);

	if (itemType === 'thesis') {
		var degree = getField(fields, ['学位']);
		item.thesisType = (degree ? degree + '学位' : '学位') + '论文';
		var univ = getField(fields, ['学位授予单位', '授予单位', '授予机构', '培养单位', '学校']);
		// Skip if value looks like a date (false match from 出版发行项)
		if (univ && !/^\d{4}[-\/.]/.test(univ.trim())) {
			item.university = univ;
		}
	}
	else if (itemType === 'standard') {
		item.number = getField(fields, ['标准号', '标准编号']);
		item.organization = getField(fields, ['发布机构', '团体责任者', '团体次要责任者']);
	}

	item.attachments.push({
		title: '上海外国语大学图书馆 Snapshot',
		url: url,
		mimeType: 'text/html',
		snapshot: false
	});

	item.complete();
}

function detectType(doc) {
	// Search all elements for type indicator 【学位论文】 etc.
	// Check title element first (e.g. div.title___3zGxP contains 【学位论文】title)
	var titleEl = doc.querySelector('[class*="title"]');
	if (titleEl) {
		var titleText = titleEl.textContent;
		if (/【学位论文】/.test(titleText)) return 'thesis';
		if (/【规范文档】/.test(titleText)) return 'book';
		if (/【标准】/.test(titleText)) return 'standard';
		if (/【期刊/.test(titleText)) return 'journalArticle';
		if (/【会议/.test(titleText)) return 'conferencePaper';
		if (/【专利】/.test(titleText)) return 'patent';
	}
	// Broad search: check all elements for type indicators (no length limit)
	var allEls = doc.querySelectorAll('div, span, p, label, h1, h2, h3, h4, a');
	for (var i = 0; i < allEls.length; i++) {
		var t = allEls[i].textContent;
		if (/【学位论文】/.test(t)) return 'thesis';
		if (/【规范文档】/.test(t)) return 'book';
		if (/【标准】/.test(t)) return 'standard';
		if (/【期刊/.test(t)) return 'journalArticle';
		if (/【会议/.test(t)) return 'conferencePaper';
		if (/【专利】/.test(t)) return 'patent';
	}
	return 'book';
}

function getDetailFields(doc) {
	var fields = {};

	// Strategy 1: .col > .marcLeft + .marcRight (book/thesis pages)
	var rows = doc.querySelectorAll('.col');
	for (var i = 0; i < rows.length; i++) {
		var labelEl = rows[i].querySelector('.marcLeft');
		var valueEl = rows[i].querySelector('.marcRight');
		if (!labelEl || !valueEl) continue;
		var label = ZU.trimInternal(labelEl.textContent).replace(/[【】]/g, '');
		if (label) fields[label] = valueEl;
	}
	if (Object.keys(fields).length > 0) return fields;

	// Strategy 2: p > span (label) + span.content___* (value) (standard doc pages)
	var pRows = doc.querySelectorAll('p');
	for (var j = 0; j < pRows.length; j++) {
		var spans = pRows[j].querySelectorAll(':scope > span');
		var labelSpan = null;
		var valueSpan = null;
		for (var k = 0; k < spans.length; k++) {
			var spanText = ZU.trimInternal(spans[k].textContent);
			if (/^【.+?】$/.test(spanText)) {
				labelSpan = spans[k];
			}
			else if (spans[k].className && /content/.test(spans[k].className)) {
				valueSpan = spans[k];
			}
		}
		if (labelSpan && valueSpan) {
			var fieldLabel = ZU.trimInternal(labelSpan.textContent).replace(/[【】]/g, '');
			if (fieldLabel) fields[fieldLabel] = valueSpan;
		}
	}
	if (Object.keys(fields).length > 0) return fields;

	// Strategy 3: find span elements with 【label】 text, get next sibling span
	var spanEls = doc.querySelectorAll('span');
	for (var m = 0; m < spanEls.length; m++) {
		var spanText3 = ZU.trimInternal(spanEls[m].textContent);
		var match = spanText3.match(/^【(.+?)】$/);
		if (match) {
			var fieldLabel3 = match[1];
			var nextSpan = spanEls[m].nextElementSibling;
			if (nextSpan && nextSpan.textContent.trim()) {
				fields[fieldLabel3] = nextSpan;
			}
		}
	}

	return fields;
}

function getField(fields, labels) {
	if (!Array.isArray(labels)) labels = [labels];
	// Pass 1: exact match (avoid "责任者" matching "题名/责任者")
	for (var i = 0; i < labels.length; i++) {
		for (var key in fields) {
			if (key === labels[i]) return ZU.trimInternal(fields[key].textContent);
		}
	}
	// Pass 2: partial match
	for (var j = 0; j < labels.length; j++) {
		var re = new RegExp(labels[j], 'i');
		for (var key2 in fields) {
			if (re.test(key2)) return ZU.trimInternal(fields[key2].textContent);
		}
	}
	return '';
}

function addCreators(item, authorString) {
	if (!authorString) return;
	authorString = authorString.replace(/[著编译辑撰注校订整理主编]+$/, '').trim();
	// Remove nationality prefix like (澳)
	authorString = authorString.replace(/^\([\u4e00-\u9fa5]{1,3}\)\s*/, '');

	// Split by commas/semicolons, but not inside parentheses
	var names = authorString.split(/[,，;；](?![^(]*\))/);

	// Merge Chinese name + immediately following Western parenthetical
	// e.g. ["皮姆", "(Pym,Anthony)"] → ["皮姆(Pym,Anthony)"]
	var mergedNames = [];
	for (var i = 0; i < names.length; i++) {
		var n = names[i].trim();
		if (!n) continue;
		if (mergedNames.length > 0 && /^\([A-Za-z]/.test(n) && /[\u4e00-\u9fa5]/.test(mergedNames[mergedNames.length - 1])) {
			mergedNames[mergedNames.length - 1] += n;
		}
		else {
			mergedNames.push(n);
		}
	}

	for (var j = 0; j < mergedNames.length; j++) {
		var name = mergedNames[j].trim();
		if (!name) continue;

		// Check for Western name in parentheses: 皮姆(Pym,Anthony) or (Pym,Anthony)
		var westernMatch = name.match(/\(([A-Za-z][^)]+)\)/);
		if (westernMatch) {
			var creator = ZU.cleanAuthor(westernMatch[1], 'author');
			if (creator.lastName) {
				item.creators.push(creator);
				continue;
			}
		}

		// Remove any parenthetical content for Chinese name
		name = name.replace(/\([^)]*\)/g, '').trim();
		if (!name) continue;

		if (/[\u4e00-\u9fa5]/.test(name)) {
			item.creators.push({
				lastName: name,
				creatorType: 'author',
				fieldMode: 1
			});
		}
		else {
			var creator2 = ZU.cleanAuthor(name, 'author');
			if (creator2.lastName) {
				item.creators.push(creator2);
			}
		}
	}
}

function addExtra(key, value) {
	return value ? key + ': ' + value + '\n' : '';
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/96254981",
		"items": [
			{
				"itemType": "book",
				"title": "中外歌曲翻译史研究:1949-2019",
				"creators": [],
				"language": "zh-CN",
				"libraryCatalog": "上海外国语大学图书馆",
				"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/96254981",
				"attachments": [
					{
						"title": "上海外国语大学图书馆 Snapshot",
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
		"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/94756248",
		"items": [
			{
				"itemType": "thesis",
				"title": "中国\u201C未来\u201D话语的形成与流变——基于科幻文学翻译史的考察",
				"creators": [],
				"language": "zh-CN",
				"libraryCatalog": "上海外国语大学图书馆",
				"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/94756248",
				"attachments": [
					{
						"title": "上海外国语大学图书馆 Snapshot",
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
		"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/1257280",
		"items": [
			{
				"itemType": "book",
				"title": "翻译史研究.2014",
				"creators": [],
				"language": "zh-CN",
				"libraryCatalog": "上海外国语大学图书馆",
				"url": "https://findshisu.libsp.cn/#/searchList/bookDetails/1257280",
				"attachments": [
					{
						"title": "上海外国语大学图书馆 Snapshot",
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
		"url": "https://findshisu.libsp.cn/#/searchList",
		"items": "multiple"
	}
]
/** END TEST CASES **/

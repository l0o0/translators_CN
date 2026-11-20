{
	"translatorID": "3d11a81c-266c-49bd-9ef2-a60183bb2f7a",
	"label": "ShuKui",
	"creator": "Daxoel",
	"target": "^https?://(www\\.)?shukui\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-08-18 10:00:00"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 4965898

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
	if (/shukui\.net\/book\/\d+\.html/i.test(url)) {
		return 'book';
	}
	if (/shukui\.net\/so\/search\.php/i.test(url) && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const links = doc.querySelectorAll('a[href*="/book/"]');
	for (const link of links) {
		const href = link.href;
		if (!/shukui\.net\/book\/\d+\.html/i.test(href)) continue;
		if (items[href]) continue;
		const title = ZU.trimInternal(link.textContent).replace(/\*/g, '').trim();
		if (!title || title.length < 4) continue;
		// Skip download/trial links
		if (/下载|试读|购买|解压/.test(title)) continue;
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
		await processDocuments(Object.keys(items), scrape);
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, url) {
	const item = new Z.Item('book');
	item.url = url;
	item.libraryCatalog = '书葵网';
	item.language = 'zh-CN';

	// Title: from h1, remove "pdf电子书版本下载" suffix
	const h1 = doc.querySelector('h1');
	let title = h1 ? ZU.trimInternal(h1.textContent) : (doc.title || '');
	title = title.replace(/\s*pdf电子书(版本)?下载$/i, '').trim();
	if (!title) title = doc.title || 'Untitled';
	item.title = title;

	// Parse metadata from <li> items
	const fields = parseListFields(doc);

	// Author: try labeled field first, then unlabeled items
	let author = getField(fields, ['作者', '责任者']);
	if (!author && fields._unlabeled && fields._unlabeled.length > 0) {
		author = fields._unlabeled[0];
	}
	addCreators(item, author);

	// Publisher: "北京：人民教育出版社" → place:publisher
	const publisher = getField(fields, ['出版社', '出版发行']);
	if (publisher) {
		const pubMatch = publisher.match(/^(.+?)[：:]\s*(.+)$/);
		if (pubMatch) {
			item.place = pubMatch[1].trim();
			item.publisher = pubMatch[2].trim();
		}
		else {
			item.publisher = publisher;
		}
	}

	// Date
	const date = getField(fields, ['出版时间', '出版年', '出版日期']);
	if (date && date !== '未知') {
		item.date = date;
	}

	// ISBN
	const isbn = getField(fields, ['ISBN']);
	if (isbn) {
		const isbnMatch = isbn.match(/([\dXx-]{10,})/);
		if (isbnMatch) item.ISBN = isbnMatch[1];
	}

	// Pages
	const pages = getField(fields, ['标注页数', '页数']);
	if (pages) {
		const pageMatch = pages.match(/(\d+)\s*页/);
		if (pageMatch) item.numPages = pageMatch[1];
	}

	// Tags from subject keywords
	const subject = getField(fields, ['主题词', '关键词']);
	if (subject) {
		item.tags = subject.split(/[,，;；\-—－]/)
			.map(function (t) { return t.trim(); })
			.filter(function (t) { return t; });
	}

	// Extra: MD5, file size
	const extraParts = [];
	let md5 = getField(fields, ['MD5']);
	// Fallback: search entire page text for MD5 hash pattern
	if (!md5 && doc.body) {
		const bodyText = doc.body.textContent || '';
		const md5Match = bodyText.match(/MD5[^\d]*([a-fA-F0-9]{32})/);
		if (md5Match) md5 = md5Match[1];
	}
	if (md5) extraParts.push('MD5: ' + md5);
	const fileSize = getField(fields, ['文件大小']);
	if (fileSize) extraParts.push('File Size: ' + fileSize);
	if (extraParts.length > 0) item.extra = extraParts.join('\n');

	// Cover image
	const imgs = doc.querySelectorAll('img');
	for (const img of imgs) {
		if (img.src && /doubaocdn|aka\.doubao/.test(img.src)) {
			item.attachments.push({
				title: 'Cover',
				url: img.src,
				mimeType: 'image/jpeg'
			});
			break;
		}
	}

	item.complete();
}

function parseListFields(doc) {
	const fields = {};
	const unlabeled = [];
	const lis = doc.querySelectorAll('li');
	for (const li of lis) {
		const text = ZU.trimInternal(li.textContent);
		if (!text) continue;
		const match = text.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
		if (match) {
			const label = match[1].trim();
			const value = match[2].trim();
			if (label && value) {
				fields[label] = value;
			}
		}
		else if (/(著|编|组编|主编|编著|撰|校|译|整理|编译|校订|辑|注)$/.test(text)
			|| (/[,，；;]/.test(text) && /[\u4e00-\u9fa5]/.test(text))) {
			// Unlabeled item that looks like author info
			unlabeled.push(text);
		}
	}
	fields._unlabeled = unlabeled;
	return fields;
}

function getField(fields, labels) {
	if (!Array.isArray(labels)) labels = [labels];
	// Pass 1: exact match
	for (const label of labels) {
		if (fields[label]) return fields[label];
	}
	// Pass 2: partial match
	for (const label of labels) {
		const re = new RegExp(label);
		for (const key in fields) {
			if (key === '_unlabeled') continue;
			if (re.test(key)) return fields[key];
		}
	}
	return '';
}

function addCreators(item, authorString) {
	if (!authorString) return;
	// Remove nationality prefix like （中国）or (澳)
	authorString = authorString.replace(/^[（(][\u4e00-\u9fa5]{1,3}[）)]\s*/, '');
	// Split by commas/semicolons, but not inside ASCII parens
	const names = authorString.split(/[,，;；](?![^(]*\))/);

	// Merge Chinese name + immediately following ASCII Western parenthetical
	// e.g. ["皮姆", "(Pym,Anthony)"] → ["皮姆(Pym,Anthony)"]
	const mergedNames = [];
	for (const rawName of names) {
		const n = rawName.trim();
		if (!n) continue;
		if (mergedNames.length > 0 && /^\([A-Za-z]/.test(n)
			&& /[\u4e00-\u9fa5]/.test(mergedNames[mergedNames.length - 1])) {
			mergedNames[mergedNames.length - 1] += n;
		}
		else {
			mergedNames.push(n);
		}
	}

	for (const rawName of mergedNames) {
		let name = rawName.trim();
		if (!name) continue;
		// Strip trailing role markers (per name, repeated for multi-char markers)
		let prev;
		do {
			prev = name;
			name = name.replace(/(组编|主编|编著|编译|校订|整理|等著|等编|等译|著|编|撰|校|译|注|辑)\s*$/, '').trim();
		} while (name !== prev);
		if (!name) continue;

		// Check for Western name in parens (ASCII or Chinese fullwidth)
		// e.g. (Pym,Anthony) or 舒茨（SCHITZ，D.P.）
		const westernMatch = name.match(/[（(]([A-Za-z][^）)]+)[）)]/);
		if (westernMatch) {
			const westernName = westernMatch[1].replace(/，/g, ',');
			const creator = ZU.cleanAuthor(westernName, 'author');
			if (creator.lastName) {
				item.creators.push(creator);
				continue;
			}
			// Fallback: if cleanAuthor failed, use Chinese part
			const chinesePart = name.replace(/[（(][^）)]*[）)]/g, '').trim();
			if (chinesePart && /[\u4e00-\u9fa5]/.test(chinesePart)) {
				item.creators.push({
					lastName: chinesePart,
					creatorType: 'author',
					fieldMode: 1
				});
				continue;
			}
		}

		// Remove parenthetical content (descriptions like 专业心理作家)
		name = name.replace(/\([^)]*\)/g, '').trim();
		name = name.replace(/[（(][^）)]*[）)]/g, '').trim();
		if (!name) continue;

		if (/[\u4e00-\u9fa5]/.test(name)) {
			item.creators.push({
				lastName: name,
				creatorType: 'author',
				fieldMode: 1
			});
		}
		else {
			const creator2 = ZU.cleanAuthor(name, 'author');
			if (creator2.lastName) {
				item.creators.push(creator2);
			}
		}
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.shukui.net/book/3190990.html",
		"items": [
			{
				"itemType": "book",
				"title": "朱智贤心理学文选 理论心理学、发展心理学、心理学小品集",
				"creators": [
					{
						"firstName": "",
						"lastName": "朱智贤",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1989",
				"ISBN": "7107104454",
				"extra": "MD5: 74d7cebcf084820df3a84348a99c7a65\nFile Size: 20MB",
				"language": "zh-CN",
				"libraryCatalog": "书葵网",
				"numPages": "519",
				"place": "北京",
				"publisher": "人民教育出版社",
				"url": "https://www.shukui.net/book/3190990.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.shukui.net/book/930629.html",
		"items": [
			{
				"itemType": "book",
				"title": "心理学与你 带你走进心理学世界",
				"creators": [
					{
						"firstName": "",
						"lastName": "隋岩",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "京师心智",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013",
				"ISBN": "9787509345269",
				"extra": "MD5: cdee8396c8924ce3f1713f0570f6cb75\nFile Size: 49MB",
				"language": "zh-CN",
				"libraryCatalog": "书葵网",
				"numPages": "248",
				"place": "北京",
				"publisher": "中国法制出版社",
				"url": "https://www.shukui.net/book/930629.html",
				"attachments": [],
				"tags": [
					{ "tag": "心理学" },
					{ "tag": "通俗读物" }
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.shukui.net/so/search.php?q=%E5%BF%83%E7%90%86%E5%AD%A6",
		"items": "multiple"
	}
]
/** END TEST CASES **/

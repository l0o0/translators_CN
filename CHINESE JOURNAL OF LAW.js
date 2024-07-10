{
	"translatorID": "d37a0069-cbc7-4b91-8c04-3be2c3bc3e6e",
	"label": "CHINESE JOURNAL OF LAW",
	"creator": "jiaojiaodubai",
	"target": "^https://faxueyanjiu\\.ajcass\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-07-09 15:13:15"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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


function detectWeb(doc, _url) {
	if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	return doc.querySelector('.gdkuang')
		? getListItems(doc, checkOnly)
		: getTableItems(doc, checkOnly);
}

function getTableItems(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = Array.from(doc.querySelectorAll('#tbody24 > tr')).filter(elm => elm.querySelector('input'));
	for (const row of rows) {
		const href = attr(row, 'a:only-child', 'href');
		const title = ZU.trimInternal(row.textContent);
		let pubInfo = '';
		try {
			pubInfo = row.nextElementSibling.nextElementSibling.innerText;
		}
		catch (error) {
			Z.debug(error);
		}
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[JSON.stringify({
			url: href,
			pubInfo: pubInfo
		})] = title;
	}
	return found ? items : false;
}

function getListItems(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.gdkuang > ul');
	for (const row of rows) {
		const href = attr(row, 'li:first-of-type > a', 'href');
		const title = text(row, 'li:first-of-type > a');
		const pubInfo = text(row, 'li:last-child tr:only-child > td:first-child');
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[JSON.stringify({
			url: href,
			pubInfo: pubInfo
		})] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const key of Object.keys(items)) {
			await scrape(JSON.parse(key));
		}
	}
}

async function scrape(keyObj) {
	const itemDoc = await requestDocument(keyObj.url);
	const pubInfo = keyObj.pubInfo.trim();
	Z.debug(pubInfo);
	const newItem = new Z.Item('journalArticle');
	newItem.title = text(itemDoc, '#FileTitle');
	newItem['original-title'] = ZU.capitalizeTitle(text(itemDoc, '#EnTitle'));
	newItem.abstractNote = text(itemDoc, '#Abstract');
	newItem.publicationTitle = '法学研究';
	newItem['original-container-title'] = 'Chinese Journal of Law';
	newItem.volume = tryMatch(pubInfo, /\.\(0*(\d+)\)/, 1) || tryMatch(pubInfo, /,0*(\d+)/, 1);
	newItem.issue = (tryMatch(pubInfo, /\)(.+?):/, 1) || tryMatch(pubInfo, /\((.+?)\)/, 1)).replace(/0*(\d+)/, '$1');
	newItem.pages = tryMatch(pubInfo, /:([\d, ~+-]+)/, 1).replace(/\+/g, ', ').replace(/~/g, '-');
	newItem.date = tryMatch(pubInfo, /^\d+/);
	newItem.DOI = text(itemDoc, '#DOI');
	newItem.ISSN = '1002-896X';
	text(itemDoc, '#Author tr:last-child td:first-child').split(/[;，；、]\s?/).forEach(string => newItem.creators.push({
		firstName: '',
		lastName: string,
		creatorType: 'author',
		fieldMode: 1
	}));
	text(itemDoc, '#KeyWord').split(/[;，；、]\s?/).forEach(string => newItem.tags.push(string));
	const pdfLink = itemDoc.querySelector('#URL > a');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.complete();
}

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
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
		"url": "https://faxueyanjiu.ajcass.com/Home/Index",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://faxueyanjiu.ajcass.com/Magazine/GetIssueContentList2/?PageSize=12&Year=2023&Issue=2",
		"items": "multiple"
	}
]
/** END TEST CASES **/

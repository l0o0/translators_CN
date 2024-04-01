{
	"translatorID": "262ecedb-bb92-4845-a281-cc79af979fbe",
	"label": "TOAJ",
	"creator": "jiaojiaodubai",
	"target": "^https?://toaj\\.stpi\\.narl\\.org",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-01 16:49:31"
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


function detectWeb(doc, url) {
	if (url.includes('/article/')) {
		return 'journalArticle';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.title > a[href*="/article/"], .card > a[href*="/article/"]');
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
	let newItem = new Z.Item('journalArticle');
	let labels = new LabelsX(doc, '.article-field__outer > div');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].textContent)]));
	let extra = new Extra();
	newItem.title = text(doc, '.main-title');
	newItem.abstractNote = labels.getWith('中文摘要');
	extra.set('original-title', ZU.capitalizeTitle(text(doc, '.sub-title')), true);
	try {
		let pubDoc = await requestDocument(attr(doc, '[x-data="content"] > div:first-child > a', 'href'));
		newItem.publicationTitle = text(pubDoc, '.article__banner__text > div');
		extra.set('original-container', text(pubDoc, '.article__banner__text > div', 1), true);
	}
	catch (error) {
		Z.debug(error);
	}
	newItem.volume = tryMatch(text(doc, 'div.font-Space_Grotesk > div'), /0*(\d+)卷/, 1);
	newItem.issue = tryMatch(text(doc, 'div.font-Space_Grotesk > div'), /([a-z]?\d+)期/i, 1).replace(/0*(\d+)/, 1);
	newItem.pages = tryMatch(text(doc, 'div.font-Space_Grotesk > div', 4), /[\d, +-]+/).replace(/\s/g, '');
	newItem.date = ZU.strToISO(text(doc, 'div.font-Space_Grotesk > div', 2));
	newItem.language = 'zh-TW';
	newItem.url = url;
	newItem.libraryCatalog = '臺灣學術期刊開放取用平台';
	let creators = [];
	labels.getWith('作者', true).querySelectorAll('div.gap-1').forEach((element) => {
		let creator = text(element, 'div:first-child');
		creators.push({
			firstName: '',
			lastName: tryMatch(creator, /^[\u4e00-\u9fff]+/),
			fieldMode: 1,
			original: ZU.capitalizeName(tryMatch(creator, /[a-z, -]+$/i))
		});
	});
	if (creators.some(creator => creator.original)) {
		extra.set('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		extra.push('original-author', creator.original);
		delete creator.original;
		newItem.creators.push(creator);
	});
	let pdfLink = doc.querySelector('a.text-decoration-underline');
	if (pdfLink) {
		Z.debug(pdfLink.href);
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.tags = `${labels.getWith('中文關鍵字')}；${labels.getWith('英文關鍵字')}`.split(/[;；]\s*/);
	newItem.extra = extra.toString();
	newItem.complete();
}

class LabelsX {
	constructor(doc, selector) {
		this.innerData = [];
		this.emptyElement = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elementCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elementCopy.removeChild(elementCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elementCopy.childNodes.length > 1) {
					let key = elementCopy.removeChild(elementCopy.firstChild).textContent.replace(/\s/g, '');
					this.innerData.push([key, elementCopy]);
				}
				else {
					let text = ZU.trimInternal(elementCopy.textContent);
					let key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elementCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.innerData.push([key, elementCopy]);
				}
			});
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let results = label
				.map(aLabel => this.getWith(aLabel, element));
			let keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElement
					: '';
		}
		let pattern = new RegExp(label, 'i');
		let keyVal = this.innerData.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElement
				: '';
	}
}

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		let target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		let result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: undefined;
	}

	toString(history = '') {
		this.fields = this.fields.filter(obj => obj.val);
		return [
			this.fields.filter(obj => obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n'),
			history,
			this.fields.filter(obj => !obj.csl).map(obj => `${obj.key}: ${obj.val}`).join('\n')
		].filter(obj => obj).join('\n');
	}
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
/** END TEST CASES **/

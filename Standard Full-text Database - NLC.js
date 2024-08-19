{
	"translatorID": "33ed4133-f48b-45e4-8f00-9b8c22342c0b",
	"label": "Standard Full-text Database - NLC",
	"creator": "018<lyb018@gmail.com>, jiaojiaodubai",
	"target": "https?://vpn2\\.nlc\\.cn/prx",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-16 16:33:47"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>, 2024 jiaojiaoduabi

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
	if (url.includes('/standard/')) {
		return 'standard';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.titleft');
	for (let row of rows) {
		let stdNumber = tryMatch(attr(row, 'a', 'onclick'), ',"(.+)"', 1);
		Z.debug(stdNumber);
		let title = ZU.trimInternal(`${text(row, 'a', 0)} ${text(row, 'a', 1)}`);
		Z.debug(title);
		if (!stdNumber || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[stdNumber] = title;
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (let stdNumber of Object.keys(items)) {
			// browser needed
			Z.debug(`${tryMatch(url, /^.+\/view\//)}standard/${encodeURIComponent(stdNumber)}/?`.replace(/(%)(\w{2})/g, '$125$2'));
			await scrape(await requestDocument(`${tryMatch(url, /^.+\/view\//)}standard/${encodeURIComponent(stdNumber)}/?`.replace(/(%)(\w{2})/g, '$125$2')));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	Z.debug(doc.body.innerText);
	const labels = new Labels(doc, '.detail_content tr:not([height])');
	var newItem = new Z.Item('standard');
	newItem.title = text(doc, '.detail_title .td_content');
	newItem.extra = '';
	newItem.extra += addExtra('original-title', text(doc, '.detail_title .td_content', 1));
	// newItem.abstractNote = 摘要;
	// newItem.organization = 组织;
	// newItem.committee = 委员会;
	// newItem.type = 类型;
	newItem.number = text(doc, '.th_title').replace(/-/g, '—');
	// newItem.versionNumber = 版本;
	newItem.status = labels.get('标准状态');
	newItem.date = labels.get('发布日期');
	newItem.url = url;
	newItem.numPages = tryMatch(labels.get('页数'), /\d+/);
	newItem.language = labels.get('出版语种');
	newItem.libraryCatalog = '国家图书馆标准全文数据库';
	newItem.extra += addExtra('applyDate', labels.get('实施日期'));
	newItem.extra += addExtra('ICS', labels.get('标准ICS号'));
	newItem.extra += addExtra('CCS', labels.get('中标分类号'));
	newItem.extra += addExtra('substitute-for', labels.get('代替标准'));
	newItem.extra += addExtra('substitute-by', labels.get('被代替标准'));
	newItem.extra += addExtra('reference', labels.get('引用标准'));
	newItem.extra += addExtra('adopted', labels.get('采用标准'));
	let pdfLink = doc.querySelector('a[href*="downPdf"]');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
				: '';
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

/**
 * When value is valid, return a key-value pair in string form.
 * @param {String} key
 * @param {*} value
 * @returns
 */
function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://vpn2.nlc.cn/prx/000/http/192.168.182.80:8983/spcweb/view/standard/GB%252FT%25203793-1983/?",
		"items": [
			{
				"itemType": "standard",
				"title": "检索期刊条目著录规则",
				"creators": [],
				"date": "1983-07-02",
				"extra": "original-title: Descriptive rules for entries of retrieval periodicals\napplyDate: 1984-04-01\nICS: 01.140.20\nCCS: A14",
				"libraryCatalog": "国家图书馆标准全文数据库",
				"number": "GB/T 3793—1983",
				"status": "现行",
				"url": "https://vpn2.nlc.cn/prx/000/http/192.168.182.80:8983/spcweb/view/standard/GB%252FT%25203793-1983/?",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]

/** END TEST CASES **/

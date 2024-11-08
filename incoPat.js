{
	"translatorID": "987de44c-15a8-44c8-83ec-1cf03e9f6a32",
	"label": "incoPat",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.incopat\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-08 00:47:43"
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
	if (url.includes('/detail/' && doc.querySelector('#baseInfoTab > .checked'))) {
		return 'patent';
	}
	return false;
}

async function doWeb(doc, url) {
	const labels = new Labels(doc, '.fold_con table > tbody > tr');
	const extra = new Extra();
	const newItem = new Z.Item('patent');
	newItem.title = text(doc, '.title > .overflow');
	extra.set('original-title', text(doc, '.translate .con'), true);
	newItem.abstractNote = text(doc, '.baseInfo_abstract');
	newItem.place = newItem.country = labels.get('国别');
	newItem.assignee = labels.get('标准化当前权利人');
	newItem.patentNumber = text(doc, '.title > :first-child');
	newItem.filingDate = strToISO(labels.get('申请日'));
	newItem.applicationNumber = labels.get('申请号');
	newItem.priorityNumbers = labels.get('优先权号');
	newItem.issueDate = strToISO(labels.get('公开\\(公告\\)日'));
	newItem.legalStatus = text(doc, '#color_box > a', 1);
	newItem.url = url;
	const creatorsZh = labels.get('发明人\\(原始\\)').split('; ');
	const creatorsEn = labels.get('发明人\\(翻译\\)').split('; ');
	const creatorsExt = [];
	for (let i = 0; i < creatorsZh.length; i++) {
		const creator = ZU.cleanAuthor(creatorsZh[i], 'inventor');
		if (/[\u4e00-\u9fa5]/.test(creator.lastName)) {
			creator.fieldMode = 1;
		}
		newItem.creators.push(JSON.parse(JSON.stringify(creator)));
		if (creatorsEn[i]) {
			const creatorEn = ZU.cleanAuthor(ZU.capitalizeName(creatorsEn[i]), 'inventor');
			creator.original = `${creatorEn.firstName} || ${creatorEn.lastName}`;
			extra.set('original-author', creator.original, true);
			creatorsExt.push(creator);
		}
	}
	if (creatorsExt.some(creator => creator.original)) {
		extra.set('creatorsExt', JSON.stringify(creatorsExt));
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.extra = extra.toString();
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
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
		}
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

class Extra {
	constructor() {
		this.fields = [];
	}

	push(key, val, csl = false) {
		this.fields.push({ key: key, val: val, csl: csl });
	}

	set(key, val, csl = false) {
		const target = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		if (target) {
			target.val = val;
		}
		else {
			this.push(key, val, csl);
		}
	}

	get(key) {
		const result = this.fields.find(obj => new RegExp(`^${key}$`, 'i').test(obj.key));
		return result
			? result.val
			: '';
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

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function strToISO(str) {
	return /\d{8}/.test(str)
		? `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`
		: ZU.strToISO(str);
}

/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/

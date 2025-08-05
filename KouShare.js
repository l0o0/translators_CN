{
	"translatorID": "484ef84b-5c00-4564-be1d-d0c034885750",
	"label": "KouShare",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.koushare\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-08-05 08:41:48"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2025 jiaojiaodubai

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
	if (url.includes('/video/details/')) {
		return 'report';
	}
	return false;
}

async function doWeb(doc, url) {
	const data = getLabeledData(
		doc.querySelectorAll('.base-info > .every-baseinfo'),
		row => text(row, '.eb-title'),
		row => row.querySelector('.eb-value'),
		doc.createElement('div')
	);
	const newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, '.video-title');
	newItem.abstractNote = data('报告摘要');
	newItem.place = data('报告地点');
	newItem.institution = data('主办方');
	newItem.date = ZU.strToISO(data('报告时间'));
	newItem.DOI = ZU.cleanDOI(text(doc, '.eq-doi-value'));
	newItem.url = url;
	let names = Array.from(doc.querySelectorAll('.es-name')).map(elm => elm.textContent);
	if (!names.length) {
		names = tryMatch(text(doc, '.eq-normal-value'), /^([^.]+)/).split('、');
	}
	newItem.creators = names.map(cleanAuthor);
	newItem.complete();
}

function getLabeledData(rows, labelGetter, dataGetter, defaultElm) {
	const labeledElm = {};
	for (const row of rows) {
		labeledElm[labelGetter(row, rows)] = dataGetter(row, rows);
	}
	const data = (labels, element = false) => {
		if (Array.isArray(labels)) {
			for (const label of labels) {
				const result = data(label, element);
				if (
					(element && /\S/.test(result.textContent))
					|| (!element && /\S/.test(result))) {
					return result;
				}
			}
			return element ? defaultElm : '';
		}
		const targetElm = labeledElm[labels];
		return targetElm
			? element ? targetElm : ZU.trimInternal(targetElm.textContent)
			: element ? defaultElm : '';
	};
	return data;
}

function cleanAuthor(name) {
	if (/\p{Unified_Ideograph}/u.test(name)) {
		return {
			firstName: '',
			lastName: name,
			creatorType: 'author',
			fieldMode: 1
		};
	}
	return ZU.cleanAuthor(ZU.capitalizeName(name), 'author');
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.koushare.com/video/details/27469",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "量子信息物理与技术",
				"creators": [],
				"date": "2022-05-21",
				"abstractNote": "量子信息是量子力学与信息科学交叉的新兴学科。量子信息技术可以突破现有信息技术的物理局限，使人类社会从经典技术迈入量子技术新时代。本报告将阐述导致量子信息技术超越经典技术性能的物理基础——量子世界的不确定性和非局域性两大特征。正是这些量子特性使量子世界呈现出人们难于理解的奇奇怪怪的量子现象，帮助人们开发出服务于人类社会的量子信息技术。量子计算是这些技术中其中最具有颠覆性的，报告将介绍量子计算发展的状况。",
				"institution": "中国科学技术大学",
				"libraryCatalog": "KouShare",
				"place": "中国科学技术大学",
				"url": "https://www.koushare.com/video/details/27469",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

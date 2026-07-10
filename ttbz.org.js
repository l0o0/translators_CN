{
	"translatorID": "decbdc8b-6d65-46dc-b198-da39f34c306c",
	"label": "ttbz.org",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.ttbz\\.org\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-07-10 05:25:12"
}

/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('/standardDetail/')) {
		return 'standard';
	}
	return false;
}

async function doWeb(doc, url) {
	const newItem = new Z.Item('standard');
	newItem.title = innerText(doc, '.standard-title-main');
	const sections = doc.querySelectorAll('.info-section');
	for (const sec of sections) {
		if (innerText(sec, '.section-title') == '范围') {
			const rows = sec.querySelectorAll('.info-row');
			for (const row of rows) {
				if (innerText(row, '.info-label') == '主要技术内容') {
					newItem.abstractNote = innerText(row, '.info-value');
					break;
				}
			}
			break;
		}
	}
	newItem.type = '团体标准';
	newItem.number = innerText(doc, '.standard-no-text');
	newItem.status = innerText(doc, '.standard-number .el-tag');
	const info = doc.querySelectorAll('.standard-meta-info > .meta-label');
	for (const span of info) {
		const match = /(?<label>[^：]+)：(?<value>.+)/.exec(span.innerText);
		if (match && match.groups && match.groups.label == '公布日期') {
			newItem.date = match.groups.value;
		}
	}
	newItem.url = url;
	newItem.language = 'zh-CN';
	newItem.creators.push({
		lastName: innerText(doc, '.standard-org-notice-row').replace(/^所属团体：/, ''),
		creatorType: 'author',
		fieldMode: 1
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/

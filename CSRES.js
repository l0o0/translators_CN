{
	"translatorID": "ef9b1134-402a-4b91-8a82-507fc56ca9e6",
	"label": "CSRES",
	"creator": "jiaojiaodubai",
	"target": "^https?://(www|doc)\\.csres\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2026-06-23 00:27:01"
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
	if (url.includes('/detail/')) {
		return 'standard';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('tr[title]');
	for (const row of rows) {
		const code = innerText(row, 'td:nth-child(1) > a[href*="/detail/"]');
		const href = attr(row, 'td:nth-child(1) > a[href*="/detail/"]', 'href');
		const title = innerText(row, 'td:nth-child(2)');
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = [code, title].join(" ");
	}
	return found ? items : false;
}

async function doWeb(doc, url) {
	if (detectWeb(doc, url) == 'multiple') {
		const items = await Z.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item('standard');
	const title = doc.querySelector('table > tbody > tr > td > h3');
	if (!title) return;
	newItem.title = title.innerText.replace(/(\p{Unified_Ideograph}) (\p{Unified_Ideograph})/gu, '$1　$2');
	const tr = title.parentElement.parentElement;
	const baseInfo = tr.parentElement.querySelector('tr:nth-child(2) > td:nth-child(2) tr:first-child');
	if (baseInfo) {
		newItem.number = tryMatch(baseInfo.innerText, /(?<=标准编号：)[A-Z\d.\s/-]+/);
		newItem.status = tryMatch(baseInfo.innerText, /(?<=标准状态：)\S+/);
	}
	const subTitles = doc.querySelectorAll('td> table > tbody > tr > td.f14b');
	for (const subtitle of subTitles) {
		if (subtitle.innerText == '标准简介') {
			const td = subtitle.parentElement.parentElement.parentElement.parentElement;
			newItem.abstractNote = innerText(td, 'table:nth-child(2)');
			break;
		}
	}
	const tbodies = doc.querySelectorAll('td[colspan="2"] tbody tbody');
	for (const tbody of tbodies) {
		if (tbody.querySelector('.sh14')) {
			const raw = {};
			const rows = tbody.querySelectorAll('tr');
			for (const row of rows) {
				const label = innerText(row, 'td:first-child strong').replace(/：$/, '');
				const value = innerText(row, 'td:nth-child(2)');
				raw[label] = value;
			}
			const data = new Proxy(raw, {
				get(tartget, prop) {
					const result = tartget[prop];
					return result ? result : "";
				}
			});
			newItem.date = ZU.strToISO(data.发布日期);
			newItem.publisher = data.出版社;
			newItem.url = url;
			newItem.setExtra('original-title', data.英文名称);
			data.归口单位.split('、').forEach((name) => {
				newItem.creators.push({
					lastName: name,
					creatorType: 'author',
					fieldMode: 1
				});
			});
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
		}
	}
	newItem.complete();
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
		"url": "http://www.csres.com/detail/234873.html",
		"items": [
			{
				"itemType": "standard",
				"title": "镁及镁合金化学分析方法　第1部分：铝含量的测定",
				"creators": [
					{
						"lastName": "全国有色金属标准化技术委员会(SAC/TC 243)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-09-06",
				"abstractNote": "GB/T13748的本部分规定了镁及镁合金中铝含量的测定方法。\n本部分方法一适用于镁合金(含锆、铍、钍或稀土)中铝含量的测定。测定范围:0.020%~0.300%。\n本部分方法二适用于镁及镁合金(不含钛、锆、铍、稀土)中铝含量的测定。测定范围:0.0030%~0.300%。\n本部分方法三适用于镁合金(不含锆、钍或稀土)中铝含量的测定。测定范围:1.50%~12.00%。",
				"extra": "original-title: Chemical analysis methods of magnesium and magnesium alloys—Part 1:Determination of aluminium content",
				"libraryCatalog": "CSRES",
				"number": "GB/T 13748.1-2013",
				"publisher": "中国标准出版社",
				"status": "现行",
				"url": "http://www.csres.com/detail/234873.html",
				"attachments": [
					{
						"title": "Snapshot",
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
		"url": "http://doc.csres.com/detail/235421.html",
		"items": [
			{
				"itemType": "standard",
				"title": "化学品分类和标签规范　第3部分：易燃气体",
				"creators": [
					{
						"lastName": "全国危险化学品管理标准化技术委员会(SAC/TC 251)",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2013-10-10",
				"abstractNote": "GB30000的本部分规定了易燃气体的术语和定义、分类标准、判定逻辑和指导、标签。\n本部分适用于易燃气体按联合国《全球化学品统一分类和标签制度》分类和标签。",
				"extra": "original-title: Rules for classification and labelling of chemicals—Part 3:Flammable gases",
				"libraryCatalog": "CSRES",
				"number": "GB 30000.3-2013",
				"publisher": "中国标准出版社",
				"status": "现行",
				"url": "http://doc.csres.com/detail/235421.html",
				"attachments": [
					{
						"title": "Snapshot",
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
		"url": "http://www.csres.com/s.jsp?keyword=%C8%FD%D4%AA&pageNum=1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://doc.csres.com/sort/industry/002006_1.html",
		"items": "multiple"
	}
]
/** END TEST CASES **/

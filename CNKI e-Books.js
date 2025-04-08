{
	"translatorID": "8ca3a3a4-708a-47b2-ac91-261148e0b822",
	"label": "CNKI e-Books",
	"creator": "jiaojiaodubai",
	"target": "^https://book\\.oversea\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-04-08 19:07:53"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	const app = doc.querySelector('#app');
	if (app) {
		Z.monitorDOMChanges(app, { childList: true, subtree: true });
	}
	if (url.includes('pubdetail?')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('.booksealist h2 > a');
	for (const row of rows) {
		const href = row.href;
		const title = ZU.trimInternal(row.textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
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
	const data = getLabeledData(
		doc.querySelectorAll('.dbookintro >.card-body > ul > li'),
		row => tryMatch(row.textContent.trim(), /^([^：]+)：/, 1),
		row => row.querySelector('span'),
		doc.createElement('div')
	);
	const newItem = new Z.Item('book');
	newItem.title = text(doc, '.dbookintro .card-title');
	newItem.abstractNote = text(doc, '.dbabtext').replace(/^摘要/, '');
	newItem.series = data('套系');
	newItem.publisher = data('出版社');
	newItem.date = ZU.strToISO(data('出版日期'));
	newItem.numPages = data('页数').replace(/页$/, '');
	newItem.ISBN = ZU.cleanISBN(data('ISBN'));
	newItem.url = url;
	const creatorsExt = [];
	data('作者').split('；').forEach((group) => {
		const role = tryMatch(group, / (\p{Unified_Ideograph}+)$/u, 1);
		let creatorType = 'author';
		if (role === '' || /著/.test(role)) {
			creatorType = 'author';
		}
		else if (/[编編撰纂]/.test(role)) {
			creatorType = 'editor';
		}
		else if (/[译譯]/.test(role)) {
			creatorType = 'translator';
		}
		else {
			creatorType = 'contributor';
		}
		group.slice(0, -(role.length + 1)).split('，').forEach((fullName) => {
			const country = tryMatch(fullName, /^（(\p{Unified_Ideograph}+)）/u, 1) || tryMatch(fullName, /^\[(\p{Unified_Ideograph}+)\]/u, 1);
			fullName = fullName.slice(country ? country.length + 2 : 0).replace(/\.\s*/, '. ');
			const creator = {
				firstName: '',
				lastName: fullName,
				creatorType,
				fieldMode: 1
			};
			newItem.creators.push(creator);
			creatorsExt.push({
				country,
				...creator
			});
		});
	});
	if (creatorsExt.some(creator => creator.country)) {
		newItem.setExtra('creatorsExt', JSON.stringify(creatorsExt));
	}
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
				if (result) return result;
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
		"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB200303075",
		"items": [
			{
				"itemType": "book",
				"title": "本草备要",
				"creators": [
					{
						"firstName": "",
						"lastName": "汪昂",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑金生",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"ISBN": "9787117241755",
				"abstractNote": "共八卷。汪昂撰，康熙三十三年（1694年）刊，本书可视为临床药物手册，亦为医学门径书。 主要取材于《本草纲目》和《神农本草经疏》。卷首为药性总义，统论药物性味，归经及炮制大要:卷一草部药191种，卷二木部药83种，卷三果部药31种，卷四谷菜部药40种，卷五金石水木部药58种，卷六禽兽部药25种，卷七鳞介鱼虫部药41种，卷八人部药9种，共计478种。每药先辨其气、味、形、色，次述所八经络、功用、主治，并根据药物所属之“十剂“，分记于该药之首。后世刊本又增附药图400余幅，更臻完善。",
				"extra": "creatorsExt: [{\"country\":\"清\",\"firstName\":\"\",\"lastName\":\"汪昂\",\"creatorType\":\"editor\",\"fieldMode\":1},{\"country\":\"\",\"firstName\":\"\",\"lastName\":\"郑金生\",\"creatorType\":\"contributor\",\"fieldMode\":1}]",
				"libraryCatalog": "CNKI e-Books",
				"numPages": "432",
				"publisher": "人民卫生出版社",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB170202076",
		"items": [
			{
				"itemType": "book",
				"title": "日本現代史",
				"creators": [
					{
						"firstName": "",
						"lastName": "長谷川如是閑",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "彭信威",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"ISBN": "9787215104617",
				"abstractNote": "本书以世界为背景叙述了日本自明治维新以来六十年间（1868-1928）的历史，详细论述了明治维新的意义和改革情况、启蒙时代的思想及运动、中日战后日本国民的变化、一战后世界各国思想和政治格局对日本的影响。",
				"extra": "creatorsExt: [{\"country\":\"日\",\"firstName\":\"\",\"lastName\":\"長谷川如是閑\",\"creatorType\":\"author\",\"fieldMode\":1},{\"country\":\"\",\"firstName\":\"\",\"lastName\":\"彭信威\",\"creatorType\":\"translator\",\"fieldMode\":1}]",
				"libraryCatalog": "CNKI e-Books",
				"numPages": "275",
				"publisher": "河南人民出版社",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB200303075",
		"items": [
			{
				"itemType": "book",
				"title": "本草备要",
				"creators": [
					{
						"firstName": "",
						"lastName": "汪昂",
						"creatorType": "editor",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "郑金生",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"ISBN": "9787117241755",
				"abstractNote": "共八卷。汪昂撰，康熙三十三年（1694年）刊，本书可视为临床药物手册，亦为医学门径书。 主要取材于《本草纲目》和《神农本草经疏》。卷首为药性总义，统论药物性味，归经及炮制大要:卷一草部药191种，卷二木部药83种，卷三果部药31种，卷四谷菜部药40种，卷五金石水木部药58种，卷六禽兽部药25种，卷七鳞介鱼虫部药41种，卷八人部药9种，共计478种。每药先辨其气、味、形、色，次述所八经络、功用、主治，并根据药物所属之“十剂“，分记于该药之首。后世刊本又增附药图400余幅，更臻完善。",
				"extra": "creatorsExt: [{\"country\":\"清\",\"firstName\":\"\",\"lastName\":\"汪昂\",\"creatorType\":\"editor\",\"fieldMode\":1},{\"country\":\"\",\"firstName\":\"\",\"lastName\":\"郑金生\",\"creatorType\":\"contributor\",\"fieldMode\":1}]",
				"libraryCatalog": "CNKI e-Books",
				"numPages": "432",
				"publisher": "人民卫生出版社",
				"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB200303075",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB170202076",
		"items": [
			{
				"itemType": "book",
				"title": "日本現代史",
				"creators": [
					{
						"firstName": "",
						"lastName": "長谷川如是閑",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "彭信威",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"ISBN": "9787215104617",
				"abstractNote": "本书以世界为背景叙述了日本自明治维新以来六十年间（1868-1928）的历史，详细论述了明治维新的意义和改革情况、启蒙时代的思想及运动、中日战后日本国民的变化、一战后世界各国思想和政治格局对日本的影响。",
				"extra": "creatorsExt: [{\"country\":\"日\",\"firstName\":\"\",\"lastName\":\"長谷川如是閑\",\"creatorType\":\"author\",\"fieldMode\":1},{\"country\":\"\",\"firstName\":\"\",\"lastName\":\"彭信威\",\"creatorType\":\"translator\",\"fieldMode\":1}]",
				"libraryCatalog": "CNKI e-Books",
				"numPages": "275",
				"publisher": "河南人民出版社",
				"url": "https://book.oversea.cnki.net/chn/pubdetail?sysid=223&resid=6&pykm=OB170202076",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

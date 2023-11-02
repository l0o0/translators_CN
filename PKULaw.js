{
	"translatorID": "27aeafae-3e7c-4ba1-ba93-04727a2922c5",
	"label": "PKULaw",
	"creator": "Zeping Lee",
	"target": "^https?://www\\.pkulaw\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-09-05 05:05:44"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 Zeping Lee

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
	let curMenu = doc.querySelector('#curMenu').value;
	let dbId;
	let element = doc.querySelector('#DbId');
	if (element) {
		dbId = element.value;
	}
	switch (curMenu) {
		case 'law':
			if (dbId === 'protocol') {
				let title = doc.querySelector('h2.title');
				if (title && title.textContent.includes('说明')) {
					return 'report';
				}
				else {
					return 'bill';
				}
			}
			else {
				return 'statute';
			}

		case 'english':
			if (dbId === 'en_law') {
				return 'statute';
			}
			break;

		case 'case':
			return 'case';

		case 'journal':
			return 'journalArticle';
	}
	return false;
}

function doWeb(doc, url) {
	scrape(doc, url);
}

function scrape(doc, url) {
	url = url.replace(/[?#].*/, '');

	let itemType = detectWeb(doc, url);
	if (!itemType) {
		return;
	}

	switch (itemType) {
		case 'statute':
			scrapeStatute(doc, url);
			break;
		case 'report':
			scrapeReport(doc, url);
			break;
		case 'case':
			scrapeCase(doc, url);
			break;
		case 'journalArticle':
			scrapeJournalArticle(doc, url);
			break;
	}
}

function scrapeStatute(doc, url) {
	let item = new Zotero.Item('statute');
	item.url = url;

	// Zotero 要求用于 CSL 的额外字段信息填在 `Extra` 的最前面，所以分开存储
	let extraFields = {};
	let extraContents = {};

	let cliNumber = doc.querySelector('.info').textContent;
	let matches = cliNumber.match(/【法宝引证码】\s*([0-9A-Z.()]+)/);
	if (matches) {
		extraContents['法宝引证码'] = matches[1];
	}
	else {
		matches = cliNumber.match(/\[CLI Code\]\s*([0-9A-Z.()]+)/);
		if (matches) {
			extraContents['CLI Code'] = matches[1];
		}
	}

	let dbId;
	if (doc.querySelector('#DbId')) {
		dbId = doc.querySelector('#DbId').value;
	}
	switch (dbId) {
		case 'lar':  // 地方法规
			extraFields.Type = 'regulation';
			break
		case 'eagn':  // 地方法规
			extraFields.Type = 'treaty';
			break
	}

	item.language = 'zh-CN';
	if (doc.querySelector('#curMenu').value === 'english') {
		item.language = 'en-US';
	}

	// let title = doc.querySelector('#ArticleTitle').textContent;
	// https://www.pkulaw.com/en_law/1fc5de53e239e30bbdfb.html 会报错

	let title;
	let titles = doc.querySelectorAll('h2.title');
	if (titles[0].childNodes.length > 1) {
		title = titles[0].childNodes[0].textContent;
	}
	else {
		title = titles[0].textContent;
	}
	title = title.trim();
	if (item.language === 'zh-CN') {
		let matched = title.match(/(.*)\((.*)\)$/);
		if (matched) {
			title = matched[1];
			let edition = matched[2];
			if (edition.match(/^\d+/)) {
				// 中华人民共和国公司法(2005修订)
				let parts = edition.match(/^(\d+\s*)(.*)/);
				if (parts[1].startsWith('年')) {
					extraFields.Edition = parts[1] + parts[2];
				}
				else {
					extraFields.Edition = parts[1] + '年' + parts[2];
				}
			}
			else {
				// 中华人民共和国民事诉讼法(试行)
				title += '（' + edition + '）';
			}
		}
		if (title.startsWith('中华人民共和国') && extraFields.Type !== 'treaty') {
			item.shortTitle = title.replace('中华人民共和国', '');
		}
		title = title.replace(/\(/g, '（').replace(/\)/g, '）');
	}
	item.title = title;

	if (item.language === 'en-US') {
		if (titles.length === 2) {
			let zhTitle = titles[1].textContent;
			zhTitle = zhTitle.trim().replace(/\(/g, '（').replace(/\)/g, '）');
			extraFields['Original Title'] = zhTitle;
		}
	}

	for (let li of doc.querySelectorAll('.fields li')) {
		let parts = li.textContent.split('：', 2);
		if (parts.length !== 2) {
			continue;
		}
		let field = parts[0].trim();
		if (item.language === 'zh-CN') {
			field = field.replace(/\s+/g, '');
		}
		let value = parts[1].trim().replace(/\s+/g, ' ');
		let dateParts;
		switch (field) {
			case '制定机关':
			case '发布部门':
				for (let span of li.querySelectorAll('span')) {
					let name = span.title;
					if (name && name.length !== 0) {
						item.creators.push({
							lastName: name,
							creatorType: 'author',
							fieldMode: 1
						});
					}
				}
				break;
			case '发文字号':
				if (value.startsWith('中华人民共和国主席令')) {
					// 《法学引注手册》法律文件不著录发文字号
					// extraContents[field] = value;
				}
				else {
					item.number = value;
				}
				break;
			case '公布日期':
			case '发布日期':
			case '签订日期':
			case '颁布日期':
				item.date = value.replace(/\./g, '-');
				break;
			// case '实施日期':
			// case '生效日期':
			// 	extraContents[field] = value.replace(/\./g, '-');
			// 	break;
			case '时效性':
				if (value !== '现行有效') {
					if (value === '失效') {
						extraFields.Status = '已废止';
					}
					// else {
					// 	extraContents[field] = value;
					// }
				}
				break;
			case '效力位阶':
				if (value !== '法律' && value !== '有关法律问题和重大问题的决定') {
					extraFields.Type = 'regulation';
				}
				switch (value) {
					case '有关法律问题和重大问题的决定':
					case '党内法规制度':
						var fullText = doc.querySelector('#divFullText').textContent;
						// Z.debug(fullText);
						var session = fullText.match(/((中国共产党)?第.*?届.*?第.*?次.*?会议)/);
						if (session) {
							item.session = session[1];
						}
						break;
				}
				break;
			case 'Document Number':
				item.number = value;
				break;
			case 'Date Issued':
				dateParts = value.split('-');
				item.date = dateParts[2] + '-' + dateParts[0] + '-' + dateParts[1];
				break;
			// case 'Effective Date':
			// 	dateParts = value.split('-');
			// 	extraContents[field] = dateParts[2] + '-' + dateParts[0] + '-' + dateParts[1];
			// 	break;
			case 'Issuing Authority':
				for (let span of li.querySelectorAll('span')) {
					let name = span.title;
					if (name && name.length !== 0) {
						item.creators.push({
							lastName: name,
							creatorType: 'author',
							fieldMode: 1
						});
					}
				}
				break;
		}
	}

	extraFields = Object.assign(extraFields, extraContents);
	item.extra = Object.entries(extraFields).map(entry => entry[0] + ': ' + entry[1]).join('\n');

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}

function scrapeReport(doc, url) {
	let item = new Zotero.Item('report');
	item.url = url;

	// Zotero 要求用于 CSL 的额外字段信息填在 `Extra` 的最前面，所以分开存储
	let extraFields = {};
	let extraContents = {};

	let cliNumber = doc.querySelector('.info').textContent;
	let matches = cliNumber.match(/【法宝引证码】\s*([0-9A-Z.()]+)/);
	if (matches) {
		extraContents['法宝引证码'] = matches[1];
	}
	else {
		matches = cliNumber.match(/\[CLI Code\]\s*([0-9A-Z.()]+)/);
		if (matches) {
			extraContents['CLI Code'] = matches[1];
		}
	}

	if (doc.querySelector('#DbId').value === 'eagn') {
		extraFields.Type = 'treaty';
	}

	item.language = 'zh-CN';
	if (doc.querySelector('#curMenu').value === 'english') {
		item.language = 'en-US';
	}

	// let title = doc.querySelector('#ArticleTitle').textContent;
	// https://www.pkulaw.com/en_law/1fc5de53e239e30bbdfb.html 会报错

	let title;
	let titles = doc.querySelectorAll('h2.title');
	if (titles[0].childNodes.length > 1) {
		title = titles[0].childNodes[0].textContent;
	}
	else {
		title = titles[0].textContent;
	}
	title = title.trim();
	if (item.language === 'zh-CN') {
		let matched = title.match(/(.*)\((.*)\)$/);
		if (matched) {
			title = matched[1];
			let edition = matched[2];
			if (!edition.match(/^\d+/)) {
				// 中华人民共和国民事诉讼法(试行)
				title += '（' + edition + '）';
			}
		}
		if (title.startsWith('中华人民共和国') && extraFields.Type !== 'treaty') {
			item.shortTitle = title.replace('中华人民共和国', '');
		}
		title = title.replace(/\(/g, '（').replace(/\)/g, '）');
	}
	item.title = title;

	if (item.language === 'en-US') {
		if (titles.length === 2) {
			let zhTitle = titles[1].textContent;
			zhTitle = zhTitle.trim().replace(/\(/g, '（').replace(/\)/g, '）');
			extraFields['Original Title'] = zhTitle;
		}
	}

	for (let li of doc.querySelectorAll('.fields li')) {
		let parts = li.textContent.split('：', 2);
		if (parts.length !== 2) {
			continue;
		}
		let field = parts[0].trim();
		if (item.language === 'zh-CN') {
			field = field.replace(/\s+/g, '');
		}
		let value = parts[1].trim().replace(/\s+/g, ' ');
		switch (field) {
			case '公布日期':
				item.date = value.replace(/\./g, '-');
				break;
		}
	}

	// 引用全国人大及其常委会通过的法律性质的决定，应当标明决定机关、 决定名称、决定时间和会议届次。
	let fullText = doc.querySelector('#divFullText').textContent;
	// Z.debug(fullText);
	let session = fullText.match(/第.*?届.*?第.*?次.*?会议/);
	if (session) {
		extraFields['event-title'] = session[0];
	}

	extraFields = Object.assign(extraFields, extraContents);
	item.extra = Object.entries(extraFields).map(entry => entry[0] + ': ' + entry[1]).join('\n');

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}

function scrapeCase(doc, url) {
	let item = new Zotero.Item('case');

	item.language = 'zh-CN';
	item.url = url;

	let title = doc.querySelector('#ArticleTitle').value;
	title = title.trim().replace(/\(/g, '（').replace(/\)/g, '）');

	let extraFields = {};
	let extraContents = {};

	let cliNumber = doc.querySelector('.info').textContent;
	let matches = cliNumber.match(/【法宝引证码】\s*([0-9A-Z.()]+)/);
	if (matches) {
		extraContents['法宝引证码'] = matches[1];
	}
	else {
		matches = cliNumber.match(/\[CLI Code\]\s*([0-9A-Z.()]+)/);
		if (matches) {
			extraContents['CLI Code'] = matches[1];
		}
	}

	let isGuidingCase = false; // 指导性案例
	if (title.startsWith('指导案例')) {
		isGuidingCase = true;
		title = title.replace(/[^：]*：/, '');
		extraFields.Series = '最高人民法院指导案例';
	}

	var caseType;
	item.caseName = title;
	if (!title.endsWith('裁决书')) {
		extraFields.Genre = '民事判决书';
	}

	for (let li of doc.querySelectorAll('.fields li')) {
		let parts = li.textContent.split('：', 2);
		if (parts.length !== 2) {
			continue;
		}
		let field = parts[0].replace(/\s+/g, '');
		let value = parts[1].trim().replace(/\s+/g, ' ');
		switch (field) {
			case '发布部门':
				for (let span of li.querySelectorAll('span')) {
					let name = span.title;
					if (name && name.length !== 0) {
						item.creators.push({
							lastName: name,
							creatorType: 'author',
							fieldMode: 1
						});
					}
				}
				break;

			case '案号':
				value = value.replace(/\(/g, '（').replace(/\)/g, '）');
				item.docketNumber = value;
				break;

			case '文书类型':
				extraFields.Genre = value;
				break;

			case '审结日期':
			case '裁决日期':
				value = value.replace(/\./g, '-');
				item.dateDecided = value;
				break;

			case '审理法院':
			case '裁决机构':
				item.court = value;
				break;

			case '案例编号':
				if (isGuidingCase) {
					extraFields['Series Number'] = value.match(/(\d+)/)[1];
				}
				break;

			case '来源':
				{
					let reporter = value.match(/《(.*)》/);
					if (reporter) {
						item.reporter = reporter[1];
					}
					let year = value.match(/(\d+)\s*年/);
					if (year && !extraFields['available-date']) {
						extraFields['available-date'] = year[1];
					}
					let issue = value.match(/年第\s*(\d+)\s*期/);
					if (issue) {
						extraFields.Issue = issue[1];
					}
				}
				break;

			case '发布日期':
				value = value.replace(/\./g, '-');
				extraFields['available-date'] = value;
				break;

			case '权责关键词':
				for (let a of li.querySelectorAll('a')) {
					let tag = a.textContent;
					if (tag && tag.length !== 0) {
						item.tags.push(tag);
					}
				}
				break;

			case '案件类型':
			case '案由':
				if (!caseType) {
					for (let caseTypeChoice of ['民事', '刑事', '行政']) {
						if (value.startsWith(caseTypeChoice)) {
							caseType = caseTypeChoice;
							break;
						}
					}
				}
				break;
		}
	}

	if (caseType) {
		extraFields.Genre = caseType + extraFields.Genre;
	}

	extraFields = Object.assign(extraFields, extraContents);
	item.extra = Object.entries(extraFields).map(entry => entry[0] + ': ' + entry[1]).join('\n');

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}

function scrapeJournalArticle(doc, url) {
	let item = new Zotero.Item('journalArticle');

	item.language = 'zh-CN';
	item.libraryCatalog = '北大法宝';
	item.url = url;

	let title = doc.querySelector('#ArticleTitle').value.trim();
	item.title = title;

	let extraFields = {};
	let extraContents = {};

	let cliNumber = doc.querySelector('.info').textContent;
	let matches = cliNumber.match(/【法宝引证码】\s*([0-9A-Z.()]+)/);
	if (matches) {
		extraContents['法宝引证码'] = matches[1];
	}
	else {
		matches = cliNumber.match(/\[CLI Code\]\s*([0-9A-Z.()]+)/);
		if (matches) {
			extraContents['CLI Code'] = matches[1];
		}
	}

	for (let li of doc.querySelectorAll('.fields li')) {
		let parts = li.textContent.split('：', 2);
		if (parts.length !== 2) {
			continue;
		}
		let field = parts[0].replace(/\s+/g, '');
		let value = parts[1].trim().replace(/\s+/g, ' ');
		switch (field) {
			case '期刊名称':
				if (value.includes('《')) {
					value = value.match(/《(.*)》/)[1];
				}
				item.publicationTitle = value;
				break;
			case '期刊年份':
				item.date = value;
				break;
			case '期号':
				item.issue = value;
				break;
			case '页码':
				item.pages = value;
				break;
			case '作者':
				for (let a of li.querySelectorAll('a')) {
					let name = a.textContent;
					if (name && name.length !== 0) {
						item.creators.push({
							lastName: name,
							creatorType: 'author',
							fieldMode: 1
						});
					}
				}
				break;
			case '摘要':
				item.abstractNote = value;
				break;
			case '英文摘要':
				if (item.abstractNote && item.abstractNote.length > 0) {
					item.abstractNote += '\n' + value;
				}
				else {
					item.abstractNote = value;
				}
				break;
			case '关键词':
			case '英文关键词':
				for (let a of li.querySelectorAll('a')) {
					let tag = a.textContent;
					if (tag && tag.length !== 0) {
						item.tags.push(tag);
					}
				}
				break;
		}
	}

	extraFields = Object.assign(extraFields, extraContents);
	item.extra = Object.entries(extraFields).map(entry => entry[0] + ': ' + entry[1]).join('\n');

	item.attachments.push({
		title: 'Snapshot',
		document: doc
	});

	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.pkulaw.com/chl/3ae7651e2659029abdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国刑法修正案（十）",
				"creators": [
					{
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2017-11-04",
				"extra": "法宝引证码: CLI.1.304263",
				"language": "zh-CN",
				"shortTitle": "刑法修正案（十）",
				"url": "https://www.pkulaw.com/chl/3ae7651e2659029abdfb.html",
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
		"url": "https://www.pkulaw.com/chl/e54c465cca59c137bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国公司法",
				"creators": [
					{
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2005-10-27",
				"extra": "Edition: 2005年修订\n法宝引证码: CLI.1.60597",
				"language": "zh-CN",
				"shortTitle": "公司法",
				"url": "https://www.pkulaw.com/chl/e54c465cca59c137bdfb.html",
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
		"url": "https://www.pkulaw.com/chl/98ef6bfbd5f5ecdebdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院、最高人民检察院关于依法严惩破坏计划生育犯罪活动的通知",
				"creators": [
					{
						"lastName": "最高人民法院",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "最高人民检察院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "1993-11-12",
				"extra": "Status: 已废止\nType: regulation\n法宝引证码: CLI.3.8815",
				"language": "zh-CN",
				"publicLawNumber": "法发〔1993〕36号",
				"url": "https://www.pkulaw.com/chl/98ef6bfbd5f5ecdebdfb.html",
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
		"url": "https://www.pkulaw.com/chl/7d823d434f747555bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "全国人民代表大会常务委员会关于严禁卖淫嫖娼的决定",
				"creators": [
					{
						"lastName": "全国人大常委会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "1991-09-04",
				"extra": "法宝引证码: CLI.1.5373",
				"language": "zh-CN",
				"session": "第七届全国人民代表大会常务委员会第二十一次会议",
				"url": "https://www.pkulaw.com/chl/7d823d434f747555bdfb.html",
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
		"url": "https://www.pkulaw.com/chl/dc46bb66e13150b8bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "国务院关于在全国建立农村最低生活保障制度的通知",
				"creators": [
					{
						"lastName": "国务院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2007-07-11",
				"extra": "Type: regulation\n法宝引证码: CLI.2.96270",
				"language": "zh-CN",
				"publicLawNumber": "国发〔2007〕19号",
				"url": "https://www.pkulaw.com/chl/dc46bb66e13150b8bdfb.html",
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
		"url": "https://www.pkulaw.com/chl/0a15442a31eb74f6bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "最高人民法院关于适用《中华人民共和国行政诉讼法》的解释",
				"creators": [
					{
						"lastName": "最高人民法院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2018-02-06",
				"extra": "Type: regulation\n法宝引证码: CLI.3.309904",
				"language": "zh-CN",
				"publicLawNumber": "法释〔2018〕1号",
				"url": "https://www.pkulaw.com/chl/0a15442a31eb74f6bdfb.html",
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
		"url": "https://www.pkulaw.com/chl/4a14adc2c14e5e68bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "国务院关于印发打赢蓝天保卫战三年行动计划的通知",
				"creators": [
					{
						"lastName": "国务院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2018-06-27",
				"extra": "Type: regulation\n法宝引证码: CLI.2.316828",
				"language": "zh-CN",
				"publicLawNumber": "国发〔2018〕22号",
				"url": "https://www.pkulaw.com/chl/4a14adc2c14e5e68bdfb.html",
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
		"url": "https://www.pkulaw.com/lar/c74c0e82aa441b08e9ca1ea4cf401f45bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "山东省高温天气劳动保护办法",
				"creators": [],
				"dateEnacted": "2011-07-28",
				"extra": "Type: regulation\n法宝引证码: CLI.11.518085",
				"language": "zh-CN",
				"publicLawNumber": "山东省人民政府令第239号",
				"url": "https://www.pkulaw.com/lar/c74c0e82aa441b08e9ca1ea4cf401f45bdfb.html",
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
		"url": "https://www.pkulaw.com/lar/03e98798ef205f4a1faf9c788c472e25bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "德阳市人民政府办公室关于印发《德阳市数据要素市场管理暂行办法》的通知",
				"creators": [],
				"dateEnacted": "2022-09-01",
				"extra": "Type: regulation\n法宝引证码: CLI.12.5537956",
				"language": "zh-CN",
				"publicLawNumber": "德办规[2022]10号",
				"url": "https://www.pkulaw.com/lar/03e98798ef205f4a1faf9c788c472e25bdfb.html",
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
		"url": "https://www.pkulaw.com/chl/8e624467ca77636dbdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中共中央关于全面推进依法治国若干重大问题的决定",
				"creators": [
					{
						"lastName": "中国共产党中央委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2014-10-23",
				"extra": "Type: regulation\n法宝引证码: CLI.16.237344",
				"language": "zh-CN",
				"session": "中国共产党第十八届中央委员会第四次全体会议",
				"url": "https://www.pkulaw.com/chl/8e624467ca77636dbdfb.html",
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
		"url": "https://www.pkulaw.com/eagn/8e43a3c4e94eed58d5f18c2194e7b611bdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中华人民共和国与美利坚合众国联合声明",
				"creators": [],
				"dateEnacted": "2011-01-19",
				"extra": "Type: treaty\n法宝引证码: CLI.T.6998",
				"language": "zh-CN",
				"url": "https://www.pkulaw.com/eagn/8e43a3c4e94eed58d5f18c2194e7b611bdfb.html",
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
		"url": "https://www.pkulaw.com/protocol/e0c81a0878b582cddca4c85351d16972bdfb.html",
		"detectedItemType": "report",
		"items": [
			{
				"itemType": "report",
				"title": "关于《中华人民共和国行政诉讼法修正案（草案）》的说明",
				"creators": [],
				"date": "2013-12-23",
				"extra": "event-title: 第十二届全国人民代表大会常务委员会第六次会议\n法宝引证码: CLI.DL.6311",
				"language": "zh-CN",
				"libraryCatalog": "PKULaw",
				"url": "https://www.pkulaw.com/protocol/e0c81a0878b582cddca4c85351d16972bdfb.html",
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
		"url": "https://www.pkulaw.com/en_law/1fc5de53e239e30bbdfb.html",
		"detectedItemType": "statute",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "Individual Income Tax Law of the People's Republic of China (2011 Amendment)",
				"creators": [],
				"dateEnacted": "2011-06-30",
				"extra": "Original Title: 中华人民共和国个人所得税法（2011修正）\nCLI Code: CLI.1.153700(EN)",
				"language": "en-US",
				"publicLawNumber": "Order No.48 of the President of the People's Republic of China",
				"url": "https://www.pkulaw.com/en_law/1fc5de53e239e30bbdfb.html",
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
		"url": "https://www.pkulaw.com/gac/eee05e2473339b35799c78d539298795d5aa7be54a957fa0bdfb.html",
		"detectedItemType": "case",
		"items": [
			{
				"itemType": "case",
				"caseName": "荣宝英诉王阳、永诚财产保险股份有限公司江阴支公司机动车交通事故责任纠纷案",
				"creators": [],
				"dateDecided": "2013-06-21",
				"court": "江苏省无锡市中级人民法院",
				"docketNumber": "（2013）锡民终字第497号",
				"extra": "Series: 最高人民法院指导案例\nGenre: 民事判决书\nSeries Number: 24\navailable-date: 2014-01-26\nIssue: 8\n法宝引证码: CLI.C.2125100",
				"language": "zh-CN",
				"reporter": "最高人民法院公报",
				"url": "https://www.pkulaw.com/gac/eee05e2473339b35799c78d539298795d5aa7be54a957fa0bdfb.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "免责事由"
					},
					{
						"tag": "无过错"
					},
					{
						"tag": "证明"
					},
					{
						"tag": "诉讼请求"
					},
					{
						"tag": "过错"
					},
					{
						"tag": "鉴定意见"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pkulaw.com/pfnl/a25051f3312b07f383ab74a250eadc412f753fb855fabeadbdfb.html",
		"detectedItemType": "case",
		"items": [
			{
				"itemType": "case",
				"caseName": "***诉***政府信息公开答复案",
				"creators": [],
				"dateDecided": "2015-07-06",
				"court": "江苏省南通市中级人民法院",
				"extra": "Genre: 行政裁定书\navailable-date: 2015\nIssue: 11\n法宝引证码: CLI.C.7997435",
				"language": "zh-CN",
				"reporter": "最高人民法院公报",
				"url": "https://www.pkulaw.com/pfnl/a25051f3312b07f383ab74a250eadc412f753fb855fabeadbdfb.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "关联性"
					},
					{
						"tag": "合法"
					},
					{
						"tag": "复议机关"
					},
					{
						"tag": "拘留"
					},
					{
						"tag": "政府信息公开"
					},
					{
						"tag": "行政复议"
					},
					{
						"tag": "行政复议"
					},
					{
						"tag": "调取证据"
					},
					{
						"tag": "质证"
					},
					{
						"tag": "违法"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pkulaw.com/pfnl/a25051f3312b07f33e89d5b6de18bc0a79dc89fed63cf848bdfb.html",
		"detectedItemType": "case",
		"items": [
			{
				"itemType": "case",
				"caseName": "***与***合作勘查合同纠纷上诉案",
				"creators": [],
				"dateDecided": "2017-12-16",
				"court": "最高人民法院",
				"docketNumber": "（2011）民一终字第81号",
				"extra": "Genre: 民事判决书\n法宝引证码: CLI.C.10709337",
				"language": "zh-CN",
				"url": "https://www.pkulaw.com/pfnl/a25051f3312b07f33e89d5b6de18bc0a79dc89fed63cf848bdfb.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "代理"
					},
					{
						"tag": "反诉"
					},
					{
						"tag": "发回重审"
					},
					{
						"tag": "另行起诉"
					},
					{
						"tag": "合同约定"
					},
					{
						"tag": "处分原则"
					},
					{
						"tag": "实际履行"
					},
					{
						"tag": "开庭审理"
					},
					{
						"tag": "恶意串通"
					},
					{
						"tag": "折价"
					},
					{
						"tag": "撤销"
					},
					{
						"tag": "支付违约金"
					},
					{
						"tag": "无效"
					},
					{
						"tag": "民事权利"
					},
					{
						"tag": "证人证言"
					},
					{
						"tag": "证据交换"
					},
					{
						"tag": "诉讼请求"
					},
					{
						"tag": "质证"
					},
					{
						"tag": "过错"
					},
					{
						"tag": "违约金"
					},
					{
						"tag": "追认"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pkulaw.com/qikan/ac09f20d2f2de1f270f4052ec6ab6831bdfb.html",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "重罪案件适用认罪认罚从宽制度研析",
				"creators": [
					{
						"lastName": "董兆玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "余斌娜",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "姜玄芳",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "现阶段司法实践中，认罪认罚从宽制度在重罪案件中存在适用率低、不同类型案件适用效果差异大、控辩双方协商性不足以及理论认知偏差等问题。可通过构建梯度化量刑建议制度、完善控辩协商机制，做好证据开示工作，发挥值班律师优势，使认罪认罚从宽制度在重罪案件中更好地适用。",
				"extra": "法宝引证码: CLI.A.1333620",
				"issue": "17",
				"language": "zh-CN",
				"libraryCatalog": "北大法宝",
				"pages": "29",
				"publicationTitle": "中国检察官",
				"url": "https://www.pkulaw.com/qikan/ac09f20d2f2de1f270f4052ec6ab6831bdfb.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "协商机制"
					},
					{
						"tag": "认罪认罚从宽"
					},
					{
						"tag": "重罪案件"
					},
					{
						"tag": "量刑协商"
					},
					{
						"tag": "量刑建议"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.pkulaw.com/qikan/aebfbcc845e9ece9fc3803f41eb10e2fbdfb.html",
		"detectedItemType": "journalArticle",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "法治视野下的自由贸易港立法权研究——基于央地立法权限互动的视角",
				"creators": [
					{
						"lastName": "苏海平",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "陈秋云",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022",
				"abstractNote": "海南作为我国首个确立发展的自由贸易港，立法权限相较自由贸易试验区应当有更大选择空间。自由贸易港立法权构建的实质是中央授权与地方立法的互动，中央授权立法是地方立法权的正当性来源。自由贸易港立法权通过中央立法的地方模式与中央授权的地方立法并行推进。中央立法的地方模式将政策试验通过重大改革于法有据予以法治化，具体表现为地方试验的先行先试权、“央地会同”时期通过创制性立法权制定《海南自由贸易港法》。中央授权的地方立法是由海南依据地方立法权尤其是特殊地方立法权对一些中央权属的事项进行立法规制，特别是《海南自由贸易港法》创设的自由贸易港法规立法权，将扩充自由贸易港的地方立法权限。\nHainan Free Trade Port (FTP), as the first free trade port established in China, Legislative competence should also have more choices than China Free Trade Pilot Zone. The essence of the construction of the legislative power of FTP is the interaction between the central authorization and the local legislation, and the central authorization legislation is the source of the legitimacy of the local legislative power. The legislative power of FTP is carried forward in parallel with the local legislation authorized by the central government through the local model of central legislation. The local model of central legislation will make the policy experiment ruled by law through major reform, which is embodied in the first test right of local experiment and the formulation of the Hainan Free Trade Port Law (FTPL) through the creative legislative power during the period of “Central and local cooperation”. The local legislation authorized by the central government is the legislative power of Hainan to make laws and regulations on some matters of central ownership according to the local legislative power, especially the special local legislative power, especially the legislative power of the free trade port established by the FTPL, which will expand the local legislative power of the FTP.",
				"extra": "法宝引证码: CLI.A.1333761",
				"issue": "5",
				"language": "zh-CN",
				"libraryCatalog": "北大法宝",
				"pages": "70",
				"publicationTitle": "上海对外经贸大学学报",
				"url": "https://www.pkulaw.com/qikan/aebfbcc845e9ece9fc3803f41eb10e2fbdfb.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "Hainan Free Trade Port Law"
					},
					{
						"tag": "authorized legislation"
					},
					{
						"tag": "free trade port regulations"
					},
					{
						"tag": "local legislative power"
					},
					{
						"tag": "the central-local relation"
					},
					{
						"tag": "地方立法权"
					},
					{
						"tag": "央地关系"
					},
					{
						"tag": "授权立法"
					},
					{
						"tag": "海南自由贸易港法"
					},
					{
						"tag": "自由贸易港法规"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

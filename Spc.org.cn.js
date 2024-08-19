{
	"translatorID": "3cf79f02-f4af-4392-8b84-26c2bdae2607",
	"label": "Spc.org.cn",
	"creator": "018<lyb018@gmail.com>",
	"target": "https?://www\\.spc\\.org\\.cn",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-03 07:22:12"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 018<lyb018@gmail.com>

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
	if (url.includes('/online/')) {
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
	var rows = doc.querySelectorAll('li > a[href*="/online/"]:nth-child(2), .titleft > a[href*="/online/"]:nth-child(2)');
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
	var newItem = new Z.Item('standard');
	newItem.extra = '';
	const labels = new Labels(doc, '.detailedinfo-content-collapse > li');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	newItem.title = labels.get('标准名称');
	newItem.abstractNote = text(doc, '.detailedinfo-text');
	newItem.number = labels.get('标准号').replace('-', '—');
	newItem.status = labels.get('标准状态');
	newItem.date = labels.get('发布日期');
	newItem.url = url;
	newItem.numPages = labels.get('页数');
	newItem.language = {
		中文简体: 'zh-CN'
	}[labels.get('出版语种')];
	newItem.libraryCatalog = '中国标准在线服务网';
	newItem.extra += addExtra('original-title', labels.get('英文名称'));
	newItem.extra += addExtra('applyDate', labels.get('实施日期'));
	newItem.extra += addExtra('ICS', labels.get('标准ICS号'));
	newItem.extra += addExtra('CCS', labels.get('中标分类号'));
	newItem.extra += addExtra('draftsman', labels.get('起草人'));
	newItem.extra += addExtra('drafting-committee', labels.get('起草单位'));
	newItem.extra += addExtra('presenter', labels.get('提出部门'));
	newItem.extra += addExtra('substitute-for', labels.get('替代以下标准'));
	newItem.extra += addExtra('substitute-by', labels.get('被以下标准替代'));
	newItem.extra += addExtra('reference', labels.get('引用标准'));
	newItem.extra += addExtra('adopted', labels.get('采用标准'));
	newItem.creators.push({
		firstName: '',
		lastName: labels.get('归口单位').replace(/\(.*\)$/, ''),
		creatorType: 'author',
		fieldMode: 1
	});
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

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function addExtra(key, value) {
	return value
		? `${key}: ${value}\n`
		: '';
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.spc.org.cn/online/75a5d85b40a9a7c6a780bdb4e3c554e7.html",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献 参考文献著录规则",
				"creators": [
					{
						"firstName": "",
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"abstractNote": "本标准规定了各个学科、各种类型信息资源的参考文献的著录项目、著录顺序、著录用符号、著录用文字、各个著录项目的著录方法以及参考文献在正文中的标注法。本标准适用于著者和编辑著录参考文献，而不是供图书馆员、文献目录编制者以及索引编辑者使用的文献著录规则。",
				"extra": "original-title: Information and documentation—Rules for bibliographic references and citations to information resources\napplyDate: 2015-12-01\nICS: 01.140.20\nCCS: A14\ndraftsman: 段明莲、白光武、陈浩元、刘曙光、曾燕\ndrafting-committee: 北京大学信息管理系、中国科学技术信息研究所、北京师范大学学报(自然科学版)编辑部、北京大学学报(哲学社会科学版)编辑部、中国科学院文献情报中心\npresenter: 全国信息与文献标准化技术委员会(SAC/TC 4)\nsubstitute-for: GB/T 7714-2005\nsubstitute-by: 无\nreference: GB/T 7408-2005 GB/T 28039-2011 ISO 4\nadopted: ISO 690:2010(E)《信息和文献 参考文献和信息资源引用指南》 NEQ 非等效采用",
				"language": "zh-CN",
				"libraryCatalog": "中国标准在线服务网",
				"numPages": "28 页",
				"number": "GB/T 7714—2015",
				"status": "现行",
				"url": "https://www.spc.org.cn/online/75a5d85b40a9a7c6a780bdb4e3c554e7.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.spc.org.cn/online/250f1d53f87de1fd3d3c7a01dcb37abc.html",
		"items": [
			{
				"itemType": "standard",
				"title": "Information and documentation International Standard Book Number (ISBN)",
				"creators": [
					{
						"firstName": "",
						"lastName": "IT-019",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2018-05-08",
				"abstractNote": "暂无",
				"extra": "original-title: Information and documentation International Standard Book Number (ISBN)\nsubstitute-for: AS/NZS 1519:2006 DR AS/NZS 1519:2018\nsubstitute-by: 无\nreference: 无\nadopted: 无",
				"libraryCatalog": "中国标准在线服务网",
				"number": "AS 1519:2018",
				"status": "现行",
				"url": "https://www.spc.org.cn/online/250f1d53f87de1fd3d3c7a01dcb37abc.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.spc.org.cn/online/ec5a1433fd041050e17cdd5b94499893.html",
		"items": [
			{
				"itemType": "standard",
				"title": "수질 — 배양에 의한 미생물 검사의 일반 요구사항 및 지침",
				"creators": [],
				"date": "2023-11-30",
				"abstractNote": "暂无",
				"extra": "original-title: Water quality — General requirements and guidance for microbiological examinations by culture\nICS: 07.100.20\nsubstitute-for: 无\nsubstitute-by: 无\nreference: 无\nadopted: 无",
				"libraryCatalog": "中国标准在线服务网",
				"numPages": "63 页",
				"number": "KS I ISO 8199",
				"status": "现行",
				"url": "https://www.spc.org.cn/online/ec5a1433fd041050e17cdd5b94499893.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.spc.org.cn/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.spc.org.cn/basicsearch",
		"items": "multiple"
	}
]
/** END TEST CASES **/

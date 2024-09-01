{
	"translatorID": "cd01cf63-90ba-42b4-a505-74d8d14f79d6",
	"label": "National Public Service Platform for Standards Information - China",
	"creator": "Zeping Lee, rnicrosoft, jiaojiaodubai",
	"target": "https?://(std\\.samr\\.gov\\.cn/)|((h|d)bba\\.sacinfo\\.org\\.cn)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-09-01 18:27:37"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 Zeping Lee, 2024 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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
	if (url.includes('Detail')) {
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
	// 依赖浏览器环境
	const rows = doc.querySelectorAll('.s-title td > a');
	for (let row of rows) {
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
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item('standard');
	const extra = new Extra();
	newItem.title = url.includes('/gj/')
		? text(doc, '.page-header+p')
		// 有时会在标题处塞进来一些额外的元素（如附件）
		: text(doc, '.page-header > h4').split('\n')[0];
	const basicInfo = doc.querySelector('div.basic-info');
	newItem.number = getValue(basicInfo, '标准号').replace('-', '—');
	newItem.type = text(doc, '.label-info');
	newItem.status = text(doc, '.label-primary');
	newItem.date = getValue(basicInfo, ['发布日期', '实施日期']);
	newItem.url = url;
	newItem.language = /en/i.test(getValue(basicInfo, '标准语言'))
		? 'en-US'
		: 'zh-CN';
	newItem.libraryCatalog = '全国标准信息公共服务平台';
	extra.set('applyDate', getValue(basicInfo, '实施日期'));
	extra.set('substitute', getValue(basicInfo, '代替标准').replace(/-/g, '—'));
	extra.set('CCS', getValue(basicInfo, '中国标准分类号'));
	extra.set('ICS', getValue(basicInfo, '国际标准分类号'));
	extra.set('industry', getValue(basicInfo, '行业分类'));
	newItem.extra = extra.toString();
	getValue(basicInfo, ['归口单位', '归口部门', '技术归口', '标准发布组织']).split('、').forEach((creator) => {
		newItem.creators.push({
			lastName: creator,
			creatorType: 'author',
			fieldMode: 1
		});
	});
	const pdfLink = doc.querySelector('.page-header a[href*="/attachment/"]');
	if (pdfLink) {
		newItem.attachments.push({
			url: pdfLink.href,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

function getValue(docOrElm, label) {
	if (Array.isArray(label)) {
		const value = label.map(aLabel => getValue(docOrElm, aLabel)).find(aValue => aValue);
		return value
			? value
			: '';
	}
	const labelNodes = docOrElm.querySelectorAll('.basicInfo-item.name');
	for (const labelNode of labelNodes) {
		if (labelNode.textContent.trim() == label) {
			const valueNode = labelNode.nextElementSibling;
			Z.debug(`${label}: ${!!valueNode}`);
			return valueNode
				? ZU.trimInternal(valueNode.textContent)
				: '';
		}
	}
	return '';
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D8055ED3A7E05397BE0A0AB82A",
		"items": [
			{
				"itemType": "standard",
				"title": "信息与文献  参考文献著录规则",
				"creators": [
					{
						"lastName": "全国信息与文献标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-05-15",
				"extra": "applyDate: 2015-12-01\nCCS: A14\nICS: 01.140.20 01 综合、术语学、标准化、文献 01.140 信息学、出版 01.140.20 信息学",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "GB/T 7714—2015",
				"status": "现行",
				"type": "国家标准",
				"url": "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D8055ED3A7E05397BE0A0AB82A",
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
		"url": "https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F23645BB19E05397BE0A0AB44A",
		"items": [
			{
				"itemType": "standard",
				"title": "中文出版物夹用英文的编辑规范",
				"creators": [
					{
						"lastName": "全国新闻出版标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-04-17",
				"extra": "applyDate: 2017-04-17\nCCS: A19\nICS: 01.140.40 01 综合、术语学、标准化、文献 01.140 信息学、出版 01.140.40 出版\nindustry: 文化、体育和娱乐业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "CY/T 154—2017",
				"status": "现行",
				"type": "行业标准-CY 新闻出版",
				"url": "https://std.samr.gov.cn/hb/search/stdHBDetailed?id=8B1827F23645BB19E05397BE0A0AB44A",
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
		"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=3E25D6F98CDEEE0578BCF0333B17EECF",
		"items": [
			{
				"itemType": "standard",
				"title": "Information and documentation — Guidelines for bibliographic references and citations to information resources",
				"creators": [
					{
						"lastName": "ISO",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-06-11",
				"language": "en-US",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "ISO 690:2021",
				"status": "现行",
				"type": "国际标准",
				"url": "https://std.samr.gov.cn/gj/search/gjDetailed?id=3E25D6F98CDEEE0578BCF0333B17EECF",
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
		"url": "https://hbba.sacinfo.org.cn/stdDetail/a3762eff26b8f60e95d5e8b48684b8ef7c07e693e998d3f871f4fd1b63e71e65",
		"items": [
			{
				"itemType": "standard",
				"title": "事故汽车修复技术规范",
				"creators": [
					{
						"lastName": "全国汽车维修标准化技术委员会",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-11-24",
				"extra": "applyDate: 2024-03-01\nsubstitute: JT/T 795—2011\nCCS: R16\nICS: 43.18\nindustry: 交通运输、仓储和邮政业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "JT/T 795—2023",
				"status": "现行",
				"type": "交通",
				"url": "https://hbba.sacinfo.org.cn/stdDetail/a3762eff26b8f60e95d5e8b48684b8ef7c07e693e998d3f871f4fd1b63e71e65",
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
		"url": "https://dbba.sacinfo.org.cn/stdDetail/55959ea756314d917a5749c3abdd01bf7dc2a23593f3d83e1da0c582c894fb2a",
		"items": [
			{
				"itemType": "standard",
				"title": "地理标志产品  黄陵翡翠梨",
				"creators": [],
				"date": "2023-08-07",
				"extra": "applyDate: 2023-09-06\nCCS: B31\nICS: 67.080.10\nindustry: 农、林、牧、渔业",
				"language": "zh-CN",
				"libraryCatalog": "全国标准信息公共服务平台",
				"number": "DB6106/T 209—2023",
				"status": "现行",
				"type": "延安市",
				"url": "https://dbba.sacinfo.org.cn/stdDetail/55959ea756314d917a5749c3abdd01bf7dc2a23593f3d83e1da0c582c894fb2a",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
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
	}
]
/** END TEST CASES **/

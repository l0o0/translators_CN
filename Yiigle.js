{
	"translatorID": "f5189d31-18ea-4e84-bdec-f1d0e75b818b",
	"label": "Yiigle",
	"creator": "jiaojiaodubai",
	"target": "^https://.+?\\.yiigle\\.com",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 12,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-05 09:22:53"
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

/*********************
 * search translator *
 *********************/

function detectSearch(items) {
	return (filterQuery(items).length > 0);
}

/**
 * @param {*} items items or string.
 * @returns an array of DOIs.
 */
function filterQuery(items) {
	Z.debug('input items:');
	Z.debug(items);
	if (!items) return [];

	if (typeof items == 'string' || !items.length) items = [items];

	// filter out invalid queries
	var dois = [], doi;
	for (var i = 0, n = items.length; i < n; i++) {
		if (items[i].DOI && /\/cma\.j/i.test(items[i].DOI) && (doi = ZU.cleanDOI(items[i].DOI))) {
			dois.push(doi);
		}
		else if (typeof items[i] == 'string' && /\/cma\.j/i.test(items[i]) && (doi = ZU.cleanDOI(items[i]))) {
			dois.push(doi);
		}
	}
	Z.debug('return dois:');
	Z.debug(dois);
	return dois;
}

async function doSearch(items) {
	for (let doi of filterQuery(items)) {
		Z.debug(doi);

		/* inspired by https://www.yiigle.com/LinkIn.do?linkin_type=DOI&DOI=10.3760/cma.j.issn.1673-4106.2023.05.005 */
		try {
			let respond = await requestJSON('https://www.yiigle.com/apiVue/linkin/search', {
				method: 'POST',
				// necessary
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					DOI: doi,
					linkin_type: 'DOI' // eslint-disable-line camelcase
				})
			});
			Z.debug(respond);
			if (200 == respond.code) {
				await scrape(await requestDocument(respond.data.result));
			}
			else {
				throw new Error(respond.message);
			}
		}
		catch (error) {
			Z.debug(error);
		}
	}
}

/******************
 * web translator *
 ******************/

function detectWeb(doc, url) {
	let contents = doc.querySelector('.s_Periodical_det_con');
	if (contents) {
		Z.monitorDOMChanges(contents, { childList: true, subtree: true });
	}
	// Chinese Medical Article ID
	if (url.includes('/cmaid/')) {
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
	var rows = doc.querySelectorAll('.s_searchResult_li, h4 > a[href*="/cmaid/"]');
	for (let row of rows) {
		let href = row.localName == 'a'
			? row.href
			: attr(row, 'a[href*="/cmaid/"]', 'href');
		let title = row.localName == 'a'
			? ZU.trimInternal(row.textContent)
			: text(row, '.s_searchResult_li_top > a[title]');
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
		await scrape(doc);
	}
}

async function scrape(doc) {
	let pdfLink = await addAttachment(doc);
	let translator = Zotero.loadTranslator('web');
	// Embedded Metadata
	translator.setTranslator('951c027d-74ac-47d4-a107-9c3069ab7b48');
	translator.setDocument(doc);

	translator.setHandler('itemDone', (_obj, item) => {
		item.itemType = 'journalArticle';
		delete item.number;
		item.date = ZU.strToISO(item.date);
		for (let key of ['volume', 'issue', 'pages']) {
			if (item[key]) {
				item[key] = item[key].replace(/\b0*(\d+)/, '$1');
			}
		}
		item.rights = text(doc, '.foot_copyright');
		item.creators.forEach((creator) => {
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.fieldMode = 1;
			}
		});
		let extra = new Extra();
		extra.set('original-title', ZU.capitalizeTitle(attr(doc, '[name=citation_title]', 'content', 1)), true);
		extra.set('view', text(doc, 'div[title*="阅读数"]'));
		extra.set('download', text(doc, 'div[title*="下载数"]'));
		extra.set('comment', text(doc, 'div[title*="评论数"]'));
		extra.set('like', text(doc, 'div[title*="点赞数"]'));
		extra.set('collect', text(doc, 'div[title*="收藏数"]'));
		extra.set('share', text(doc, 'div[title*="分享数"]'));
		doc.querySelectorAll('.contrib_group_en >  .contrib_group_item').forEach((element) => {
			extra.push('original-creator', element.innerText, true);
		});
		if (pdfLink) {
			Z.debug('pdfLink: ');
			Z.debug(pdfLink);
			item.attachments.push({
				url: pdfLink,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		}
		item.extra = extra.toString(item.extra);
		item.complete();
	});
	await translator.translate();
}

async function addAttachment(doc) {
	try {
		let id = attr(doc, 'meta[name="eprints.eprintid"]', 'content');
		let origin = `${doc.location.protocol}//${doc.location.host}`;
		let respond = await requestJSON(`${origin}/api/resource/auth?`
			+ `resourceId=${id}`
			+ '&resPermType=d'
			+ '&reduceTimes=true'
			+ '&sf_request_type=ajax'
		);
		Z.debug(respond);
		let token = respond.data.token;
		if (!token) throw new Error('get pdf link failed');
		return `${origin}/api/file/downloadPdf?resourceId=${id}&token=${token}`;
	}
	catch (error) {
		Z.debug(error);
		return false;
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
		"url": "https://rs.yiigle.com/cmaid/1361669",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "特应性皮炎湿包疗法临床应用专家共识",
				"creators": [
					{
						"firstName": "",
						"lastName": "中国中西医结合学会皮肤性病专业委员会环境与职业性皮肤病学组",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中华医学会皮肤性病学分会儿童学组",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-04-15",
				"DOI": "10.35541/cjd.20210823",
				"ISSN": "0412-4030",
				"extra": "original-title: Expert consensus on clinical application of wet-wrap therapy for atopic dermatitis\noriginal-creator: Environmental and Occupational Skin Disease Research Group, Committee on Dermatology, Chinese Association of Integrative Medicine;\noriginal-creator: Group on Children, Chinese Society of Dermatology\noriginal-creator: Li Linfeng\noriginal-creator: Ma Lin\nview: 1655\ndownload: 589\ncomment: 0\nlike: 1\ncollect: 58\nshare: 11",
				"issue": "4",
				"language": "zh",
				"libraryCatalog": "rs.yiigle.com",
				"pages": "289-294",
				"publicationTitle": "中华皮肤科杂志",
				"rights": "© 2022《中华医学杂志》社有限责任公司版权所有",
				"url": "https://rs.yiigle.com/cmaid/1361669",
				"volume": "55",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "儿科学"
					},
					{
						"tag": "皮肤病学"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://zhqkyszz.yiigle.com/",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.yiigle.com/Journal/Detail/69",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.yiigle.com/Paper/Search?type=&q=%E8%85%B0%E6%A4%8E&searchType=gj",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "search",
		"input": {
			"DOI": "10.3760/cma.j.issn.1673-4106.2023.05.005"
		},
		"items": [
			{
				"itemType": "journalArticle",
				"title": "老年变应性鼻炎药物治疗现状",
				"creators": [
					{
						"firstName": "",
						"lastName": "沙骥超",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孟粹达",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙立薇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱冬冬",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-09-16",
				"DOI": "10.3760/cma.j.issn.1673-4106.2023.05.005",
				"ISSN": "1673-4106",
				"abstractNote": "null 变应性鼻炎患病率在全球范围内逐年增高，而随着人口老龄化趋势不断加剧，老年变应性鼻炎患者的数量也在不断增加。老年患者身体各项机能随年龄呈进行性衰退，导致免疫状态及诊治过程复杂多变，而规范化的诊疗推荐意见尚不完善。本文主要介绍老年变应性鼻炎的药物治疗疗效、安全性等现状，以期对老年变应性鼻炎的治疗提供参考。",
				"extra": "original-title: Pharmacological therapy and its advances of allergic rhinitis in elderly\nview: 0\ndownload: 0\ncomment: 0\nlike: 0\ncollect: 0\nshare: 0",
				"issue": "5",
				"language": "zh",
				"libraryCatalog": "rs.yiigle.com",
				"pages": "271-275",
				"publicationTitle": "国际耳鼻咽喉头颈外科杂志",
				"rights": "© 2022《中华医学杂志》社有限责任公司版权所有",
				"url": "https://rs.yiigle.com/cmaid/1486848",
				"volume": "47",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "老年医学"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

{
	"translatorID": "550aaf0f-95ba-4ec1-a10d-d5b89e7036af",
	"label": "National Science and Technology Report Service - China",
	"creator": "jiaojiaodubai",
	"target": "^https://www\\.nstrs\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-04-06 11:30:31"
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
	let result = doc.querySelector('#Result');
	if (result) {
		Z.monitorDOMChanges(result, { childList: true, subtree: true });
	}
	if (url.includes('/detail?')) {
		return 'report';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// https://www.nstrs.cn/kjbg/navigation
	// https://www.nstrs.cn/kjbg/SearchResult?wd=%E7%94%B5%E6%9E%81
	var rows = doc.querySelectorAll('#Result tr a.shengle, #Result .BaoGao a.title');
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
			await scrape(doc, url);
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url) {
	let id = url.match(/id=([^#/]+)/)[1];
	let respond = await requestJSON('https://www.nstrs.cn/rest/kjbg/wfKjbg/getFilde', {
		method: 'POST',
		body: `id=${id}`
	});
	if (respond.CODE == 0) {
		respond = respond.RESULT;
		let handler = {
			get(target, prop) {
				let value = target[prop];
				return value
					? value
					: '';
			},
		};
		let proxy = new Proxy(respond, handler);
		let newItem = new Z.Item('report');
		let extra = new Extra();
		newItem.title = proxy.title;
		extra.set('original-title', ZU.capitalizeTitle(proxy.alternativeTitle), true);
		newItem.abstractNote = proxy.abstractCn;
		newItem.reportNumber = id;
		let period = proxy.kjbgType;
		newItem.reportType = '科技报告' + (period ? `（${period}）` : '');
		newItem.place = proxy.kjbgRegion;
		newItem.institution = proxy.prepareOrganization;
		newItem.date = ZU.strToISO(proxy.createTime);
		newItem.url = `https://www.nstrs.cn/kjbg/detail?id=${id}`;
		extra.set('program', proxy.projectName);
		extra.set('project', proxy.projectSubjectName);
		extra.set('projectNumber', proxy.projectSubjectId);
		extra.set('correspondingAuthor', [
			proxy.linkmanName,
			proxy.linkmanAddresss,
			proxy.linkmanEmail,
			proxy.lnkmanPhone
		].filter(s => s).join('，'));
		proxy.creator.split(';').forEach((creator) => {
			newItem.creators.push({
				firstName: '',
				lastName: creator,
				creatorType: 'author',
				fieldMode: 1
			});
		});
		newItem.tags = proxy.keywordsCn.split(';');
		let pdfLink = proxy.kjbgQWAddress;
		Z.debug(pdfLink);
		if (pdfLink) {
			newItem.attachments.push({
				url: pdfLink,
				title: 'Full Text PDF',
				mimeType: 'application/pdf'
			});
		}
		newItem.attachments.push({
			title: 'Snapshot',
			document: doc
		});
		newItem.extra = extra.toString();
		newItem.complete();
	}
	else {
		Z.debug(respond.MESSAGE);
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
		"url": "https://www.nstrs.cn/kjbg/detail?id=A7C478B8-97AB-4D05-9633-42222335D03A",
		"defer": true,
		"items": [
			{
				"itemType": "report",
				"title": "飞腾多核处理器芯层次化片上存储结构研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "周宏伟",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邓让钰",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "曾坤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "冯权友",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨乾明",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2017-11-19",
				"abstractNote": "众多的处理器核资源对访存带宽提出了很高的要求，而且通信和访存距离的增大无可避免。针对飞腾64核处理器访存带宽需求，本研究提出了基于片外存控的层次化存储结构和基于片内存控的层次化存储结构，并对其中的关键问题进行了深入研究并给出了相应的解决方案。提出的层次化片上存储结构提供对数据局部性优化机制的支持，能够减少线程之间的全局通信，结合片上数据移动和迁移机制能够进一步优化全局通信延迟和能效。",
				"extra": "original-title: Research on the hierarchical on-chip memory structure for the Phytium multi-core processor\nprogram: 国家科技重大专项\nproject: 超级计算机处理器研发\nprojectNumber: 2015ZX01028101\ncorrespondingAuthor: 窦强，中国人民解放军国防科技大学，douq@vip.sina.com",
				"institution": "中国人民解放军国防科技大学",
				"libraryCatalog": "National Science and Technology Report Service - China",
				"place": "其他",
				"reportNumber": "A7C478B8-97AB-4D05-9633-42222335D03A",
				"reportType": "科技报告（年度报告）",
				"url": "https://www.nstrs.cn/kjbg/detail?id=A7C478B8-97AB-4D05-9633-42222335D03A",
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
				"tags": [
					{
						"tag": "处理器；层次化；存储"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.nstrs.cn/kjbg/navigation",
		"defer": true,
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.nstrs.cn/kjbg/SearchResult?wd=%E7%94%B5%E6%9E%81&q=TM:%25E7%2594%25B5%25E6%259E%2581",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/

{
	"translatorID": "74ab6c0d-0bb8-46fa-80ab-75538acf7cc6",
	"label": "gov.cn Policy",
	"creator": "jiaojiaodubai",
	"target": "^https?://(sousuo\\.)?www\\.gov\\.cn/(zcwjk|zhengce|gongbao)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-03 11:28:39"
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
	// avoid https://www.gov.cn/zhengce/jiedu/
	if (/\/zhengce\/.*content_\d+\.htm/.test(url)) {
		return text(doc, '.BreadcrumbNav').includes('解读')
			? 'webpage'
			: 'statute';
	}
	else if (/\/gongbao\/.*content_\d+\.htm/.test(url)) {
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
	var rows = Array.from(doc.querySelectorAll('a')).filter(element => /\/(zhengce|gongbao)\/.*content_\d+\.htm/.test(element.href));
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
	var newItem = new Z.Item(detectWeb(doc, url));

	switch (newItem.itemType) {
		case 'statute': {
			// 两个selector分别见
			// https://www.gov.cn/zhengce/zhengceku/2022-08/16/content_5705882.htm
			// https://www.gov.cn/zhengce/zhengceku/2019-06/28/content_5404170.htm
			const labels = new CellLabels(doc, 'table table:only-child td, [class*="pctoubukuang"] > table td');
			Z.debug(labels.innerData.map(arr => [arr[0], ZU.trim(arr[1].innerText)]));
			newItem.nameOfAct = labels.getWith('标题');
			// newItem.code = 法典;
			// newItem.codeNumber = 法典编号;
			newItem.publicLawNumber = labels.getWith('发文字号');
			newItem.dateEnacted = labels.getWith(['发布日期', '成文日期']).replace(/\D/g, '-').replace(/-$/, '');
			labels.getWith('主题分类').split('\\').forEach(tag => newItem.tags.push(tag));
			labels.getWith('发文机关').split(/\s/).forEach((creator) => {
				creator = ZU.cleanAuthor(creator, 'author');
				creator.fieldMode = 1;
				newItem.creators.push(creator);
			});
			break;
		}
		case 'webpage': {
			newItem.title = text(doc, 'h1#ti');
			newItem.websiteTitle = '中国政府网';
			newItem.date = ZU.strToISO(text(doc, '.pages-date'));
			let creator = innerText(doc, '.pages-date > span').slice(3);
			if (/.*部网站/.test(creator)) {
				creator = '中华人民共和国' + creator.replace(/网站$/, '');
			}
			newItem.creators.push({
				firstName: '',
				lastName: creator,
				creatorType: 'author',
				fieldMode: 1
			});
			break;
		}
		case 'journalArticle': {
			newItem.title = ZU.trimInternal(text(doc, '.share-title'));
			newItem.abstractNote = attr(doc, 'meta[name="description"]', 'content');
			newItem.publicationTitle = '中华人民共和国国务院公报';
			newItem.ISSN = '1004-3438';
			newItem.issue = tryMatch(attr(doc, 'meta[name="lanmu"]', 'content'), /(\d+)号/, 1);
			newItem.date = ZU.strToISO(attr(doc, 'meta[name="firstpublishedtime"]'), 'content');
			Array.from(doc.querySelectorAll('[label="右对齐"]'))
				.map(element => element.textContent.replace(/\s/g, ''))
				.filter(string => /^[\u4e00-\u9fff]+$/.test(string))
				.forEach((creator) => {
					creator = ZU.cleanAuthor(creator, 'author');
					creator.fieldMode = 1;
					newItem.creators.push(creator);
				});
			newItem.tags = attr(doc, 'meta[name="keywords"]', 'content').split(';');
			break;
		}
	}
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

class CellLabels {
	constructor(doc, selector) {
		this.innerData = [];
		let cells = Array.from(doc.querySelectorAll(selector)).filter(element => !element.querySelector(selector));
		let i = 0;
		while (cells[i + 1]) {
			this.innerData.push([cells[i].textContent.replace(/\s*/g, ''), cells[i + 1]]);
			i += 2;
		}
	}

	getWith(label, element = false) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.getWith(aLabel, element));
			result = element
				? result.find(element => element.childNodes.length)
				: result.find(element => element);
			return result
				? result
				: element
					? document.createElement('div')
					: '';
		}
		let pattern = new RegExp(label);
		let keyValPair = this.innerData.find(element => pattern.test(element[0]));
		if (element) return keyValPair ? keyValPair[1] : document.createElement('div');
		return keyValPair
			? ZU.trimInternal(keyValPair[1].innerText)
			: '';
	}
}


function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	return match && match[index]
		? match[index]
		: '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.gov.cn/zhengce/zhengceku/2022-08/16/content_5705882.htm",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "关于进一步完善和落实积极生育支持措施的指导意见",
				"creators": [
					{
						"firstName": "",
						"lastName": "卫生健康委",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "发展改革委",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中央宣传部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "教育部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "民政部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "财政部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "人力资源社会保障部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "住房城乡建设部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "人民银行",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "国资委",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "税务总局",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "医保局",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "银保监会",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "全国总工会",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "共青团中央",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "全国妇联",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "中央军委后勤保障部",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2022-07-25",
				"language": "zh-CN",
				"publicLawNumber": "国卫人口发〔2022〕26号",
				"url": "https://www.gov.cn/zhengce/zhengceku/2022-08/16/content_5705882.htm",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "其他"
					},
					{
						"tag": "卫生、体育"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/zhengce/zhengceku/2019-06/28/content_5404170.htm",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "国务院关于促进乡村产业振兴的指导意见",
				"creators": [
					{
						"firstName": "",
						"lastName": "国务院",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2019-06-28",
				"language": "zh-CN",
				"publicLawNumber": "国发〔2019〕12号",
				"url": "https://www.gov.cn/zhengce/zhengceku/2019-06/28/content_5404170.htm",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "农业、林业、水利"
					},
					{
						"tag": "农业、畜牧业、渔业"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/zhengce/202401/content_6923947.htm",
		"items": [
			{
				"itemType": "webpage",
				"title": "商务部外贸司负责人解读《商务部等10部门关于提升加工贸易发展水平的意见》",
				"creators": [
					{
						"firstName": "",
						"lastName": "中华人民共和国商务部",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-03",
				"language": "zh-CN",
				"url": "https://www.gov.cn/zhengce/202401/content_6923947.htm",
				"websiteTitle": "中国政府网",
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
		"url": "https://www.gov.cn/zhengce/202401/content_6924392.htm",
		"items": [
			{
				"itemType": "webpage",
				"title": "我国将推广农村客运车辆代运邮件快件",
				"creators": [
					{
						"firstName": "",
						"lastName": "人民日报",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-05",
				"language": "zh-CN",
				"url": "https://www.gov.cn/zhengce/202401/content_6924392.htm",
				"websiteTitle": "中国政府网",
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
		"url": "https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary?t=zhengcelibrary&q=%E6%94%BF%E5%8A%A1%E6%9C%8D%E5%8A%A1",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/zhengce/jiedu/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/zhengce/index.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/gongbao/2023/issue_10886/202312/content_6921258.html",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "民政部 国家发展改革委 财政部 人力资源社会保障部 自然资源部 住房城乡建设部 农业农村部 商务部 应急管理部 税务总局 市场监管总局关于印发《积极发展老年助餐 服务行动方案》的通知 积极发展老年助餐服务行动方案",
				"creators": [
					{
						"firstName": "",
						"lastName": "民政部国家发展改革委",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "财政部人力资源社会保障部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "自然资源部住房城乡建设部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "农业农村部商务部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "应急管理部税务总局",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "市场监管总局",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "民政部国家发展改革委",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "财政部人力资源社会保障部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "自然资源部住房城乡建设部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "农业农村部商务部",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "应急管理部税务总局",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "市场监管总局",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"ISSN": "1004-3438",
				"abstractNote": "经国务院同意，现将《积极发展老年助餐服务行动方案》印发给你们，请结合实际，认真组织实施。",
				"issue": "35",
				"language": "zh-CN",
				"libraryCatalog": "gov.cn Policy",
				"publicationTitle": "中华人民共和国国务院公报",
				"url": "https://www.gov.cn/gongbao/2023/issue_10886/202312/content_6921258.html",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "民政部"
					},
					{
						"tag": "老年助餐"
					},
					{
						"tag": "通知"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.gov.cn/gongbao/2024/issue_11086/",
		"items": "multiple"
	}
]

/** END TEST CASES **/

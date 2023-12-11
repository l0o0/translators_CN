{
	"translatorID": "44c46760-3a27-4145-a623-9e42b733fbe8",
	"label": "SuperLib",
	"creator": "Xingzhong Lin",
	"target": "https?://.*?\\.ucdrs\\.superlib\\.net",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-04 10:33:26"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin, jiaojiaodubai
	
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
	if (url.includes('/JourDetail')) {
		return "journalArticle";
	}
	else if (url.includes('/bookDetail')) {
		return "book";
	}
	else if (url.includes('/NPDetail')) {
		return "newspaperArticle";
	}
	else if (url.includes('/thesisDetail')) {
		return "thesis";
	}
	else if (url.includes('/CPDetail')) {
		return "conferencePaper";
	}
	else if (url.includes('/patentDetail')) {
		return "patent";
	}
	else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('[name=formid] table table a');
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

async function scrape(doc, url) {
	var itemType = detectWeb(doc, url);
	var hashField = {
		作者: 'author',
		刊名: 'publicationTitle',
		出版日期: 'date',
		日期: 'date',
		期号: 'volume',
		关键词: 'tags',
		摘要: 'abstractNote',
		丛书名: 'series',
		形态项: 'numPages',
		出版项: 'publisher',
		主题词: 'tags',
		学位授予单位: 'university',
		学位名称: 'thesisType',
		导师姓名: 'contributor',
		学位年度: 'date',
		会议名称: 'conferenceName',
		申请号: 'patentNumber',
		申请日期: 'date',
		发明人: 'inventor',
		地址: 'place',
		申请人: 'attorneyAgent',
		ISBN号: 'ISBN'
	};
	var item = new Zotero.Item(itemType);
	item.title = doc.title.replace(/_.*?搜索$/, "");
	item.url = url;
	item.language = 'zh-CN';
	var clickMore = ZU.xpath(doc, "//a[text()='更多...']");
	if (clickMore.length > 0) {
		clickMore[0].click();
	}
	var contents = Array.from(doc.querySelectorAll('dl > dd, #m_top li')).map((element) => {
		let match = element.innerText.match(/^【(.+?)】(.+)/);
		// Z.debug(match);
		return match.length > 2
			? { field: match[1].replace(/\s/g, ''), value: ZU.trimInternal(match[2]) }
			: '';
	}).filter(element => hashField[element.field]);
	for (let { field, value } of contents) {
		if (ZU.getCreatorsForType(itemType).includes(hashField[field])) {
			value = value.split(/[;；]/).forEach(element => {
				element = element.split(/[,，]/);
				if (/等翻?译$/.test(element[element.length - 1])) {
					element = element.map(subElement => ({ name: subElement, creatorType: 'translator' }));
				}
				else {
					element = element.map(subElement => {
						return /译$/.test(subElement)
							? { name: subElement, creatorType: 'transltor' }
							: { name: subElement, creatorType: hashField[field] }
					});
				}
				element.forEach(subElement => item.creators.push(formatName(subElement.name, subElement.creatorType)));
			});

		}
		else if (field == "出版项" && value.match(/[\d.]+$/)) {
			let date = value.match(/[\d.]+$/)[0]
			if (date) {
				date = date.replace('.', '-');
				item.date = date;
			}
			item.place = value.match(/^(.*)：/)[1];
			value = value.replace(`${item.place}：`, '').match(/^(.*?) , /)[1];
		}
		else if (field == '期号' && value.match(/\d+/)) {
			value = value.match(/\d+/)[0];
		}
		else if (hashField[field] == 'tags') {
			value = value.split(/[；;-]/g);
			value.forEach(tag => item.tags.push(tag));
		}
		else {
			item[hashField[field]] = value;
		}
	}
	item.abstractNote = text(doc, '.tu_content').replace(/^内容提要:\n|\s+隐藏更多$/, '');
	item.complete();
}

function formatName(name, creatorType) {
	name = name.replace(/^（.*）|等?(参?副?主?编$|著$|翻?译$)/g, "");
	var creator = {};
	creator = ZU.cleanAuthor(name, creatorType);
	if (/[\u4e00-\u9fa5]/.test(name)) {
		creator.fieldMode = 1;
	}
	return creator;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "卵巢癌基因共表达网络及预后标志物的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "顾云婧",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "朱平",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"publicationTitle": "生物学杂志",
				"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
				"attachments": [],
				"tags": [
					{
						"tag": "加权基因共表达网络分析(WGCNA)"
					},
					{
						"tag": "卵巢癌"
					},
					{
						"tag": "生物标志物"
					},
					{
						"tag": "预后模型"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000017983961&d=215FFAF9EDCF907AB55873FB908C43B2&fenlei=18191301070301",
		"items": [
			{
				"itemType": "book",
				"title": "现代服装测试技术",
				"creators": [
					{
						"firstName": "",
						"lastName": "陈东生",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吕佳",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2019-01",
				"ISBN": "9787566914798",
				"abstractNote": "本书以服装以及着装的主体-人作为研究对象，围绕人和服装之间的关系，从服装诱发的心理认知、生理卫生指标、动作行为三方面，将现代服装的一些测量方法进行了系统的介绍。满足市场导向生产模式的需求。本书提供了一些科学性的、有实际使用价值的现代服装测试方法和技术，帮助服装从业人员充分利用人体工效学方法进行科学的服装测量和研究。",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"numPages": "140",
				"place": "上海",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000017983961&d=215FFAF9EDCF907AB55873FB908C43B2&fenlei=18191301070301",
				"attachments": [],
				"tags": [
					{
						"tag": "服装量裁"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000015416568&d=7C4B0704D86B606CB102A5B3A3EC74CE&fenlei=151206",
		"items": [
			{
				"itemType": "book",
				"title": "基因工程",
				"creators": [
					{
						"firstName": "",
						"lastName": "郑振宇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王秀利",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘丹梅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "宋运贤",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈国梁",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "邵燕",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "胡沂淮",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "阚劲松",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩凤桐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙新城",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李宏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张锐",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王彦芹",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-03",
				"ISBN": "9787560997186",
				"abstractNote": "本书以基因工程的研究步骤及实际操作中的需要为主线，共分12章，包括基因工程的基本概念、基因工程基本技术原理、基因工程的工具酶和克隆载体、目的基因的克隆、外源基因的原核表达系统等。",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"numPages": "375",
				"place": "武汉",
				"series": "全国普通高等院校生物科学类“十二五”规划教材",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000015416568&d=7C4B0704D86B606CB102A5B3A3EC74CE&fenlei=151206",
				"attachments": [],
				"tags": [
					{
						"tag": "基因工程"
					},
					{
						"tag": "教材"
					},
					{
						"tag": "高等学校"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

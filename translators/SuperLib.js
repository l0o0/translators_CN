{
	"translatorID": "44c46760-3a27-4145-a623-9e42b733fbe8",
	"label": "全国图书馆联盟",
	"creator": "Xingzhong Lin",
	"target": "https?://.*?\\.ucdrs\\.superlib\\.net",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-12-13 12:49:28"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2020 Xingzhong Lin
	
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
	} else if (url.includes('/bookDetail')) {
		return "book";
	} else if (url.includes('/NPDetail')) {
		return "newspaperArticle";
	} else if (url.includes('/thesisDetail')) {
		return "thesis";
	} else if (url.includes('/CPDetail')) {
		return "conferencePaper";
	} else if (url.includes('/patentDetail')) {
		return "patent";
	} else if (getSearchResults(doc, true)) {
		return "multiple";
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	// TODO: adjust the CSS selector
	var rows = doc.querySelectorAll('[name=formid] > div.book1');
	for (let row of rows) {
		// TODO: check and maybe adjust
		let href = row.querySelector('a').href;
		// TODO: check and maybe adjust
		let title = ZU.trimInternal(row.querySelector('a').textContent);
		if (!href || !title) continue;
		if (checkOnly) return true;
		found = true;
		items[href] = title;
	}
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc, false), function (items) {
			if (items) ZU.processDocuments(Object.keys(items), scrape);
		});
	}
	else {
		scrape(doc, url);
	}
}

function scrape(doc, url) {
	var itemType = detectWeb(doc, url);
	var hashField = {
		作者: 'author',
		刊名: 'journal',
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
		"ISBN号": 'ISBN'
	};
	var item = new Zotero.Item(itemType);
	item.title = doc.title.replace(/_.*?搜索$/, "");
	item.url = url;
	item.language = 'zh-CN';
	var clickMore = ZU.xpath(doc, "//a[text()='更多...']");
	clickMore.length > 0 ? clickMore[0].click() : null;
	var content = ZU.xpath(doc, "//*[contains(text(), '【')]");
	for (let i = 0; i < content.length; i++) {
		var lineContent = content[i].textContent.split('】');
		if (lineContent.length === 2) {
			var field = lineContent[0].slice(1,).replace(/\s/g, '');
			var value = lineContent[1].trim();
			if (field in hashField && ('attorneyAgent', 'inventor', 'contributor', 'author').indexOf(hashField[field]) >= 0) {
				Z.debug(hashField[field]);
				if (value.length === 2){
					value = value.replace(';', '');
				}
				var names = value.split(/[;，；]/);
				for (let i = 0; i < names.length; i++){
					item.creators.push(formatName(names[i], hashField[field], itemType));
				}
			} else if (field in hashField) {
				if (field == "出版项" && value.match(/[\d\.]+$/)) {
					item.date = value.match(/[\d\.]+$/)[0];
					value = value.replace(" , " + item.date, "");
				}
				if (field == '期号' && value.match(/\d+/)) {
					value = value.match(/\d+/)[0];
				}
				if (field == "关键词") {
					value = value.split(/；|;/);
					value.forEach(tag => item.tags.push({"tag":tag}));
				}
				item[hashField[field]] = value;
			}
		}
	}

	var abstract = ZU.xpath(doc, "//div[contains(text(), '内容提要:')]");
	if (abstract.length > 0) {
		item.abstractNote = abstract[0].innerText.slice(5).trim();
	}
	if (item.abstractNote) {
		item.abstractNote = item.abstractNote.replace(/\s+隐藏更多$/, "");
	}
	item.complete();
}

function formatName(name, creatorType, itemType) {
	if (itemType == 'book') {
		if (name.match(/副?主编$|参编$/)) {
			name = name.replace(/副?主编$|参编$/, "");
			creatorType = "editor";
		} else if (name.match(/著$/)) {
			name = name.replace(/著$/, "");
		}
	}
	var lastSpace = name.lastIndexOf(' ');
	if (name.search(/[A-Za-z]/) !== -1 && lastSpace !== -1) {
		// western name. split on last space
		firstName = name.substr(0, lastSpace);
		lastName = name.substr(lastSpace + 1);
	} else if (name.lastIndexOf("·") > 0) {
		firstName = name;
		lastName = "";
	}
	else {
		// Chinese name. first character is last name, the rest are first name
		firstName = name.substr(1);
		lastName = name.charAt(0);
	}
	return {firstName: firstName,
			lastName: lastName,
			creatorType: creatorType};
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000017983961&d=215FFAF9EDCF907AB55873FB908C43B2&fenlei=18191301070301",
		"items": [
			{
				"itemType": "book",
				"title": "现代服装测试技术",
				"creators": [
					{
						"firstName": "东生",
						"lastName": "陈",
						"creatorType": "author"
					},
					{
						"firstName": "佳",
						"lastName": "吕",
						"creatorType": "author"
					}
				],
				"date": "2019.01",
				"ISBN": "9787566914798",
				"abstractNote": "本书以服装以及着装的主体-人作为研究对象，围绕人和服装之间的关系，从服装诱发的心理认知、生理卫生指标、动作行为三方面，将现代服装的一些测量方法进行了系统的介绍。满足市场导向生产模式的需求。本书提供了一些科学性的、有实际使用价值的现代服装测试方法和技术，帮助服装从业人员充分利用人体工效学方法进行科学的服装测量和研究。",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"numPages": "140",
				"publisher": "上海：东华大学出版社",
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
						"firstName": "振宇",
						"lastName": "郑",
						"creatorType": "author"
					},
					{
						"firstName": "秀利",
						"lastName": "王",
						"creatorType": "editor"
					},
					{
						"firstName": "丹梅",
						"lastName": "刘",
						"creatorType": "author"
					},
					{
						"firstName": "运贤",
						"lastName": "宋",
						"creatorType": "author"
					},
					{
						"firstName": "国梁",
						"lastName": "陈",
						"creatorType": "author"
					},
					{
						"firstName": "燕",
						"lastName": "邵",
						"creatorType": "author"
					},
					{
						"firstName": "沂淮",
						"lastName": "胡",
						"creatorType": "author"
					},
					{
						"firstName": "劲松",
						"lastName": "阚",
						"creatorType": "editor"
					},
					{
						"firstName": "凤桐",
						"lastName": "韩",
						"creatorType": "author"
					},
					{
						"firstName": "新城",
						"lastName": "孙",
						"creatorType": "author"
					},
					{
						"firstName": "宏",
						"lastName": "李",
						"creatorType": "author"
					},
					{
						"firstName": "锐",
						"lastName": "张",
						"creatorType": "author"
					},
					{
						"firstName": "彦芹",
						"lastName": "王",
						"creatorType": "editor"
					}
				],
				"date": "2015.03",
				"ISBN": "9787560997186",
				"abstractNote": "本书以基因工程的研究步骤及实际操作中的需要为主线，共分12章，包括基因工程的基本概念、基因工程基本技术原理、基因工程的工具酶和克隆载体、目的基因的克隆、外源基因的原核表达系统等。",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"numPages": "375",
				"publisher": "武汉：华中科技大学出版社",
				"series": "全国普通高等院校生物科学类“十二五”规划教材",
				"url": "http://book.ucdrs.superlib.net/views/specific/2929/bookDetail.jsp?dxNumber=000015416568&d=7C4B0704D86B606CB102A5B3A3EC74CE&fenlei=151206",
				"attachments": [],
				"tags": [
					{
						"tag": "基因工程-高等学校-教材"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "卵巢癌基因共表达网络及预后标志物的研究",
				"creators": [
					{
						"firstName": "云婧",
						"lastName": "顾",
						"creatorType": "author"
					},
					{
						"firstName": "平",
						"lastName": "朱",
						"creatorType": "author"
					}
				],
				"date": "2020",
				"abstractNote": "卵巢癌是一种早期诊断率低而致死率较高的恶性肿瘤,对其预后标志物的鉴定和生存率的预测仍是生存分析的重要任务。利用卵巢癌预后相关基因构建基因共表达网络,鉴定预后生物标志物并进行生存率的预测。首先,对TCGA(The cancer genome atlas)数据库下载的卵巢癌基因表达数据实施单因素回归分析,利用得到的747个预后相关基因构建卵巢癌预后加权基因共表达网络。其次,考虑网络的生物学意义,利用蛋白质相互作用(Protein-protein interaction, PPI)数据对共表达网络中的模块重新加权,并根据网络中基因的拓扑重要性对基因进行排序。最后,运用Cox比例风险回归对网络中的重要基因构建卵巢癌预后模型,鉴定了3个预后生物标志物。生存分析结果显示,这3个标志物能够显著区分不同预后的患者,较好地预测卵巢癌患者的预后情况。",
				"language": "zh-CN",
				"libraryCatalog": "SuperLib",
				"url": "http://jour.ucdrs.superlib.net/views/specific/2929/JourDetail.jsp?dxNumber=100287199277&d=EDA67F761EA0741D8CCBA19AAE292498&s=%E5%9F%BA%E5%9B%A0%E5%85%B1%E8%A1%A8%E8%BE%BE&ecode=utf-8",
				"volume": "5",
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
	}
]
/** END TEST CASES **/

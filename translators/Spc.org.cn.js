{
	"translatorID": "3cf79f02-f4af-4392-8b84-26c2bdae2607",
	"label": "spc.org.cn",
	"creator": "018<lyb018@gmail.com>",
	"target": "https?://www\\.spc\\.org\\.cn/online",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-12-28 09:47:37"
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

// eslint-disable-next-line
function attr(docOrElem,selector,attr,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.getAttribute(attr):null;}function text(docOrElem,selector,index){var elem=index?docOrElem.querySelectorAll(selector).item(index):docOrElem.querySelector(selector);return elem?elem.textContent:null;}function trim(content){return content.replace(/^[\xA0\s]+/gm, '').replace(/[\xA0\s]+$/gm, '').replace(/\n+/g, '\n').replace(/:\n+/g, ': ').replace(/]\n/g, ']').replace(/】\n/g, '】').replace(/\n\/\n/g, '/')}

// https://aurimasv.github.io/z2csl/typeMap.xml#map-statute

function detectWeb(doc, url) {
	return 'statute';
}

function doWeb(doc, url) {
	scrapeSpc(doc, url);
}

function scrapeSpc(doc, url) {
	if (!url || url.length <= 0) {
		return;
	}
	
	var itemType = detectWeb(doc, url);
	var item = new Zotero.Item(itemType);
	item.url = url;

	var ps = doc.querySelectorAll('#content > div.detailedinfo-main ul > li p');
	for (var p of ps) {
		var tdTitle = p.textContent.replace('：', '').trim();
		if (!p.nextElementSibling) {
			continue;
		}

		var tdContent= p.nextElementSibling.textContent.trim();

		switch (tdTitle) {
			case '标准号':
				item.code = tdContent;
				break;
			case '标准名称':
				item.title = tdContent;
				break;
			case '英文名称':
				item.shortTitle = tdContent;
				break;
			case '出版语种':
				item.language = tdContent;
				break;
			case '标准状态':
				item.extra = tdContent;
				break;
			case '代替标准':
			case '替代以下标准':
				item.history = tdContent;
				break;
			case '实施日期':
				if (tdContent.length > 0) {
					item.dateEnacted = tdContent;
				}
				break;
			case '发布日期':
				if (!item.dateEnacted || item.dateEnacted.length === 0) {
					item.dateEnacted = tdContent;
				}
				break;
			case '标准ICS号':
				item.publicLawNumber = tdContent;
				break;
			case '中标分类号':
				item.codeNumber = tdContent;
				break;
			case '页数':
				item.pages = tdContent.replace(' 页', '');
				break;
			case '起草人':
				for(var c of tdContent.split('、')) {
					item.creators.push({
						lastName: c,
						creatorType: 'author',
						fieldMode: 1
					});
				}
				break;
			case '发布部门':
				item.rights = tdContent;
				break;
			default:
				break;
		}

		//if (tdContent && tdContent.length > 0) {
		//	abstractNote += tdTitle + '：' + tdContent + '\n';
		//}
	}
	item.abstractNote = doc.querySelector('#content > div.detailedinfo-top > div.stand-detail-description').textContent.replace(/标准简介|文前页下载| |\n|\t|/g, '')
		.replace('读者对象：', '\n读者对象：')
		.replace('适用范围：暂无', '');
	
	item.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.spc.org.cn/online/GB%252FT%252028039-2011/?",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "中国人名汉语拼音字母拼写规则",
				"creators": [
					{
						"lastName": "厉兵",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "史定国",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "苏培成",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "李乐毅",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "万锦堃",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"dateEnacted": "2012-02-01",
				"abstractNote": "适用范围：本标准规定了使用汉语拼音字母拼写中国人名的规则，包括汉语人名的拼写规则和少数民族语人名的拼写规则。为了满足应用需要，同时给出了一些特殊场合的变通处理办法。本标准适用于文化教育、编辑出版、中文信息处理及其他方面的中国人名汉语拼音字母拼写。\n读者对象：文化教育、编辑出版、中文信息处理及其他方面的人员。",
				"code": "GB/T 28039-2011",
				"codeNumber": "A14",
				"extra": "现行",
				"language": "中文简体",
				"pages": "8 页",
				"publicLawNumber": "01.140.10",
				"rights": "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
				"shortTitle": "The Chinese phonetic alphabet spelling rules for Chinese names",
				"url": "https://www.spc.org.cn/online/GB%252FT%252028039-2011/?",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.spc.org.cn/online/ISO%252081060-1%2520ed1.0%2520EN/",
		"items": [
			{
				"itemType": "statute",
				"nameOfAct": "Non-invasive sphygmomanometers -- Part 1: Requirements and test methods for non-automated measurement type",
				"creators": [],
				"dateEnacted": "2011-12-17",
				"code": "ISO 81060-1 ed1.0 EN",
				"extra": "现行",
				"language": "EN",
				"pages": "37 页",
				"publicLawNumber": "11.040.10",
				"rights": "ISO",
				"url": "https://www.spc.org.cn/online/ISO%252081060-1%2520ed1.0%2520EN/",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

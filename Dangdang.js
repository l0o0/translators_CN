{
	"translatorID": "ec98c7f1-1f76-43d1-a5fd-fc36428fba58",
	"label": "Dangdang",
	"creator": "018<lyb018@gmail.com>",
	"target": "^https?://(product|search)\\.dangdang\\.com/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-15 19:39:16"
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
	Z.debug('---------- dangdang 2023-12-16 03:28:34 ----------');
	if (url.includes('product')) {
		return 'book';
	}
	else if (url.includes('search') && getSearchResults(doc, true)) {
		return 'multiple';
	}
	return '';
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#search_nature_rg ul li a');
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
	var newItem = new Zotero.Item('book');
	// 标题
	newItem.title = attr(doc, '#product_info > div.name_info > h1', 'title');
	// 作者
	newItem.creators = Array.from(doc.querySelectorAll('#author a'))
		.map(element => ZU.cleanAuthor(element.innerText, 'author'));
	newItem.creators.forEach((element) => {
		if (/[\u4e00-\u9fa5]/.test(element.lastName)) element.fieldMode = 1;
	});

	var data = Array.from(doc.querySelectorAll('#detail_describe > ul li'))
		.map(element => element.innerText)
		.map(element => [tryMatch(element, /^(.+)：/, 1), tryMatch(element, /：(.*)/, 1)]);
	data = {
		innerData: data,
		get: function (label) {
			let keyVal = this.innerData.find(element => element[0].startsWith(label));
			return keyVal ? keyVal[1] : '';
		}
	};
	newItem.ISBN = data.get('国际标准书号ISBN');
	newItem.series = data.get('丛书名');
	// 出版社
	newItem.publisher = text(doc, 'a[dd_name="出版社"]');
	// 出版年
	newItem.date = text(doc, '.messbox_info .t1:nth-child(3)').replace(/出版时间:/, '').replace(/\D$/, '')
.replace(/\D+/g, '-');
	// 简介
	newItem.abstractNote = text(doc, '.descrip > #content-show, #content > .descrip');
	// 中图clc作为标签，需要安装油猴插件：https://greasyfork.org/zh-CN/scripts/408682
	newItem.archiveLocation = text(doc, '#clc');
	newItem.archive = text(doc, '#subject');
	newItem.url = url;
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	let match = string.match(pattern);
	if (match && match[index]) {
		return match[index];
	}
	return '';
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://product.dangdang.com/29113890.html",
		"items": [
			{
				"itemType": "book",
				"title": "个人理财（第11版）（金融学译丛）",
				"creators": [
					{
						"firstName": "",
						"lastName": "E.托马斯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "加曼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "雷蒙德",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "E.福格",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2020-08",
				"ISBN": "9787300256535",
				"abstractNote": "《个人理财》时刻提醒读者记住一句至理名言:努力工作、学习、储蓄和投资，并且做好个人理财规划。本书修订至第11版，已成为世界范围内极有影响力的、知名的个人理财类图书。以“做什么、何时做以及怎样做”为主线，在个人理财方面为你出谋划策，指引你迈向成功。本书18章，分为五个部分，即理财规划、现金管理、收入和资产保护、投资以及退休和遗产规划。每个章节都力图阐述一些理财基本准则，以帮助读者在有生之年更好地进行个人理财。本修订版每章课后都安排了实践活动，新增了朱莉娅理财之旅连载故事，她成功的理财生涯贯穿整个具有挑战性的经济时期，在其故事的尾声，留给读者一个具有挑战性的问题: 根据她的想法，提出你的建议。《个人理财》(第11版)包括30多个新主题，新增100多个文本框、数十个新的名词以及海量的新扩展信息。新版本把个人理财中的各个知识碎片有机地连接起来，形成了一个具有全局性的知识体系，向读者展示了个人理财知识之间的内在联系。*后，预祝本书所有的读者都获得成功！",
				"libraryCatalog": "Dangdang",
				"publisher": "中国人民大学出版社",
				"series": "金融学译丛",
				"url": "http://product.dangdang.com/29113890.html",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://search.dangdang.com/?key=9787300256535&act=input",
		"items": "multiple"
	}
]
/** END TEST CASES **/

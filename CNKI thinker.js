{
	"translatorID": "5393921c-d543-4b3a-a874-070b5d73b03a",
	"label": "CNKI thinker",
	"creator": "jiaojiaodubai",
	"target": "^https?://thinker\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-28 16:03:07"
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
	let searchPanel = doc.querySelector('#ModuleSearchResult, #searchlistdiv');
	if (searchPanel) {
		Z.monitorDOMChanges(searchPanel, { subtree: true, childList: true });
	}
	if (url.includes('book/bookdetail')) {
		// 知网心可图书馆，CNKI thingker
		return 'book';
	}
	else if (url.includes('chapter/chapterdetail')) {
		// 知网心可图书馆，CNKI thingker
		return 'bookSection';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('#ModuleSearchResult .name > a, #searchlistdiv td:nth-child(3) > a');
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
	Z.debug(doc.body.innerText);
	var newItem = new Z.Item(detectWeb(doc, url));
	newItem.title = text(doc, '#b-name, .art-title > h1');
	newItem.abstractNote = text(doc, '[name="contentDesc"], .desc-content').replace(/\n+/, '\n');
	newItem.creators = text(doc, '.xqy_b_mid li:nth-child(2), .art-title > .art-name')
		.replace(/^责任者：/, '')
		.replace(/\s+/, ' ')
		.split(/\s/)
		.map(creator => ZU.cleanAuthor(creator, 'author'));
	newItem.creators.forEach(creator => creator.fieldMode = 1);
	let labels = new TextLabels(doc, '.bc_a, .desc-info');
	Z.debug(labels.data.map(arr => [arr[0], ZU.trimInternal(arr[1])]));
	newItem.edition = labels.get('版次');
	switch (newItem.itemType) {
		case 'book':
			newItem.numPages = labels.get('页数');
			break;
		case 'bookSection':
			newItem.bookTitle = text(doc, '.book-p');
			newItem.pages = labels.get('页码');
			break;
	}
	newItem.publisher = text(doc, '.xqy_g') || labels.get('出版社');
	newItem.date = ZU.strToISO(labels.get('出版时间').replace(/(\d{4})(0?\d{1,2})(\d{1,2})/, '$1-$2-$3'));
	newItem.language = 'zh-CN';
	newItem.ISBN = labels.get('国际标准书号ISBN') || tryMatch(url, /bookcode=(\d{10,13})/, 1);
	newItem.url = url;
	newItem.libraryCatalog = labels.get('所属分类');
	newItem.notes.push(innerText(doc, '.xqy_bd'));
	extra.add('CNKICite', text(doc, '.book_zb_yy span:last-child'));
	extra.add('price', text(doc, '#OriginalPrice'));
	extra.add('view', text(doc, '#readSum'));
	newItem.extra = extra.toString();
	newItem.complete();
}


class TextLabels {
	constructor(doc, selector) {
		Z.debug(text(doc, selector)
			.replace(/^[\s\n]*/gm, '')
			.replace(/:\n/g, ': ')
			.replace(/\n\/\n/g, ' / ')
			// https://book.douban.com/subject/1291204/
			.replace(/\n([^】\]:：]+?\n)/g, ' $1')
			.split('\n'));
		// innerText在详情页表现良好，但在多条目表现欠佳，故统一使用经过处理的text
		this.data = text(doc, selector)
			.replace(/^[\s\n]*/gm, '')
			.replace(/:\n/g, ': ')
			.replace(/\n\/\n/g, ' / ')
			// https://book.douban.com/subject/1291204/
			.replace(/\n([^】\]:：]+?\n)/g, ' $1')
			.split('\n')
			.map(keyVal => [
				tryMatch(keyVal, /^[[【]?([\s\S]+?)[】\]:：]\s*[\s\S]+$/, 1).replace(/\s/g, ''),
				tryMatch(keyVal, /^[[【]?[\s\S]+?[】\]:：]\s*([\s\S]+)$/, 1)
			]);
	}

	get(label) {
		if (Array.isArray(label)) {
			let result = label
				.map(aLabel => this.get(aLabel))
				.find(value => value);
			return result
				? result
				: '';
		}
		let pattern = new RegExp(label);
		let keyVal = this.data.find(element => pattern.test(element[0]));
		return keyVal
			? ZU.trimInternal(keyVal[1])
			: '';
	}
}

/**
 * Attempts to get the part of the pattern described from the character,
 * and returns an empty string if not match.
 * @param {String} string
 * @param {RegExp} pattern
 * @param {Number} index
 * @returns
 */
function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

const extra = {
	clsFields: [],
	elseFields: [],
	add: function (key, value, cls = false) {
		if (value && cls) {
			this.clsFields.push([key, value]);
		}
		else if (value) {
			this.elseFields.push([key, value]);
		}
	},
	toString: function () {
		return [...this.clsFields, ...this.elseFields]
			.map(entry => `${entry[0]}: ${entry[1]}`)
			.join('\n');
	}
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://thinker.cnki.net/bookstore/book/bookdetail?bookcode=9787111520269000&type=book",
		"items": [
			{
				"itemType": "book",
				"title": "近红外光谱技术在食品品质检测方法中的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘翠玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015-01-01",
				"ISBN": "9787111520269",
				"abstractNote": "本书从社会实际需求出发，根据多年的科研经验和成果，与多年从事测控信息处理、食品等相关专业的研究人员合作，融入许多解决实际问题的研究和实践成果，系统介绍了本课题组基于近红外光谱分析技术在果蔬类农药残留量的检测、食用植物油品质、小麦粉、淀粉的品质检测中的应用研究成",
				"edition": "1",
				"extra": "CNKICite: 34\nprice: ￥62.40\nview: 2007",
				"language": "zh-CN",
				"numPages": "213",
				"publisher": "机械工业出版社",
				"url": "https://thinker.cnki.net/bookstore/book/bookdetail?bookcode=9787111520269000&type=book",
				"attachments": [],
				"tags": [],
				"notes": [
					"第1章 绪论\n第2章 近红外光谱分析技术基础\n第3章 基于近红外光谱的溶液中农药残留检测方法研究\n第4章 基于近红外光谱的蔬菜中农药残留检测方法研究\n第5章 近红外光谱技术在食用油品质定性分析中的应用研究\n第6章 近红外光谱技术在食用油品质定量分析中的应用研究\n第7章 基于近红外光谱的小麦粉品质检测方法研究\n第8章 基于近红外光谱的淀粉品质检测方法研究\n第9章 总结与展望"
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://thinker.cnki.net/BookStore/chapter/chapterdetail?bookcode=9787111520269000_174&type=chapter#div6",
		"items": [
			{
				"itemType": "bookSection",
				"title": "第8章 基于近红外光谱的淀粉品质检测方法研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘翠玲",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2015",
				"ISBN": "9787111520269",
				"abstractNote": "8.1||简介\n淀粉是以谷类、薯类、豆类为原料,不经过任何化学方法处理,也不改变淀粉内在的物理和化学特性加工而成的。它是日常生活中必不可少的作料之一,如煎炸烹炒,做汤勾芡都少不了要用到淀粉。随着食用淀粉在现代食品加工业中的广泛应用,淀粉生产和加工贸易取得了较大的发展。常见的产品主要有玉米淀粉、马铃薯淀粉、红薯淀粉和绿豆淀粉等,不同种类的淀粉价格差别较大,有的相差高达10倍以上,但是不同种类淀粉颗粒的宏观外观和普通物化指标差别不明显,无法辨认。由于缺乏相应的食用淀粉鉴别检验技术标准,国内淀粉市场严格监管很难执...",
				"bookTitle": "近红外光谱技术在食品品质检测方法中的研究",
				"language": "zh-CN",
				"pages": "185",
				"publisher": "机械工业出版社",
				"url": "https://thinker.cnki.net/BookStore/chapter/chapterdetail?bookcode=9787111520269000_174&type=chapter#div6",
				"attachments": [],
				"tags": [],
				"notes": [
					""
				],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://thinker.cnki.net/BookStore/search/Result",
		"items": "multiple"
	}
]
/** END TEST CASES **/

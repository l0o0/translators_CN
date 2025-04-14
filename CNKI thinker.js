{
	"translatorID": "5393921c-d543-4b3a-a874-070b5d73b03a",
	"label": "CNKI Thinker",
	"creator": "jiaojiaodubai",
	"target": "^https?://thinker\\.cnki\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2025-03-24 05:53:56"
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
	const searchPanel = doc.querySelector('#searchlistdiv');
	if (searchPanel) {
		Z.monitorDOMChanges(searchPanel, { subtree: true, childList: true });
	}
	if (/book\/bookdetail/i.test(url)) {
		return 'book';
	}
	else if (/chapter\/chapterdetail/.test(url)) {
		return 'bookSection';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	const rows = doc.querySelectorAll('#searchlistdiv td > a[data-id]');
	for (const row of rows) {
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
		let items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url in items) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const newItem = new Z.Item(detectWeb(doc, url));
	const data = {
		innerData: { },
		set: function (key, value) {
			this.innerData[key] = value;
		},
		get: function (key) {
			const result = this.innerData[key];
			return result ? result : '';
		}
	};
	const extra = new Extra();
	switch (newItem.itemType) {
		case 'book':
			doc.querySelectorAll('.bc_a > li').forEach((elm) => {
				data.set(tryMatch(elm.innerText, /(^.+?):/, 1).replace(/\s*/, ''), tryMatch(elm.innerText, /:(.+)$/, 1));
			});
			newItem.title = text(doc, '#b-name');
			newItem.abstractNote = ZU.trimInternal(text(doc, '[name="contentDesc"]'));
			newItem.publisher = text(doc, '.xqy_g');
			doc.querySelectorAll('.xqy_b_mid a[href*="sfield=au"]').forEach(elm => newItem.creators.push(cleanAuthor(elm.innerText)));
			break;
		case 'bookSection':
			doc.querySelectorAll('.desc-info > p').forEach((elm) => {
				data.set(tryMatch(elm.innerText, /(^.+?):/, 1).replace(/\s*/, ''), tryMatch(elm.innerText, /:(.+)$/, 1));
			});
			newItem.title = text(doc, '.art-title > h1');
			newItem.abstractNote = ZU.trimInternal(text(doc, '#div2 > .desc-content'));
			newItem.bookTitle = text(doc, '.book-p');
			newItem.publisher = data.get('出版社');
			text(doc, '.art-name').split(/\s/).forEach(name => newItem.creators.push(cleanAuthor(name)));
			break;
	}
	newItem.edition = data.get('版次');
	newItem.date = ZU.strToISO(data.get('出版时间').replace(/(\d{4})(0?\d{1,2})(\d{1,2})/, '$1-$2-$3'));
	newItem.language = 'zh-CN';
	newItem.ISBN = ZU.cleanISBN(data.get('国际标准书号ISBN') || tryMatch(url, /bookcode=(\d{10,13})/, 1));
	newItem.url = url;
	extra.set('CNKICite', text(doc, '.book_zb_yy span:last-child'));
	extra.set('price', text(doc, '#OriginalPrice'));
	extra.set('view', text(doc, '#readSum'));
	newItem.extra = extra.toString();
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function cleanAuthor(name) {
	return {
		firstName: '',
		lastName: name,
		fieldMode: 1,
		creatorType: 'author'
	};
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
		"url": "https://thinker.cnki.net/bookStore/Book/bookdetail?bookcode=9787111520269000&type=book",
		"items": [
			{
				"itemType": "book",
				"title": "近红外光谱技术在食品品质检测方法中的研究",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘翠玲",
						"fieldMode": 1,
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"fieldMode": 1,
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"fieldMode": 1,
						"creatorType": "author"
					}
				],
				"ISBN": "9787111520269",
				"abstractNote": "本书从社会实际需求出发，根据多年的科研经验和成果，与多年从事测控信息处理、食品等相关专业的研究人员合作，融入许多解决实际问题的研究和实践成果，系统介绍了本课题组基于近红外光谱分析技术在果蔬类农药残留量的检测、食用植物油品质、小麦粉、淀粉的品质检测中的应用研究成",
				"edition": "1",
				"extra": "CNKICite: 39\nprice: ￥9999.00",
				"language": "zh-CN",
				"libraryCatalog": "CNKI Thinker",
				"publisher": "机械工业出版社",
				"url": "https://thinker.cnki.net/bookStore/Book/bookdetail?bookcode=9787111520269000&type=book",
				"attachments": [],
				"tags": [],
				"notes": [],
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
						"fieldMode": 1,
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "吴静珠",
						"fieldMode": 1,
						"creatorType": "author"
					},
					{
						"firstName": "",
						"lastName": "孙晓荣",
						"fieldMode": 1,
						"creatorType": "author"
					}
				],
				"ISBN": "9787111520269",
				"abstractNote": "8.1||简介 淀粉是以谷类、薯类、豆类为原料,不经过任何化学方法处理,也不改变淀粉内在的物理和化学特性加工而成的。它是日常生活中必不可少的作料之一,如煎炸烹炒,做汤勾芡都少不了要用到淀粉。随着食用淀粉在现代食品加工业中的广泛应用,淀粉生产和加工贸易取得了较大的发展。常见的产品主要有玉米淀粉、马铃薯淀粉、红薯淀粉和绿豆淀粉等,不同种类的淀粉价格差别较大,有的相差高达10倍以上,但是不同种类淀粉颗粒的宏观外观和普通物化指标差别不明显,无法辨认。由于缺乏相应的食用淀粉鉴别检验技术标准,国内淀粉市场严格监管很难执...",
				"bookTitle": "近红外光谱技术在食品品质检测方法中的研究",
				"language": "zh-CN",
				"libraryCatalog": "CNKI thinker",
				"url": "https://thinker.cnki.net/BookStore/chapter/chapterdetail?bookcode=9787111520269000_174&type=chapter#div6",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://thinker.cnki.net/BookStore/search/Result",
		"defer": true,
		"items": "multiple"
	}
]
/** END TEST CASES **/

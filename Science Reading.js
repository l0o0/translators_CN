{
	"translatorID": "1a2fcd88-4e0e-4766-917a-17de4336632a",
	"label": "Science Reading",
	"creator": "jiaojiaodubai",
	"target": "^https?://.*book\\.sciencereading\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-18 12:06:12"
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
	if (url.includes('show.do?')) {
		return 'book';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.book_detail_title a');
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
	const labels = new Labels(doc, '.book_info_row');
	Z.debug(labels.innerData.map(arr => [arr[0], ZU.trimInternal(arr[1].innerText)]));
	let more = doc.querySelector('#addinfo > a');
	if (more && !/收起\s*$/.test(more.innerText)) {
		Z.debug(more.textContent);
		await more.click();
	}
	var newItem = new Z.Item('book');
	newItem.extra = '';
	newItem.title = text(doc, '.book_detail_title');
	newItem.abstractNote = text(doc, '#introduction-body');
	newItem.series = labels.get('丛书');
	// newItem.seriesNumber = 系列编号;
	// newItem.volume = 卷次;
	// newItem.numberOfVolumes = 总卷数;
	newItem.edition = labels.get('版次');
	newItem.place = '北京';
	newItem.publisher = '科学出版社';
	newItem.date = labels.get('出版日期');
	// newItem.numPages = 总页数;
	newItem.language = 'zh-CN';
	newItem.ISBN = labels.get('ISBN');
	// newItem.shortTitle = 短标题;
	newItem.url = tryMatch(url, /^.+id=\w+/);
	newItem.libraryCatalog = '科学文库';
	extra.add('CLC', labels.get('中图分类号'));
	extra.add('subject', labels.get('学科分类'));
	extra.add('remark', labels.get(['备注', '附注信息']));
	let creators = [];
	labels.get('作者').split('；').forEach((group) => {
		let creatorType = /翻?译/.test(group)
			? 'translator'
			: 'author';
		group = group
			.replace(/[等主编著作翻译]*$/, '')
			.replace(/([\w\s])，([\w\s])/g, '$1 $2');
		group.split(/[，]/).forEach((creator) => {
			let country = tryMatch(creator, /^\((.+?)\)/, 1);
			creator = creator.replace(/^\(.+?\)/, '');
			let original = tryMatch(creator, /\((.+?)\)$/, 1);
			creator = creator.replace(/\(.+?\)$/, '');
			creator = ZU.cleanAuthor(creator, creatorType);
			if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
				creator.lastName = creator.firstName + creator.lastName;
				creator.firstName = '';
				creator.fieldMode = 1;
			}
			creator.country = country;
			creator.original = original;
			creators.push(creator);
		});
	});
	if (creators.some(creator => creator.country || creator.original)) {
		extra.add('creatorsExt', JSON.stringify(creators));
	}
	creators.forEach((creator) => {
		delete creator.country;
		extra.add('original-author', creator.original);
		delete creator.original;
		newItem.creators.push(creator);
	});
	let pdfLink = doc.querySelector('.download_btn');
	if (pdfLink) {
		newItem.attachments.push({
			url: `${doc.location.origin}/shop/book/Booksimple/offlineDownload.do?${tryMatch(url, /id=\w+/i)}&readMark=1`,
			title: 'Full Text PDF',
			mimeType: 'application/pdf'
		});
	}
	newItem.extra = extra.toString();
	newItem.complete();
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		Array.from(doc.querySelectorAll(selector))
			// avoid nesting
			.filter(element => !element.querySelector(selector))
			// avoid empty
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				const elmCopy = element.cloneNode(true);
				// avoid empty text
				while (/^\s*$/.test(elmCopy.firstChild.textContent)) {
					// Z.debug(elementCopy.firstChild.textContent);
					elmCopy.removeChild(elmCopy.firstChild);
					// Z.debug(elementCopy.firstChild.textContent);
				}
				if (elmCopy.childNodes.length > 1) {
					const key = elmCopy.removeChild(elmCopy.firstChild).textContent.replace(/\s/g, '');
					this.data.push([key, elmCopy]);
				}
				else {
					const text = ZU.trimInternal(elmCopy.textContent);
					const key = tryMatch(text, /^[[【]?.+?[】\]:：]/).replace(/\s/g, '');
					elmCopy.textContent = tryMatch(text, /^[[【]?.+?[】\]:：]\s*(.+)/, 1);
					this.data.push([key, elmCopy]);
				}
			});
	}

	get(label, element = false) {
		if (Array.isArray(label)) {
			const results = label
				.map(aLabel => this.get(aLabel, element));
			const keyVal = element
				? results.find(element => !/^\s*$/.test(element.textContent))
				: results.find(string => string);
			return keyVal
				? keyVal
				: element
					? this.emptyElm
					: '';
		}
		const pattern = new RegExp(label, 'i');
		const keyVal = this.data.find(arr => pattern.test(arr[0]));
		return keyVal
			? element
				? keyVal[1]
				: ZU.trimInternal(keyVal[1].textContent)
			: element
				? this.emptyElm
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
		"url": "https://book.sciencereading.cn/shop/book/Booksimple/show.do?id=BC4788089334E83A5E053020B0A0A2860000",
		"items": [
			{
				"itemType": "book",
				"title": "声学学科现状以及未来发展趋势",
				"creators": [
					{
						"firstName": "",
						"lastName": "程建春",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "李晓东",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "杨军",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2022-04",
				"ISBN": "9787030686503",
				"abstractNote": "本书详细介绍了声学各个主要分支学科(包括物理声学，声人工结构，水声学和海洋声学，结构声学，检测声学与储层声学，生物医学超声，微声学，功率超声，环境声学，语言声学和生物声学，心理和生理声学，音乐声学，气动声学和大气声学，声学标准和声学计量)的内涵、特点和研究范畴，国内外发展现状，基础领域今后今后5~10 年重点研究方向，国家需求和应用领域急需解决的科学问题，以及发展目标与各领域研究队伍状况.",
				"edition": "1",
				"extra": "CLC: O42\nsubject: 物理学",
				"language": "zh-CN",
				"libraryCatalog": "科学文库",
				"place": "北京",
				"publisher": "科学出版社",
				"series": "现代声学科学与技术丛书",
				"url": "https://book.sciencereading.cn/shop/book/Booksimple/show.do?id=BC4788089334E83A5E053020B0A0A2860000",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://book.sciencereading.cn/shop/book/Booksimple/show.do?id=BC30C281FBA284C19913C65B133869FCE000",
		"items": [
			{
				"itemType": "book",
				"title": "量子力学与路径积分",
				"creators": [
					{
						"firstName": "",
						"lastName": "费曼",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "希布斯",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "张邦固",
						"creatorType": "translator",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韦秀清",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1986-12",
				"abstractNote": "路径积分首先是由费曼提出和发展起来的．目前路径积分已成为解决弯曲时空的量子场论的非常有效的数学方法．路径积分在规范场、量子力学、量子电动力学、统计物理学等领域中已经常应用．    本书在费曼编的讲义基础上由希布斯加以整理而成．主要讨论路径积分的方法及其在量子力学、量子电动力学、统计力学等领域中的应用，例如用于解决势场中的电子散射、各种扰动问题．本书是学习路径积分的一本好教材．    本书可供从事广义相对论、基本粒子、场论、统计物理、应用数学等方面的研究人员和大专院校物理系师生及研究生参考．",
				"edition": "1",
				"extra": "CLC: O172.2\nsubject: 数学 力学 物理学\nremark: 书名原文：Quantum mechanics and path integrals. < 收起\ncreatorsExt: [{\"firstName\":\"\",\"lastName\":\"费曼\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"Feynman  P.P.\"},{\"firstName\":\"\",\"lastName\":\"希布斯\",\"creatorType\":\"author\",\"fieldMode\":1,\"country\":\"美\",\"original\":\"Hibbs  A.R.\"},{\"firstName\":\"\",\"lastName\":\"张邦固\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"},{\"firstName\":\"\",\"lastName\":\"韦秀清\",\"creatorType\":\"translator\",\"fieldMode\":1,\"country\":\"\",\"original\":\"\"}]\noriginal-author: Feynman  P.P.\noriginal-author: Hibbs  A.R.",
				"language": "zh-CN",
				"libraryCatalog": "科学文库",
				"place": "北京",
				"publisher": "科学出版社",
				"url": "https://book.sciencereading.cn/shop/book/Booksimple/show.do?id=BC30C281FBA284C19913C65B133869FCE000",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]

/** END TEST CASES **/

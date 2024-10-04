{
	"translatorID": "bb0d0e84-66b4-46e3-9089-ebc975a86111",
	"label": "CNBKSY",
	"creator": "jiaojiaodubai",
	"target": "^https?://.*(www\\.)?cnbksy\\.(cn|com)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-10-04 22:36:52"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 jiaojiaodubai23@gmail.com

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
	let searchBox = doc.querySelector('.body_box');
	if (searchBox) {
		Z.monitorDOMChanges(searchBox, { childList: true, subtree: true });
	}
	if (url.includes('/detail/')) {
		if (doc.querySelector('.srTable a[href*="/literature/newspaper/"]')) {
			return 'newspaperArticle';
		}
		return 'journalArticle';
	}
	else if (url.includes('/picDetail/')) {
		return 'artwork';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('a[href*="/search/detail/"],a[href*="/search/picDetail/"]');
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
			// 注意：该request依赖浏览器cookies
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc, url);
	}
}

async function scrape(doc, url = doc.location.href) {
	const labels = new Labels(doc, '.detailContainer tbody > tr');
	// Z.debug(data);
	const type = detectWeb(doc, url);
	const newItem = new Z.Item(type);
	switch (type) {
		case 'journalArticle':
			newItem.title = labels.get('题名');
			labels.get('作者', true).querySelectorAll('a').forEach((elm) => {
				newItem.creators.push(cleanAuthorElm(elm));
			});
			newItem.publicationTitle = labels.get('文献来源').replace(/^《|》$/g, '').replace(/\((\W+?)\)/g, '（$1）');
			newItem.date = ZU.strToISO(labels.get('出版时间'));
			newItem.volume = tryMatch(labels.get('卷期'), /0*(\d+)卷/, 1);
			newItem.issue = tryMatch(labels.get('卷期'), /(\w*)期/, 1).replace(/0*(\d+)/, '$1');
			newItem.pages = tryMatch(labels.get('卷期'), /([\d-.+]*)页/, 1).replace(/[+.]\s?/g, ', ');
			newItem.abstractNote = labels.get('摘要');
			newItem.tags = labels.get('主题词').slice(1, -1).split(/[,;，；]/)
				.map(element => ({ tag: element }));
			break;
		case 'newspaperArticle':
			newItem.title = labels.get('标题').replace(/\((\W+?)\)/g, '（$1）');
			newItem.shortTitle = labels.get('标题2').replace(/\((\W+?)\)/g, '（$1）');
			newItem.publicationTitle = labels.get('文献来源').replace(/^《|》$/g, '').replace(/\((\W+?)\)/g, '（$1）');
			newItem.place = labels.get('新闻发布地');
			newItem.date = ZU.strToISO(labels.get('出版时间'));
			newItem.pages = labels.get('版次').replace(/^0*/, '');
			labels.get('作者', true).querySelectorAll('a').forEach((elm) => {
				newItem.creators.push(cleanAuthorElm(elm));
			});
			break;
		case 'artwork':
			newItem.title = labels.get('图片标题');
			newItem.abstractNote = labels.get('图片描述');
			newItem.creators = labels.get('图片责任者').split(/\s/).map(name => ZU.cleanAuthor(name, 'author'));
			newItem.date = ZU.strToISO(labels.get('出版年份'));
			newItem.artworkMedium = labels.get('图片类型');
			newItem.artworkSize = labels.get(['厘米尺寸', '图片尺寸']).toLowerCase();
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			break;
	}
	addAttachment(doc, newItem);
	newItem.url = url;
	newItem.complete();
}

function cleanAuthorElm(elm) {
	// https://www.cnbksy.cn/search/detail/6352bccafc25f907edbed671da67097a/7/65632869f74f7f47007f6262
	let creatorType = 'author';
	if (elm.nextSibling && elm.nextSibling.nodeName == '#text') {
		if (/^[译譯]$/.test(elm.nextSibling.textContent.trim())) {
			creatorType = 'translator';
		}
		else if (/^[记記]$/.test(elm.nextSibling.textContent.trim())) {
			creatorType = 'contributor';
		}
	}
	const creator = ZU.cleanAuthor(elm.textContent, creatorType);
	if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
		creator.fieldMode = 1;
	}
	return creator;
}

function addAttachment(doc, item) {
	if (item.itemType == 'artwork') {
		item.attachments.push({
			title: 'Snapshot',
			document: doc
		});
	}
	else {
		let args = attr(doc, 'a[onclick^="confirmDownload"]', 'onclick').match(/'[^']*'/g);
		if (args && args.length) {
			args = args.map(arg => arg.slice(1, -1));
			item.attachments.push({
				title: 'Full Text PDF',
				mimeType: 'application/pdf',
				url: `https://${doc.location.host}/literature/downloadPiece?eid=${args[0]}&bcId=${args[1]}&pieceId=${args[2]}&ltid=${args[3]}&activeId=${args[4]}&source=2&downloadSource=${args[5]}`
			});
		}
	}
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	const match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

class Labels {
	constructor(doc, selector) {
		this.data = [];
		this.emptyElm = doc.createElement('div');
		const nodes = doc.querySelectorAll(selector);
		for (const node of nodes) {
			// avoid nesting
			// avoid empty
			if (node.querySelector(selector) || !/\S/.test(node.textContent)) continue;
			const elmCopy = node.cloneNode(true);
			// avoid empty text
			while (![1, 3, 4].includes(elmCopy.firstChild.nodeType) || !/\S/.test(elmCopy.firstChild.textContent)) {
				elmCopy.removeChild(elmCopy.firstChild);
				if (!elmCopy.firstChild) break;
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
		}
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

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://www.cnbksy.cn/search/detail/25b6c69a90d8c868d26d34432adf0a14/7/65632869f74f7f47007f6262",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "我们为什么不了解苏联?",
				"creators": [
					{
						"firstName": "",
						"lastName": "斯诺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "钱华",
						"creatorType": "contributor",
						"fieldMode": 1
					}
				],
				"date": "1947",
				"issue": "22",
				"libraryCatalog": "CNBKSY",
				"pages": "13-18",
				"publicationTitle": "文萃",
				"url": "https://www.cnbksy.cn/search/detail/25b6c69a90d8c868d26d34432adf0a14/7/65632869f74f7f47007f6262",
				"volume": "2",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cnbksy.cn/search/detail/31f4a4381418a4f24a341dea6e355fa0/8/656326927fa00c4f558f5dfe",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "记念刘和珍君",
				"creators": [
					{
						"firstName": "",
						"lastName": "鲁迅",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1996",
				"issue": "2",
				"libraryCatalog": "CNBKSY",
				"pages": "40-41, 60",
				"publicationTitle": "名作欣赏（太原）",
				"url": "https://www.cnbksy.cn/search/detail/31f4a4381418a4f24a341dea6e355fa0/8/656326927fa00c4f558f5dfe",
				"attachments": [],
				"tags": [
					{
						"tag": " 中国"
					},
					{
						"tag": " 现代"
					},
					{
						"tag": "散文"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cnbksy.cn/search/picDetail/bcce04512712dd6ee0d457bfdd2ed8de/15/null",
		"items": [
			{
				"itemType": "artwork",
				"title": "孙总理肖像浮雕",
				"creators": [
					{
						"firstName": "",
						"lastName": "鄭可",
						"creatorType": "author"
					}
				],
				"date": "1930",
				"artworkMedium": "雕塑",
				"artworkSize": "20.8*27.3cm",
				"libraryCatalog": "CNBKSY",
				"url": "https://www.cnbksy.cn/search/picDetail/bcce04512712dd6ee0d457bfdd2ed8de/15/null",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					},
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
		"url": "https://www.cnbksy.cn/search/detail/fcdd0275178d1f37f83d329b23d7d0988f1b14e82d679da1b36927b0f1651e0e/12/66ee7a5523b099099b774e3c",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "自然辯證法和形式邏輯（上）",
				"creators": [
					{
						"firstName": "",
						"lastName": "日本岡邦雄",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陳伯陶",
						"creatorType": "translator",
						"fieldMode": 1
					}
				],
				"date": "1934",
				"libraryCatalog": "CNBKSY",
				"pages": "11",
				"publicationTitle": "大公报（天津）",
				"url": "https://www.cnbksy.cn/search/detail/fcdd0275178d1f37f83d329b23d7d0988f1b14e82d679da1b36927b0f1651e0e/12/66ee7a5523b099099b774e3c",
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

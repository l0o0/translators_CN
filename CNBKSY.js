{
	"translatorID": "bb0d0e84-66b4-46e3-9089-ebc975a86111",
	"label": "CNBKSY",
	"creator": "jiaojiaodubai23",
	"target": "^https?://.*(www\\.)?cnbksy\\.(cn|com)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-12-15 18:58:08"
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
	Z.debug('---------- CNBKSY 2023-12-16 02:58:06 ----------')
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

function matchCreator(creator) {
	creator = {
		lastName: creator,
		creatorType: 'author',
		fieldMode: 1
	};
	return creator;
}

async function scrape(doc, url = doc.location.href) {
	let labels = new Labels(doc, '.detailContainer tbody > tr');
	// Z.debug(data);
	let type = detectWeb(doc, url);
	var newItem = new Z.Item(type);
	switch (type) {
		case 'journalArticle':
			newItem.title = labels.getWith('题名');
			newItem.creators = labels.getWith('作者').split(/\s/)
				.filter(element => !element.match(/[著作译譯词詞曲]$/))
				.map(element => matchCreator(element));
			newItem.publicationTitle = labels.getWith('文献来源').replace(/^《|》$/g, '');
			newItem.date = labels.getWith('出版时间').replace(/年$/, '');
			newItem.volume = tryMatch(labels.getWith('卷期(页)'), /(\d*)卷/, 1);
			newItem.issue = tryMatch(labels.getWith('卷期(页)'), /(\d*)期/, 1);
			newItem.pages = tryMatch(labels.getWith('卷期(页)'), /([\d-.+]*)页/, 1);
			newItem.abstractNote = labels.getWith('摘要');
			newItem.tags = labels.getWith('主题词').slice(1, -1).split(/[,;，；]/)
				.map(element => ({ tag: element }));
			break;
		case 'newspaperArticle':
			newItem.title = data.fuzzyGet('标题');
			newItem.shortTitle = labels.getWith('标题2');
			newItem.publicationTitle = labels.getWith('文献来源').replace(/^《|》$/g, '');
			newItem.place = labels.getWith('新闻发布地');
			newItem.data = labels.getWith('出版时间')
				.replace(/(^\D*)|(\D*$)/g, '')
				.replace(/\D+/g, '-')
				.replace(/-(\d)(?:\D|$)/g, '-0$1');
			newItem.pages = labels.getWith('版次').replace(/^0*/, '');
			newItem.creators = matchCreator(labels.getWith('新闻来源'));
			newItem.extra += `\n类别: ${labels.getWith('类别')}`;
			break;
		case 'artwork':
			newItem.title = labels.getWith('图片标题');
			newItem.abstractNote = labels.getWith('图片描述');
			newItem.creators = labels.getWith('图片责任者').split(/\s/).map(element => matchCreator(element));
			newItem.date = labels.getWith('出版年份');
			newItem.artworkMedium = labels.getWith('图片类型');
			newItem.artworkSize = labels.getWith('图片尺寸');
			newItem.archive = labels.getWith('图片来源');
			newItem.archiveLocation = `${labels.getWith('收录卷期')} ${labels.getWith('所属正文篇名')}`;
			newItem.url = url;
			newItem.attachments.push({
				title: 'Snapshot',
				document: doc
			});
			newItem.complete();
			break;
		default:
			break;
	}
	newItem.url = url;
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

class Labels {
	constructor(doc, selector) {
		this.innerData = [];
		Array.from(doc.querySelectorAll(selector))
			.filter(element => element.firstElementChild)
			.filter(element => !element.querySelector(selector))
			.filter(element => !/^\s*$/.test(element.textContent))
			.forEach((element) => {
				let elementCopy = element.cloneNode(true);
				let key = elementCopy.removeChild(elementCopy.firstElementChild).innerText.replace(/\s/g, '');
				this.innerData.push([key, elementCopy]);
			});
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
						"lastName": "斯诺",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "钱华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1947",
				"issue": "22",
				"libraryCatalog": "CNBKSY",
				"pages": "13-18",
				"publicationTitle": "文萃",
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
						"lastName": "鲁迅",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1996",
				"issue": "2",
				"libraryCatalog": "CNBKSY",
				"pages": "40-41.60",
				"publicationTitle": "名作欣赏(太原)",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cnbksy.cn/search/detail/6352bccafc25f907edbed671da67097a/7/65632869f74f7f47007f6262",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "走向自由祖国:歌曲",
				"creators": [
					{
						"lastName": "许幸之",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "余森强",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "1946",
				"issue": "36",
				"libraryCatalog": "CNBKSY",
				"pages": "23",
				"publicationTitle": "文萃",
				"shortTitle": "走向自由祖国",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://www.cnbksy.cn/search/detail/79d1aa3b33a678c39fc0e5b135771ebf/8/65632cd923b0997d8ad78b38",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "青年“无所谓”心态探微",
				"creators": [
					{
						"lastName": "唐美云",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"lastName": "华静",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2004",
				"abstractNote": "青年无所谓心态是青年试图解决问题时产生的两难境地时选择的第三条道路,有着其深厚的社会原因.然而青年自身在接受社会纪过程中产生的“自我意识”误读、价值失衡、责任薄弱、信仰却是其更为本质原因.针对这些原因和根据的青年的特点,对无所谓心态应加以引导.",
				"issue": "1",
				"libraryCatalog": "CNBKSY",
				"pages": "52-56",
				"publicationTitle": "当代青年研究(上海)",
				"attachments": [],
				"tags": [
					{
						"tag": " 青年特点"
					},
					{
						"tag": "青年"
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
				"creators": [],
				"date": "1930 年",
				"archive": "良友",
				"archiveLocation": "孫總理肖像浮雕-第52 期",
				"artworkMedium": "雕塑",
				"artworkSize": "1230*1611像素",
				"libraryCatalog": "CNBKSY",
				"url": "https://www.cnbksy.cn/search/picDetail/bcce04512712dd6ee0d457bfdd2ed8de/15/null",
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
	}
]
/** END TEST CASES **/

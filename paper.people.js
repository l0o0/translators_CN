{
	"translatorID": "84bd7e84-c61d-4348-8615-3b56d9ebb848",
	"label": "paper.people",
	"creator": "jiaojiaodubai",
	"target": "^http://paper\\.people(\\.com)?\\.cn",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-07 15:11:26"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 jiaojiaodubai<jiaojiaodubai23@gmail.com>

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

const newspaperMap = {
	rmrb: '人民日报',
	rmrbhwb: '人民日报海外版',
	zgnyb: '中国能源报',
	fcyym: '讽刺与幽默',
	zgcsb: '中国城市报',
};

const journalMap = {
	xwzx: '新闻战线',
	rmlt: '人民论坛',
	rmzk: '人民周刊',
	zgjjzk: '中国经济周刊',
	mszk: '民生周刊',
	zgby: '中国报业'
};
function detectWeb(doc, url) {
	if (doc.querySelector('.article-box')) {
		if (Object.keys(newspaperMap).some(key => url.includes(`/${key}/`))) {
			return 'newspaperArticle';
		}
		else if (Object.keys(journalMap).some(key => url.includes(`/${key}/`))) {
			return 'journalArticle';
		}
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('.news > ul > li > a');
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
	newItem.title = text(doc, '.article > h3') + text(doc, '.article > h3+h1') + text(doc, '.article > h1+h2');
	newItem.shortTitle = text(doc, '.article > h1');
	let key = [...Object.keys(newspaperMap), ...Object.keys(journalMap)].find(key => url.includes(`/${key}/`));
	newItem.publicationTitle = newspaperMap[key] || journalMap[key];
	let pubInfo = text(doc, '.sec > .date');
	newItem.place = '北京';
	newItem.date = tryMatch(pubInfo, /(\d+)年(\d+)月(\d+)日/).replace(/(\d+)年(\d+)月(\d+)日/, '$1-$2-$3');
	newItem.pages = tryMatch(pubInfo, /第0*([1-9]\d*)版/, 1);
	pureText(doc.querySelector('.sec'))
		// 预先将二字人名拼接起来
		.replace(/□/, '').replace(/([^\u4e00-\u9fa5][\u4e00-\u9fa5])\s([\u4e00-\u9fa5][^\u4e00-\u9fa5])/g, '$1$2')
		.split(/\s/)
		.filter(creator => !creator.includes('记者'))
.forEach((creator) => {
	creator = creator.replace(/(图|文)\|/, '');
	creator = ZU.cleanAuthor(creator, 'author');
	creator.fieldMode = 1;
	newItem.creators.push(creator);
});
	newItem.language = 'zh-CN';
	newItem.url = url;
	newItem.libraryCatalog = '人民日报图文数据库';
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function pureText(element) {
	if (!element) return '';
	// Deep copy to avoid affecting the original page.
	let elementCopy = element.cloneNode(true);
	while (elementCopy.lastElementChild) {
		elementCopy.removeChild(elementCopy.lastElementChild);
	}
	return ZU.trimInternal(elementCopy.innerText);
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://paper.people.com.cn/mszk/html/2023-12/18/content_26034010.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "生态环境监管不能走过场",
				"creators": [
					{
						"firstName": "",
						"lastName": "严碧华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2023-12-18",
				"language": "zh-CN",
				"libraryCatalog": "人民日报图文数据库",
				"publicationTitle": "民生周刊",
				"url": "http://paper.people.com.cn/mszk/html/2023-12/18/content_26034010.htm",
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
		"url": "http://paper.people.com.cn/rmrb/html/2024-01/07/nw.D110000renmrb_20240107_1-01.htm",
		"items": [
			{
				"itemType": "newspaperArticle",
				"title": "辽宁推动产业集群高质量发展",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘成友",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘佳华",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-01-07",
				"language": "zh-CN",
				"libraryCatalog": "人民日报图文数据库",
				"place": "北京",
				"publicationTitle": "人民日报",
				"url": "http://paper.people.com.cn/rmrb/html/2024-01/07/nw.D110000renmrb_20240107_1-01.htm",
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
		"url": "http://paper.people.com.cn/zgnyb/html/2024-01/01/node_2222.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://paper.people.com.cn/zgby/html/2022-01/25/node_2751.htm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://paper.people.com.cn/xwzx/html/2021-12/01/content_26016862.htm",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "融媒体时代深挖财经报道的主流价值——电视新闻专题《百亿大和解》创作感悟",
				"creators": [
					{
						"firstName": "",
						"lastName": "原宝国",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "韩信",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王兴涛",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2021-12-01",
				"language": "zh-CN",
				"libraryCatalog": "人民日报图文数据库",
				"publicationTitle": "新闻战线",
				"shortTitle": "融媒体时代深挖财经报道的主流价值",
				"url": "http://paper.people.com.cn/xwzx/html/2021-12/01/content_26016862.htm",
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

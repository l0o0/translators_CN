{
	"translatorID": "a038ca9d-9f46-412b-82e5-e58d9f15e026",
	"label": "Xinhuanet",
	"creator": "jiaojiaodubai",
	"target": "^http://www(\\.news\\.cn|\\.xinhuanet\\.com)",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-01-08 12:07:46"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 jiaojiaodubai<jiaojiaoduabi23@gmail.com>

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
	if (/\/\d{8}\//.test(url)) {
		return 'webpage';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = Array.from(doc.querySelectorAll('a')).filter(element => /\/\d{8}\//.test(element.href));
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
	var newItem = new Z.Item('webpage');
	newItem.title = text(doc, '.head-line > h1');
	newItem.websiteTitle = '新华网';
	newItem.date = `${text(doc, '.header-time > .year')}-${text(doc, '.header-time > .day').replace('/', '-')}`;
	newItem.url = url;
	newItem.language = 'zh-CN';
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	let authors = Array.from(doc.querySelectorAll('#detailContent > p'))
		.map(element => element.innerText)
		.filter(element => element.startsWith('　　') || element.startsWith('  '));
	Z.debug(authors);
	// “记者”在第二行：http://www.news.cn/politics/20240106/5518a024d70c46e19448ca4c40a926e2/c.html
	// “记者”在第二行，顿号分隔：http://www.news.cn/local/20240107/9c08d1cdc9a542adb5014763b800c437/c.html
	// “记者”在最后一行，空格分隔：http://www.news.cn/fortune/20240108/10abbd286d9640dfb31a3d1ab1d40603/c.html
	// “记者”前有图：http://www.news.cn/politics/20240107/d23e8e94734643e0bea2be961ef90895/c.html
	// 避免以“记者”为段首：http://www.xinhuanet.com/20240108/b9bf79b4c46e4676907320d10373b37b/c.html
	authors = [authors[0], authors[1], authors[authors.length - 1]].find(string => /\S+记者(?:：|\s*)(.+)[)）]*/.test(string)) || '';
	Z.debug(authors);
	authors = tryMatch(
		authors,
		/记者(?:：|\s*)(.+)[)）]*/,
		1
	);
	let editor = text(doc, '.editor');
	Z.debug(editor);
	newItem.creators = [...processName(authors, 'author'), ...processName(editor, 'editor')];
	newItem.complete();
}

function tryMatch(string, pattern, index = 0) {
	if (!string) return '';
	let match = string.match(pattern);
	return (match && match[index])
		? match[index]
		: '';
}

function processName(creators, creatorType) {
	creators = creators
		.trim()
		.replace(/^[(（［【[]|[)）］】\]]$/g, '')
		.replace(/([^\u4e00-\u9fff][\u4e00-\u9fff])\s+([\u4e00-\u9fff](?:[^\u4e00-\u9fff]|$))/g, '$1$2')
		.split(/\s+|、|：|:/)
		.filter(creator => !/编|(?:记者)|摄|图|文/.test(creator));
	creators = creators.map((creator) => {
		creator = ZU.cleanAuthor(creator, creatorType);
		creator.fieldMode = 1;
		return creator;
	});
	return creators;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.news.cn/politics/20240106/5518a024d70c46e19448ca4c40a926e2/c.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "以高质量监督服务高质量发展——坚定不移推进全面从严治党之“监督篇”",
				"creators": [
					{
						"firstName": "",
						"lastName": "刘硕",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "王頔",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-06",
				"language": "zh-CN",
				"url": "http://www.news.cn/politics/20240106/5518a024d70c46e19448ca4c40a926e2/c.html",
				"websiteTitle": "新华网",
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
		"url": "http://www.news.cn/fortune/20240108/10abbd286d9640dfb31a3d1ab1d40603/c.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "政策持续完善 银发经济再拓空间",
				"creators": [
					{
						"firstName": "",
						"lastName": "张莫",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "陈涵旸",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周楚卿",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-08",
				"language": "zh-CN",
				"url": "http://www.news.cn/fortune/20240108/10abbd286d9640dfb31a3d1ab1d40603/c.html",
				"websiteTitle": "新华网",
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
		"url": "http://www.news.cn/local/20240107/9c08d1cdc9a542adb5014763b800c437/c.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "新华鲜报丨“尔滨”引发南北文旅拉歌：掏出“家底”请你来",
				"creators": [
					{
						"firstName": "",
						"lastName": "吉哲鹏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "孙敏",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "严勇",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "刘笑冬",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-07",
				"language": "zh-CN",
				"url": "http://www.news.cn/local/20240107/9c08d1cdc9a542adb5014763b800c437/c.html",
				"websiteTitle": "新华网",
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
		"url": "http://www.news.cn/politics/20240107/d23e8e94734643e0bea2be961ef90895/c.html",
		"items": [
			{
				"itemType": "webpage",
				"title": "第40次南极考察丨中国在极地布放首个生态潜标",
				"creators": [
					{
						"firstName": "",
						"lastName": "周圆",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "周楚卿",
						"creatorType": "editor",
						"fieldMode": 1
					}
				],
				"date": "2024-01-07",
				"language": "zh-CN",
				"url": "http://www.news.cn/politics/20240107/d23e8e94734643e0bea2be961ef90895/c.html",
				"websiteTitle": "新华网",
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
		"url": "http://www.xinhuanet.com/",
		"items": "multiple"
	}
]
/** END TEST CASES **/

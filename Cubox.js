{
	"translatorID": "992850d2-b68b-4a1f-8dd6-0f4fd323c6be",
	"label": "Cubox",
	"creator": "eatcosmos",
	"target": "https://cubox\\.pro/my/card",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-06-20 16:34:51"
}


/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 eatcosmos

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
	if (url.includes('card')) {
		return 'blogPost';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	else if (url.includes('ChatGPT')) {
		return 'blogPost';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	var items = {};
	var found = false;
	var rows = doc.querySelectorAll('h2 > a.title[href*="/article/"]');
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
	// TODO: implement or add a scrape function template
	Z.debug("url: " + url);
	var title = ZU.xpath(doc, "//h1[@class='reader-title']"); // 返回的所有符合该条件的元素列表
	// Z.debug("title 1: " + title);
	title = title[0].innerText; // 因为从网页上看只有一个元素符合这个条件，就把第一个元素取出，它的文本就是标题内容
	Z.debug("title 2: " + title);
	// var publishDate = ZU.xpath(doc, "//head/meta[@name='publishdate']");  // 也是返回列表
	// var publishDate = publishDate[0].getAttribute('content');  // 取第一个元素，取得 content 属性值
	// Z.debug(publishDate);
	var author = ZU.xpath(doc, "//span[@class='reader-metadata-author']");
	author = author[0].innerText;
	Z.debug("author: " + author);
	var originUrl = ZU.xpath(doc, "//a[@class='reader-footer-source']");
	originUrl = originUrl[0].getAttribute('href');
	Z.debug("origin_url: " + originUrl);

	var newItem = new Zotero.Item("blogPost"); // 新建一个新闻条目，后面把信息填入到对应字段
	newItem.title = title;
	// newItem.date = publishDate;
	// newItem.date = publishDate;
	newItem.blogTitle = title;
	newItem.url = url;
	newItem.creators.push({ lastName: author, creatorType: 'author' }); // 创建者信息，参考文本翻译器编写官方文档
	// newItem.notes.push({note:content});  // 这里是把内容放到条目下的笔记中
	// newItem.attachments.push({url:origin_url, title:title});  // 这里是把网页快照放到条目下的附件中
	newItem.extra = originUrl; // 这里是把原始网址放到条目下的附加信息中
	newItem.complete(); // 最后一定要有这一步，表示收集完成，可以传给 Zotero
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://observationalepidemiology.blogspot.com/2011/10/tweet-from-matt-yglesias.html",
		"items": [
			{
				"itemType": "blogPost",
				"title": "A tweet from Matt Yglesias",
				"creators": [
					{
						"firstName": "",
						"lastName": "Joseph",
						"creatorType": "author"
					}
				],
				"date": "Monday, October 24, 2011",
				"accessDate": "CURRENT_TIMESTAMP",
				"blogTitle": "West Coast Stat Views (on Observational Epidemiology and more)",
				"libraryCatalog": "Blogger",
				"url": "http://observationalepidemiology.blogspot.com/2011/10/tweet-from-matt-yglesias.html",
				"attachments": [
					{
						"title": "Blogspot Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					"Mark",
					"Matthew Yglesias"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://observationalepidemiology.blogspot.com/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://argentina-politica.blogspot.com/2012/03/perciben-una-caida-en-la-imagen-de-la.html",
		"items": [
			{
				"itemType": "blogPost",
				"title": "Politica Argentina - Blog de Psicología Política de Federico González: Perciben una caída en la imagen de la Presidenta",
				"creators": [
					{
						"firstName": "Federico",
						"lastName": "Gonzalez",
						"creatorType": "author"
					}
				],
				"date": "domingo, 11 de marzo de 2012",
				"blogTitle": "Politica Argentina - Blog de Psicología Política de Federico González",
				"shortTitle": "Politica Argentina - Blog de Psicología Política de Federico González",
				"url": "http://argentina-politica.blogspot.com/2012/03/perciben-una-caida-en-la-imagen-de-la.html",
				"attachments": [
					{
						"title": "Blogspot Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					"Cristina Kirchner",
					"imagen"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://utotherescue.blogspot.com/2013/11/the-heart-of-matter-humanities-do-more.html",
		"items": [
			{
				"itemType": "blogPost",
				"title": "National Humanities Report Reinforces Stereotypes about the Humanities ~ Remaking the University",
				"creators": [
					{
						"firstName": "Michael",
						"lastName": "Meranze",
						"creatorType": "author"
					}
				],
				"date": "Monday, November 25, 2013",
				"blogTitle": "National Humanities Report Reinforces Stereotypes about the Humanities ~ Remaking the University",
				"url": "http://utotherescue.blogspot.com/2013/11/the-heart-of-matter-humanities-do-more.html",
				"attachments": [
					{
						"title": "Blogspot Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					"Cuts",
					"Development",
					"Humanities",
					"Liberal Arts",
					"guest post"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://jamsubuntu.blogspot.com/2009/01/unmount-command-not-found.html",
		"items": [
			{
				"itemType": "blogPost",
				"title": "Jam's Ubuntu Linux Blog: unmount: command not found",
				"creators": [],
				"date": "Wednesday, 7 January 2009",
				"blogTitle": "Jam's Ubuntu Linux Blog",
				"shortTitle": "Jam's Ubuntu Linux Blog",
				"url": "https://jamsubuntu.blogspot.com/2009/01/unmount-command-not-found.html",
				"attachments": [
					{
						"title": "Blogspot Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					"Command Line"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/

{
	"translatorID": "481b8759-56bd-465f-a783-d9d74b313749",
	"label": "CSDN",
	"creator": "jiaojiaodubai",
	"target": "^https://blog\\.csdn\\.net",
	"minVersion": "5.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-11-03 02:35:05"
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
	if (url.includes('/article/details/')) {
		return 'blogPost';
	}
	else if (getSearchResults(doc, true)) {
		return 'multiple';
	}
	return false;
}

function getSearchResults(doc, checkOnly) {
	const items = {};
	let found = false;
	// '.Community-item > .content > a' for home page
	// '.item-hd > h3 > a' for search result
	const rows = doc.querySelectorAll('.Community-item > .content > a[href*="/article/details/"],.item-hd > h3 > a[href*="/article/details/"]');
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
		const items = await Zotero.selectItems(getSearchResults(doc, false));
		if (!items) return;
		for (const url of Object.keys(items)) {
			await scrape(await requestDocument(url));
		}
	}
	else {
		await scrape(doc);
	}
}

async function scrape(doc) {
	const newItem = new Z.Item('blogPost');
	newItem.title = text(doc, 'h1.title-article');
	newItem.abstractNote = attr(doc, 'meta[name="description"]', 'content');
	newItem.blogTitle = 'CSDN';
	newItem.date = ZU.strToISO(attr(doc, '.blog-postTime', 'data-time'));
	newItem.url = attr(doc, 'link[rel="canonical"]', 'href');
	newItem.language = 'zh-CN';
	newItem.creators.push({
		firstName: '',
		lastName: text(doc, '#uid'),
		creatorType: 'author',
		fieldMode: 1
	});
	newItem.attachments.push({
		title: 'Snapshot',
		document: doc
	});
	doc.querySelectorAll('.tags-box > a').forEach(elm => newItem.tags.push(ZU.trimInternal(elm.textContent)));
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://blog.csdn.net/weixin_48093237/article/details/141571439",
		"items": [
			{
				"itemType": "blogPost",
				"title": "zotero同步之infiniteCLOUD网盘 WebDAV",
				"creators": [
					{
						"firstName": "",
						"lastName": "Curious!",
						"creatorType": "author",
						"fieldMode": 1
					}
				],
				"date": "2024-08-26",
				"abstractNote": "文章浏览阅读425次，点赞5次，收藏5次。zotero打开   编辑->首选项->同步。_infinitecloud",
				"blogTitle": "CSDN",
				"language": "zh-CN",
				"url": "https://blog.csdn.net/weixin_48093237/article/details/141571439",
				"attachments": [
					{
						"title": "Snapshot",
						"mimeType": "text/html"
					}
				],
				"tags": [
					{
						"tag": "ubuntu"
					},
					{
						"tag": "zotero"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://blog.csdn.net/",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://so.csdn.net/so/search?q=Zotero%E5%90%8C%E6%AD%A5",
		"items": "multiple"
	}
]
/** END TEST CASES **/

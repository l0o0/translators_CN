{
	"translatorID": "5a325508-cb60-42c3-8b0f-d4e3c6441058",
	"label": "Weixin",
	"creator": "Fushan Wen, jiaojiaodubai",
	"target": "^https?://mp\\.weixin\\.qq\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-02-24 11:31:40"
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2022 l0o0

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


function detectWeb(doc, _url) {
	if (attr(doc, 'meta[property="og:type"]', 'content') === 'article') {
		return "blogPost";
	}
	return false;
}

async function doWeb(doc, url) {
	const newItem = new Z.Item('blogPost');
	const metas = new Map();
	const nodeList = doc.head.querySelectorAll(':scope meta[property^="og:"]');
	for (const node of nodeList) {
		metas.set(node.getAttribute('property'), node.content);
	}
	Z.debug(metas);
	newItem.title = metas.get('og:title');
	newItem.abstractNote = metas.get('og:description');
	newItem.blogTitle = text(doc, '#profileBt > a');
	// newItem.websiteType = metas.get('og:site_name');
	newItem.websiteType = '微信公众号';
	newItem.date = text(doc, '#publish_time');
	newItem.url = metas.get('og:url');
	[...new Set([text(doc, '#js_name'), metas.get('og:article:author')])].forEach((creator) => {
		creator = ZU.cleanAuthor(creator, 'author');
		if (/[\u4e00-\u9fff]/.test(creator.lastName)) {
			creator.lastName = creator.firstName + creator.lastName;
			creator.firstName = '';
			creator.fieldMode = 1;
		}
		newItem.creators.push(creator);
	});

	/* 删除这行启用note记录全文
	let note = doc.body.querySelector("#js_content");
	if (note) {
		note = `<h1>${newItem.title}</h1>`
			+ note.innerHTML
				.trim()
				.replace(/\"/g, "'")
				.replace(/<img .*?src='(.*?)'.*?>/g, "<img src='$1'\/>");
		newItem.notes.push(note);
	}
	删除这行启用note记录全文 */
	newItem.attachments.push({
		url: url,
		title: 'Snapshot',
		document: doc
	});
	newItem.complete();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://mp.weixin.qq.com/s/NYENhzx7kF7OX_d4DTD4fA",
		"items": [
			{
				"itemType": "blogPost",
				"title": "Zotero 官方安卓测试版来了",
				"creators": [
					{
						"firstName": "",
						"lastName": "学术废物收容所",
						"creatorType": "author",
						"fieldMode": 1
					},
					{
						"firstName": "",
						"lastName": "l0o0",
						"creatorType": "author"
					}
				],
				"date": "2023-12-26 11:57",
				"abstractNote": "来自官方的圣诞礼物🎁——Zotero 安卓测试版来了",
				"blogTitle": "学术废物收容所",
				"url": "http://mp.weixin.qq.com/s?__biz=MzkyNjUxNjgxNg==&mid=2247483816&idx=1&sn=86afcacc6b0403049380d86e6618cae7&chksm=c2375297f540db817078c81cefd63069b0da43222c8f5b9dfb4ac15eae87f42f0b4555e89fe1#rd",
				"websiteType": "微信公众号",
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

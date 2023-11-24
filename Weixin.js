{
	"translatorID": "5a325508-cb60-42c3-8b0f-d4e3c6441058",
	"label": "Weixin",
	"creator": "Fushan Wen",
	"target": "^https?://mp\\.weixin\\.qq\\.com",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2023-09-27 07:06:52"
}

/*
	***** BEGIN LICENSE BLOCK *****
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

function scrape(doc, url) {
	const item = new Zotero.Item("blogPost");
	
	const ogMetadataCache = new Map();
	const nodeList = doc.head.querySelectorAll(':scope meta[property^="og:"]');
	for (const node of nodeList) {
		ogMetadataCache.set(node.getAttribute("property"), node.content);
	}
	
	item.title = ogMetadataCache.get("og:title");
	item.websiteType = ogMetadataCache.get("og:site_name");
	item.blogTitle = doc.querySelector("#profileBt > a").innerText 
	item.url = ogMetadataCache.get("og:url");
	item.abstractNote = ogMetadataCache.get("og:description");
	item.creators = getArticleCreator(doc, ogMetadataCache.get("og:article:author"));
	item.date = doc.querySelector("#publish_time").innerText;
	// note_content = doc.body.querySelector("#js_content").innerHTML.trim();
	// note_content = note_content.replace(/\"/g, "'");
	// note_content = note_content.replace(/<img .*?src='(.*?)'.*?>/g, "<img src='$1'\/>");
	// note_content = `<h1>${item.title}</h1>` + note_content;
	// item.notes.push({note:note_content});
	item.attachments.push({url: url, title: "Snapshot", document: doc});
	item.complete();
}

function detectWeb(doc, url) {
	const ogType = doc.head.querySelector('meta[property="og:type"]');
	if (ogType && ogType.content === "article") {
		return "blogPost";
	}
	return false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) === "blogPost") {
		scrape(doc, url);
	}
}

function getArticleCreator(doc, authorName) {
	const profileName = doc.querySelector("#js_name").innerText.trim();
	if (!authorName.length || authorName === profileName) {
		return [{lastName: profileName, creatorType: "author", fieldMode: 1}];
	}
	return [{lastName: authorName, creatorType: "author", fieldMode: 1}, 
			{lastName: profileName, creatorType: "author", fieldMode: 1}
		   ];
}
/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
